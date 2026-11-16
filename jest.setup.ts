import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Web Speech API is not part of jsdom. Individual tests can replace these
// constructors when they need to drive recognition events.
Object.defineProperty(globalThis, 'SpeechRecognition', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(globalThis, 'webkitSpeechRecognition', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

if (typeof window !== 'undefined') {
  // jsdom has no `matchMedia`; without this every component that reads a
  // system preference (reduced motion, high contrast) throws on mount.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  const createParam = () => ({
    value: 0,
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  });

  const createOscillator = () => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: createParam(),
    type: 'sine',
  });

  const createGain = () => ({
    connect: jest.fn(),
    gain: createParam(),
  });

  const AudioContextMock = jest.fn().mockImplementation(() => ({
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator,
    createGain,
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }));

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: AudioContextMock,
  });

  Object.defineProperty(window, 'webkitAudioContext', {
    configurable: true,
    writable: true,
    value: AudioContextMock,
  });

  // jsdom leaves this undefined; focus helpers call it optimistically.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = jest.fn();
  }
}
