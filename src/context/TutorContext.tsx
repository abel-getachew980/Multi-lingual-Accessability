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
import { isHumanHelpStatus } from '@/services/humanHelp';

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
  humanHelpModalOpen: boolean;
  screenShareActive: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  setLanguage: (lang: Language) => void;
  setAIProvider: (provider: AIProvider) => void;
  requestHumanHelp: () => void;
  cancelHumanHelp: () => void;
  openHumanHelpModal: () => void;
  closeHumanHelpModal: () => void;
  toggleScreenShare: () => void;
  clearHistory: () => void;
  updatePreferences: (prefs: SettingsUpdate) => void;

  // Getters
  getMessageCount: () => number;
  getLastMessage: () => Message | null;
}

const defaultPreferences: UserPreferences = {
  language: 'am',
  soundEnabled: true,
  highContrast: false,
  fontSize: 'normal',
  keyboardOnlyMode: false,
  preferredAIProvider: 'offline',
  screenReaderOptimized: true,
  autoPlayVoiceResponses: false,
  reduceMotion: false,
};

const TutorContext = createContext<TutorContextType | null>(null);

export function TutorProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [humanHelpRequest, setHumanHelpRequest] = useState<HumanHelpRequest | null>(null);
  const [humanHelpModalOpen, setHumanHelpModalOpen] = useState(false);
  const [remoteHelpId, setRemoteHelpId] = useState<string | null>(null);
  const cancelledHelpRequestRef = useRef<string | null>(null);
  const [screenShareActive, setScreenShareActive] = useState(false);

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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [preferences.language]);

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

    try {
      // Call API endpoint
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: content,
          language: preferences.language,
          provider: preferences.preferredAIProvider,
        }),
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
    if (humanHelpRequest) return;

    const request: HumanHelpRequest = {
      id: `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: 'current-user', // TODO: Get from auth
      conversationHistory: messages,
      timestamp: new Date(),
      status: 'pending',
      screenShareEnabled: false,
    };

    setHumanHelpRequest(request);
    setHumanHelpModalOpen(true);

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

    void (async () => {
      try {
        const response = await fetch('/api/help', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: request.userId,
            conversationHistory: messages,
          }),
        });

        if (!response.ok) throw new Error('Could not create help request');

        const data = await response.json();
        const requestId = typeof data.requestId === 'string' ? data.requestId : request.id;

        if (cancelledHelpRequestRef.current === request.id) {
          cancelledHelpRequestRef.current = null;
          void fetch(`/api/help?id=${encodeURIComponent(requestId)}`, {
            method: 'DELETE',
          }).catch(() => undefined);
          return;
        }

        setHumanHelpRequest(prev => prev && prev.id === request.id
          ? {
              ...prev,
              id: requestId,
              status: isHumanHelpStatus(data.status) ? data.status : 'pending',
              queuePosition: typeof data.position === 'number' ? data.position : undefined,
            }
          : prev);
        setRemoteHelpId(requestId);
      } catch {
        if (cancelledHelpRequestRef.current === request.id) {
          cancelledHelpRequestRef.current = null;
          return;
        }

        setHumanHelpRequest(prev => prev && prev.id === request.id ? null : prev);
        setHumanHelpModalOpen(false);
        setRemoteHelpId(null);
        setMessages(prev => prev
          .filter(message => message.id !== systemMessage.id)
          .concat({
            id: `msg-${Date.now()}`,
            role: 'system',
            content: preferences.language === 'am'
              ? 'የሰው እርዳታ አገልግሎት አልተገኘም። እባክዎ እንደገና ይሞክሩ።'
              : 'The human help service is unavailable. Please try again.',
            language: preferences.language,
            timestamp: new Date(),
          }));
        announceToScreenReader(
          preferences.language === 'am'
            ? 'የሰው እርዳታ አገልግሎት አልተገኘም። እባክዎ እንደገና ይሞክሩ።'
            : 'The human help service is unavailable. Please try again.',
          'assertive'
        );
      }
    })();
  }, [humanHelpRequest, messages, preferences.language]);

  const humanHelpStatus = humanHelpRequest?.status;

  useEffect(() => {
    if (!remoteHelpId) return;
    if (humanHelpStatus === 'resolved' || humanHelpStatus === 'cancelled') return;

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/help?id=${encodeURIComponent(remoteHelpId)}`);
        if (!response.ok) {
          if (response.status === 404) {
            setHumanHelpRequest(null);
            setHumanHelpModalOpen(false);
            setRemoteHelpId(null);
          }
          return;
        }

        const data = await response.json();
        if (cancelled) return;

        setHumanHelpRequest(prev => {
          if (!prev || prev.id !== remoteHelpId) return prev;

          return {
            ...prev,
            status: isHumanHelpStatus(data.status) ? data.status : prev.status,
            queuePosition: typeof data.position === 'number' ? data.position : undefined,
            estimatedWait: typeof data.estimatedWait === 'string' ? data.estimatedWait : undefined,
            assignedTutor: typeof data.tutorId === 'string' ? data.tutorId : prev.assignedTutor,
            screenShareEnabled: typeof data.screenShareEnabled === 'boolean'
              ? data.screenShareEnabled
              : prev.screenShareEnabled,
          };
        });
      } catch {
        // The next poll retries; a transient failure should not cancel the request.
      }
    };

    void pollStatus();
    const interval = setInterval(() => void pollStatus(), 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [humanHelpStatus, remoteHelpId]);

  // Cancel human help
  const cancelHumanHelp = useCallback(() => {
    cancelledHelpRequestRef.current = humanHelpRequest?.id ?? null;

    if (remoteHelpId) {
      void fetch(`/api/help?id=${encodeURIComponent(remoteHelpId)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }

    setHumanHelpRequest(null);
    setHumanHelpModalOpen(false);
    setRemoteHelpId(null);
    setScreenShareActive(false);
    announceToScreenReader(
      preferences.language === 'am' ? 'የሰው እርዳታ ተሰርዟል' : 'Human help cancelled',
      'polite'
    );
  }, [humanHelpRequest?.id, preferences.language, remoteHelpId]);

  const openHumanHelpModal = useCallback(() => {
    if (humanHelpRequest) setHumanHelpModalOpen(true);
  }, [humanHelpRequest]);

  const closeHumanHelpModal = useCallback(() => {
    setHumanHelpModalOpen(false);
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(() => {
    if (!humanHelpRequest) return;

    const nextState = !screenShareActive;
    setScreenShareActive(nextState);
    setHumanHelpRequest(prev => prev ? { ...prev, screenShareEnabled: nextState } : prev);
    announceToScreenReader(
      nextState
        ? (preferences.language === 'am' ? 'የስክሪን መጋራት ተጀምሯል' : 'Screen sharing started')
        : (preferences.language === 'am' ? 'የስክሪን መጋራት ተቆመ' : 'Screen sharing stopped'),
      'polite'
    );
  }, [humanHelpRequest, preferences.language, screenShareActive]);

  // Clear history
  const clearHistory = useCallback(() => {
    setMessages([]);
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
    humanHelpModalOpen,
    screenShareActive,
    sendMessage,
    setLanguage,
    setAIProvider,
    requestHumanHelp,
    cancelHumanHelp,
    openHumanHelpModal,
    closeHumanHelpModal,
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
