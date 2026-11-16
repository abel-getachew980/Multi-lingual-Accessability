/**
 * Help desk: queue management, status updates and WebRTC signaling state.
 */

export { HelpQueue, helpQueue, sanitizeConversationHistory } from './helpQueue';
export { SignalStore, signalStore } from './signalStore';
export {
  HelpConflictError,
  HelpCooldownError,
  HelpError,
  HelpNotFoundError,
  HelpValidationError,
  type HelpHistoryEntry,
  type HelpRequestInput,
  type HelpSnapshot,
  type HelpStatusUpdate,
  type HelpTicket,
  type QueueStats,
} from './types';
export type { SignalInput, SignalMessage, SignalRole, SignalType } from './signalStore';
