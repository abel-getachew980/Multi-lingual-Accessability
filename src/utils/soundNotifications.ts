/**
 * Short interface sounds for chat events.
 *
 * Sound is a bonus, never the only feedback: every sound has a visible
 * counterpart (typing indicator, error text, status badge). The helper fails
 * silently when the browser blocks audio, so a learner with sound off or a
 * locked-down browser loses nothing.
 */

export type NotificationSound = 'message' | 'success' | 'error';

export interface AudioParamLike {
  value: number;
  setValueAtTime?(value: number, time: number): void;
  exponentialRampToValueAtTime?(value: number, time: number): void;
}

export interface OscillatorLike {
  type: OscillatorType;
  frequency: AudioParamLike;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainLike {
  gain: AudioParamLike;
  connect(destination: unknown): unknown;
}

export interface AudioContextLike {
  currentTime: number;
  state?: string;
  destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume?(): Promise<void>;
  close?(): Promise<void>;
}

export interface SoundOptions {
  /** Mirrors the learner's setting; when false nothing is scheduled. */
  enabled?: boolean;
  /** Injected in tests; defaults to one shared AudioContext. */
  context?: AudioContextLike;
  /** Peak gain, 0–1. The default stays quiet in a shared room. */
  volume?: number;
}

interface Tone {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  /** Gap before this tone, in seconds. */
  delay?: number;
}

const TONES: Record<NotificationSound, Tone[]> = {
  message: [{ frequency: 660, duration: 0.08 }],
  success: [
    { frequency: 660, duration: 0.08 },
    { frequency: 880, duration: 0.12, delay: 0.1 },
  ],
  error: [
    { frequency: 220, duration: 0.16, type: 'triangle' },
    { frequency: 180, duration: 0.18, type: 'triangle', delay: 0.14 },
  ],
};

const DEFAULT_VOLUME = 0.06;
// `exponentialRampToValueAtTime` cannot target zero, so "silent" is the
// smallest positive gain rather than 0. Callers mute with `enabled: false`.
const MIN_VOLUME = 0.0001;

let sharedContext: AudioContextLike | null = null;
let sharedContextConstructor: (new () => AudioContext) | null = null;

function getAudioContextConstructor(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;

  const audioWindow = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export function isSoundSupported(): boolean {
  return getAudioContextConstructor() !== null;
}

function getSharedContext(): AudioContextLike | null {
  if (sharedContext) return sharedContext;

  const Constructor = getAudioContextConstructor();
  if (!Constructor) return null;

  try {
    sharedContext = new Constructor() as unknown as AudioContextLike;
    sharedContextConstructor = Constructor;
    return sharedContext;
  } catch {
    return null;
  }
}

function schedule(context: AudioContextLike, tone: Tone, volume: number): void {
  const start = context.currentTime + (tone.delay ?? 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = tone.type ?? 'sine';

  if (oscillator.frequency.setValueAtTime) {
    oscillator.frequency.setValueAtTime(tone.frequency, start);
  } else {
    oscillator.frequency.value = tone.frequency;
  }

  // A short attack/release avoids the click an abrupt start would make.
  if (gain.gain.setValueAtTime) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime?.(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime?.(
      0.0001,
      start + tone.duration,
    );
  } else {
    gain.gain.value = volume;
  }

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + tone.duration + 0.02);
}

/**
 * Plays a notification tone. Returns true only when the tones were handed to
 * the audio context; a false result is not an error and needs no UI.
 */
export function playNotificationSound(
  sound: NotificationSound,
  options: SoundOptions = {},
): boolean {
  if (options.enabled === false) return false;

  const context = options.context ?? getSharedContext();
  if (!context) return false;

  try {
    if (context.state === 'suspended') {
      void context.resume?.();
    }

    const volume = Math.min(
      Math.max(options.volume ?? DEFAULT_VOLUME, MIN_VOLUME),
      1,
    );
    TONES[sound].forEach((tone) => schedule(context, tone, volume));
    return true;
  } catch {
    // Autoplay policy and missing audio hardware are expected in some
    // environments. The visual feedback already told the learner what
    // happened.
    return false;
  }
}

/** Closes and forgets the shared context. Useful in tests and teardown. */
export function resetNotificationAudio(): void {
  if (sharedContext) {
    void sharedContext.close?.();
  }

  sharedContext = null;
  sharedContextConstructor = null;
}

/** Exposed so tests can assert the constructor was reused. */
export function notificationAudioConstructor(): (new () => AudioContext) | null {
  return sharedContextConstructor;
}
