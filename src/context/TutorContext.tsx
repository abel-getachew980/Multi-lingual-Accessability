'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  Message,
  Language,
  AIProvider,
  UserPreferences,
  HumanHelpRequest,
  SettingsUpdate,
} from '@/types';
import { announceToScreenReader } from '@/utils/accessibility';
import {
  ConversationStore,
  DEFAULT_PREFERENCES,
  IndexedDBStore,
  OfflineQueue,
  PreferencesStore,
} from '@/services/storage';

// ============================================
// TUTOR CONTEXT - COMPLETE IMPLEMENTATION
// ============================================

interface TutorContextType {
  // State
  messages: Message[];
  isLoading: boolean;
  isOffline: boolean;
  preferences: UserPreferences;
  humanHelpRequest: HumanHelpRequest | null;
  screenShareActive: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  setLanguage: (lang: Language) => void;
  setAIProvider: (provider: AIProvider) => void;
  requestHumanHelp: () => void;
  cancelHumanHelp: () => void;
  toggleScreenShare: () => void;
  clearHistory: () => void;
  updatePreferences: (prefs: SettingsUpdate) => void;

  // Getters
  getMessageCount: () => number;
  getLastMessage: () => Message | null;
}

// Storage singletons. Constructors are lazy, so importing this module during
// server rendering never touches IndexedDB or localStorage.
const preferencesStore = new PreferencesStore();
const storageBackend = new IndexedDBStore();
const conversationStore = new ConversationStore(storageBackend);
const offlineQueue = new OfflineQueue(storageBackend);

const TutorContext = createContext<TutorContextType | null>(null);

export function TutorProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [humanHelpRequest, setHumanHelpRequest] = useState<HumanHelpRequest | null>(null);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const hydratedRef = useRef(false);

  // Restore preferences and the previous transcript before the first save, so
  // defaults never overwrite real data.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const storedPreferences = preferencesStore.get();
      if (!cancelled) setPreferences(storedPreferences);

      try {
        const storedMessages = await conversationStore.load();
        if (!cancelled && storedMessages.length > 0) setMessages(storedMessages);
      } catch (error) {
        // IndexedDB unavailable (private mode, blocked storage): run in memory.
        console.warn('Could not restore the conversation:', error);
      }

      if (!cancelled) hydratedRef.current = true;
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist preferences on every change.
  useEffect(() => {
    if (!hydratedRef.current) return;
    preferencesStore.set(preferences);
  }, [preferences]);

  // Persist the transcript, debounced so a burst of messages writes once.
  useEffect(() => {
    if (!hydratedRef.current) return;

    const timer = setTimeout(() => {
      void conversationStore.save(messages).catch((error) => {
        console.warn('Could not save the conversation:', error);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [messages]);

  // Re-send anything queued while offline and surface the answers in the chat.
  const flushOfflineQueue = useCallback(async () => {
    let result;

    try {
      result = await offlineQueue.sync();
    } catch (error) {
      console.warn('Could not sync the offline queue:', error);
      return;
    }

    if (result.sent.length === 0 && result.dropped.length === 0 && result.failed.length === 0) {
      return;
    }

    const answers: Message[] = [];

    for (const item of result.sent) {
      try {
        const data = JSON.parse(item.body) as {
          answer?: unknown;
          citation?: Message['citation'];
        };

        if (typeof data.answer === 'string' && data.answer.trim()) {
          answers.push({
            id: `offline-answer-${item.request.id}`,
            role: 'assistant',
            content: data.answer.trim(),
            language: preferences.language,
            timestamp: new Date(),
            citation: data.citation,
          });
        }
      } catch {
        // Not a JSON answer: nothing useful to show.
      }
    }

    if (answers.length > 0) {
      setMessages(prev => [...prev, ...answers]);
    }

    const handled = result.sent.length + result.dropped.length;

    if (handled > 0) {
      announceToScreenReader(
        preferences.language === 'am'
          ? `${handled} የተቀመጡ ጥያቄዎች ተልከዋል`
          : `${handled} saved question${handled === 1 ? '' : 's'} sent`,
        'polite'
      );
    }
  }, [preferences.language]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      announceToScreenReader(
        preferences.language === 'am'
          ? 'የበይነመረብ ግንኙነት ተመልሷል'
          : 'Internet connection restored',
        'polite'
      );
      void flushOfflineQueue();
    };

    const handleOffline = () => {
      setIsOffline(true);
      announceToScreenReader(
        preferences.language === 'am'
          ? 'የበይነመረብ ግንኙነት ተቋርጧል። የከርሰ ሥር ሁነታን ይጠቀሙ።'
          : 'Internet connection lost. Using offline mode.',
        'assertive'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // A previous session may have left questions in the queue.
    if (typeof navigator === 'undefined' || navigator.onLine) {
      void flushOfflineQueue();
    } else {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [preferences.language, flushOfflineQueue]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!preferences.soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [preferences.soundEnabled]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      language: preferences.language,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const requestBody = JSON.stringify({
      question: content,
      language: preferences.language,
      provider: preferences.preferredAIProvider,
    });

    // Offline: save the question and answer it when the connection returns,
    // instead of showing an error the learner cannot act on.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        await offlineQueue.enqueue({
          url: '/api/ai/query',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          label: content.slice(0, 80),
        });

        const queuedMessage: Message = {
          id: `msg-${Date.now()}-queued`,
          role: 'system',
          content: preferences.language === 'am'
            ? 'ከመስመር ውጭ ነዎት። ጥያቄዎ ተቀምጧል፤ ግንኙነት ሲመለስ መልሱ ይመጣል።'
            : 'You are offline. Your question is saved and will be answered when the connection returns.',
          language: preferences.language,
          timestamp: new Date(),
          isOffline: true,
        };

        setMessages(prev => [...prev, queuedMessage]);
        announceToScreenReader(
          preferences.language === 'am' ? 'ጥያቄው ተቀምጧል' : 'Question saved offline',
          'polite'
        );
        setIsLoading(false);
        return;
      } catch (queueError) {
        // Storage refused the write: fall through so the learner still gets a
        // clear error instead of a question that vanished.
        console.warn('Could not queue the offline question:', queueError);
      }
    }

    try {
      // Call API endpoint
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.answer,
        language: preferences.language,
        timestamp: new Date(),
        citation: data.citation,
        isOffline,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Announce and notify
      announceToScreenReader(
        preferences.language === 'am' ? 'አዲስ መልእክት ተቀብለዋል' : 'New message received',
        'polite'
      );
      playNotificationSound();

    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: preferences.language === 'am'
          ? 'ይቅርታ፣ ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።'
          : 'Sorry, an error occurred. Please try again.',
        language: preferences.language,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      announceToScreenReader('Error sending message', 'assertive');
    } finally {
      setIsLoading(false);
    }
  }, [preferences.language, preferences.preferredAIProvider, isOffline, playNotificationSound]);

  // Set language
  const setLanguage = useCallback((lang: Language) => {
    setPreferences(prev => ({ ...prev, language: lang }));
    announceToScreenReader(
      lang === 'am' ? 'ቋንቋ ወደ አማርኛ ተቀይሯል' : 'Language changed to English',
      'polite'
    );
  }, []);

  // Set AI provider
  const setAIProvider = useCallback((provider: AIProvider) => {
    setPreferences(prev => ({ ...prev, preferredAIProvider: provider }));
    announceToScreenReader(`AI provider changed to ${provider}`, 'polite');
  }, []);

  // Request human help
  const requestHumanHelp = useCallback(() => {
    const request: HumanHelpRequest = {
      id: `help-${Date.now()}`,
      userId: 'current-user', // TODO: Get from auth
      conversationHistory: messages,
      timestamp: new Date(),
      status: 'pending',
      screenShareEnabled: false,
    };

    setHumanHelpRequest(request);

    const systemMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'system',
      content: preferences.language === 'am'
        ? 'የሰው እርዳታ ተጠይቋል። እባክዎ ይጠብቁ...'
        : 'Human help requested. Please wait...',
      language: preferences.language,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, systemMessage]);
    announceToScreenReader(
      preferences.language === 'am' ? 'እርዳታ ተጠይቋል' : 'Help requested',
      'assertive'
    );
  }, [messages, preferences.language]);

  // Cancel human help
  const cancelHumanHelp = useCallback(() => {
    setHumanHelpRequest(null);
    setScreenShareActive(false);
    announceToScreenReader('Human help cancelled', 'polite');
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(() => {
    if (!humanHelpRequest) return;

    setScreenShareActive(prev => {
      const newState = !prev;
      announceToScreenReader(
        newState ? 'Screen sharing started' : 'Screen sharing stopped',
        'polite'
      );
      return newState;
    });
  }, [humanHelpRequest]);

  // Clear history
  const clearHistory = useCallback(() => {
    setMessages([]);
    void conversationStore.clear().catch(() => {
      // Nothing else to do: the in-memory transcript is already cleared.
    });
    announceToScreenReader('Chat history cleared', 'polite');
  }, []);

  // Update preferences
  const updatePreferences = useCallback((prefs: SettingsUpdate) => {
    setPreferences(prev => ({ ...prev, ...prefs }));
  }, []);

  // Getters
  const getMessageCount = useCallback(() => messages.length, [messages]);
  const getLastMessage = useCallback(() => messages[messages.length - 1] || null, [messages]);

  const value: TutorContextType = {
    messages,
    isLoading,
    isOffline,
    preferences,
    humanHelpRequest,
    screenShareActive,
    sendMessage,
    setLanguage,
    setAIProvider,
    requestHumanHelp,
    cancelHumanHelp,
    toggleScreenShare,
    clearHistory,
    updatePreferences,
    getMessageCount,
    getLastMessage,
  };

  return (
    <TutorContext.Provider value={value}>
      {children}
    </TutorContext.Provider>
  );
}

export function useTutor() {
  const context = useContext(TutorContext);
  if (!context) {
    throw new Error('useTutor must be used within a TutorProvider');
  }
  return context;
}
