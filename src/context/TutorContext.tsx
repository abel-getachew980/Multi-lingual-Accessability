'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Message,
  Language,
  AIProvider,
  UserPreferences,
  HumanHelpRequest,
  SettingsUpdate,
} from '@/types';
import { announceToScreenReader } from '@/utils/accessibility';

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
