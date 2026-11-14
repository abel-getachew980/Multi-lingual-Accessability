// Core types for the AI Tutor system

export type Language = 'am' | 'en';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: Language;
  timestamp: Date;
  citation?: Citation;
  isOffline?: boolean;
}

export interface Citation {
  source: string;
  page?: number;
  section?: string;
  url?: string;
}

export interface CourseContent {
  id: string;
  title: string;
  titleAm?: string;
  content: string;
  language: Language;
  metadata: {
    fileName: string;
    uploadedAt: Date;
    fileSize: number;
  };
}

export type AIProvider = 'cloud' | 'local' | 'offline';

export interface AIConfig {
  provider: AIProvider;
  cloudApiKey?: string;
  cloudEndpoint?: string;
  localModel?: string;
  localEndpoint?: string;
}

export interface HumanHelpRequest {
  id: string;
  userId: string;
  conversationHistory: Message[];
  timestamp: Date;
  status: 'pending' | 'connected' | 'resolved';
  screenShareEnabled: boolean;
}

export interface UserPreferences {
  language: Language;
  soundEnabled: boolean;
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  keyboardOnlyMode: boolean;
  preferredAIProvider: AIProvider;
  screenReaderOptimized: boolean;
}

export interface TutorState {
  messages: Message[];
  isLoading: boolean;
  isOffline: boolean;
  currentLanguage: Language;
  aiProvider: AIProvider;
  humanHelpActive: boolean;
  screenShareActive: boolean;
}
