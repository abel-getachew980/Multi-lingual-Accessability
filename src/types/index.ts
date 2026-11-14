// ============================================
// COMPLETE TYPE DEFINITIONS FOR ALL MODULES
// ============================================

// Core Types
export type Language = 'am' | 'en';
export type AIProvider = 'cloud' | 'local' | 'offline';

// ============================================
// CHAT MODULE TYPES (Teammate 1)
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: Language;
  timestamp: Date;
  citation?: Citation;
  isOffline?: boolean;
  voiceUrl?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  inputText: string;
  isRecording: boolean;
}

export interface VoiceInputOptions {
  language: Language;
  continuous: boolean;
  interimResults: boolean;
}

// ============================================
// AI PROVIDER TYPES (Teammate 2)
// ============================================

export interface Citation {
  source: string;
  page?: number;
  section?: string;
  url?: string;
  snippet?: string;
}

export interface AIQuery {
  question: string;
  language: Language;
  context?: string[];
  conversationHistory?: Message[];
}

export interface AIResponse {
  answer: string;
  citation?: Citation;
  confidence?: number;
  provider: AIProvider;
  processingTime?: number;
}

export interface AIConfig {
  provider: AIProvider;
  cloudApiKey?: string;
  cloudEndpoint?: string;
  cloudModel?: string;
  localEndpoint?: string;
  localModel?: string;
}

export interface CourseContent {
  id: string;
  title: string;
  titleAm?: string;
  content: string;
  language: Language;
  metadata: CourseMetadata;
  chunks?: ContentChunk[];
}

export interface CourseMetadata {
  fileName: string;
  uploadedAt: Date;
  fileSize: number;
  fileType: string;
  totalPages?: number;
}

export interface ContentChunk {
  id: string;
  courseId: string;
  content: string;
  pageNumber?: number;
  section?: string;
  embedding?: number[];
}

// ============================================
// TELEGRAM BOT TYPES (Teammate 3)
// ============================================

export interface TelegramMessage {
  messageId: number;
  chatId: number;
  userId: number;
  text?: string;
  voice?: {
    fileId: string;
    duration: number;
  };
  timestamp: Date;
}

export interface TelegramSession {
  chatId: number;
  userId: number;
  language: Language;
  conversationHistory: Message[];
  lastActivity: Date;
  state: TelegramSessionState;
}

export type TelegramSessionState = 'idle' | 'waiting_question' | 'waiting_language' | 'human_help';

export interface TelegramKeyboard {
  inline_keyboard: TelegramKeyboardButton[][];
}

export interface TelegramKeyboardButton {
  text: string;
  callback_data: string;
}

// ============================================
// SMS GATEWAY TYPES (Teammate 4)
// ============================================

export interface SMSMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  status: 'received' | 'sent' | 'failed';
}

export interface SMSConfig {
  provider: 'twilio' | 'africas_talking';
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface SMSQueueItem {
  id: string;
  phoneNumber: string;
  message: string;
  attempts: number;
  maxAttempts: number;
  nextRetry?: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface USSDMenu {
  sessionId: string;
  phoneNumber: string;
  text: string;
  currentMenu: string;
  history: string[];
}

// ============================================
// HUMAN HELP TYPES (Teammate 5)
// ============================================

export interface HumanHelpRequest {
  id: string;
  userId: string;
  conversationHistory: Message[];
  timestamp: Date;
  status: HumanHelpStatus;
  screenShareEnabled: boolean;
  assignedTutor?: string;
}

export type HumanHelpStatus = 'pending' | 'connected' | 'in_progress' | 'resolved' | 'cancelled';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  signalingUrl: string;
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface ScreenShareSession {
  id: string;
  tutorId: string;
  learnerId: string;
  startedAt: Date;
  endedAt?: Date;
  streamId?: string;
  isActive: boolean;
}

// ============================================
// STORAGE & OFFLINE TYPES (Teammate 6)
// ============================================

export interface OfflineQueue {
  id: string;
  type: 'message' | 'help_request';
  payload: unknown;
  timestamp: Date;
  retryCount: number;
}

export interface CachedCourse {
  id: string;
  data: CourseContent;
  cachedAt: Date;
  lastAccessed: Date;
  size: number;
}

export interface UserPreferences {
  language: Language;
  soundEnabled: boolean;
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  keyboardOnlyMode: boolean;
  preferredAIProvider: AIProvider;
  screenReaderOptimized: boolean;
  autoPlayVoiceResponses: boolean;
  reduceMotion: boolean;
}

export interface ConversationHistory {
  id: string;
  messages: Message[];
  startedAt: Date;
  lastActivity: Date;
  isOffline: boolean;
}

// ============================================
// SETTINGS TYPES (Teammate 8)
// ============================================

export interface SettingsUpdate {
  language?: Language;
  soundEnabled?: boolean;
  highContrast?: boolean;
  fontSize?: 'normal' | 'large' | 'xlarge';
  keyboardOnlyMode?: boolean;
  preferredAIProvider?: AIProvider;
  screenReaderOptimized?: boolean;
  autoPlayVoiceResponses?: boolean;
  reduceMotion?: boolean;
}

export type SettingKey = keyof UserPreferences;

export interface SettingsValidation {
  isValid: boolean;
  errors: Record<SettingKey, string | null>;
}

// ============================================
// API TYPES (All teammates)
// ============================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// ACCESSIBILITY TYPES (Teammate 7)
// ============================================

export interface AccessibilityTestResult {
  test: string;
  passed: boolean;
  message: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  timestamp: Date;
}

export interface FocusTrapConfig {
  activate: boolean;
  initialFocus?: string;
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
}

export interface ScreenReaderAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: Date;
}
