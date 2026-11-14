import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Message, Language, AIProvider as AIProviderType, UserPreferences } from '../types';
import { createAIProvider, AIProviderInterface } from '../services/aiProvider';
import { announceToScreenReader } from '../utils/accessibility';

interface TutorContextType {
  // State
  messages: Message[];
  isLoading: boolean;
  isOffline: boolean;
  preferences: UserPreferences;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  setLanguage: (lang: Language) => void;
  setAIProvider: (provider: AIProviderType) => void;
  requestHumanHelp: () => void;
  clearHistory: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  language: 'am',
  soundEnabled: true,
  highContrast: false,
  fontSize: 'normal',
  keyboardOnlyMode: false,
  preferredAIProvider: 'offline',
  screenReaderOptimized: true,
};

const TutorContext = createContext<TutorContextType | null>(null);

export function TutorProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [aiProvider, setAIProviderInstance] = useState<AIProviderInterface | null>(null);
  
  // Initialize AI provider
  useEffect(() => {
    const provider = createAIProvider({
      provider: preferences.preferredAIProvider,
    });
    setAIProviderInstance(provider);
  }, [preferences.preferredAIProvider]);
  
  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      announceToScreenReader('Internet connection restored', 'polite');
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      announceToScreenReader('Internet connection lost. Switching to offline mode.', 'assertive');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Play sound notification for new messages
  const playNotificationSound = useCallback(() => {
    if (preferences.soundEnabled) {
      // Simple beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  }, [preferences.soundEnabled]);
  
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !aiProvider) return;
    
    // Create user message
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
      // Get AI response
      const response = await aiProvider.query(content, preferences.language);
      
      // Create assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response.answer,
        language: preferences.language,
        timestamp: new Date(),
        citation: response.citation,
        isOffline: isOffline,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Announce to screen reader
      announceToScreenReader(
        preferences.language === 'am' ? 'አዲስ መልእክት ተቀብለዋል' : 'New message received',
        'polite'
      );
      
      // Play notification sound
      playNotificationSound();
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Create error message
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
  }, [aiProvider, preferences.language, isOffline, playNotificationSound]);
  
  const setLanguage = useCallback((lang: Language) => {
    setPreferences(prev => ({ ...prev, language: lang }));
    announceToScreenReader(
      lang === 'am' ? 'ቋንቋ ወደ አማርኛ ተቀይሯል' : 'Language changed to English',
      'polite'
    );
  }, []);
  
  const setAIProvider = useCallback((provider: AIProviderType) => {
    setPreferences(prev => ({ ...prev, preferredAIProvider: provider }));
    announceToScreenReader(`AI provider changed to ${provider}`, 'polite');
  }, []);
  
  const requestHumanHelp = useCallback(() => {
    // Add system message about human help request
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
    
    // TODO: Implement actual human help connection (WebRTC, etc.)
  }, [preferences.language]);
  
  const clearHistory = useCallback(() => {
    setMessages([]);
    announceToScreenReader('Chat history cleared', 'polite');
  }, []);
  
  const updatePreferences = useCallback((prefs: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...prefs }));
  }, []);
  
  const value: TutorContextType = {
    messages,
    isLoading,
    isOffline,
    preferences,
    sendMessage,
    setLanguage,
    setAIProvider,
    requestHumanHelp,
    clearHistory,
    updatePreferences,
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
