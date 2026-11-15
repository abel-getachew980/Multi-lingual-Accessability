import '@testing-library/jest-dom';

// Polyfill structuredClone for Node.js < 17
if (typeof structuredClone !== 'function') {
  const clone = <T>(value: T): T => {
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }

    if (Array.isArray(value)) {
      return value.map(item => clone(item)) as T;
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, clone(item)])
      ) as T;
    }

    return value;
  };

  global.structuredClone = clone;
}

// Mock Web Speech API for voice input tests
Object.defineProperty(globalThis, 'SpeechRecognition', {
  value: jest.fn(),
  writable: true,
});
Object.defineProperty(globalThis, 'webkitSpeechRecognition', {
  value: jest.fn(),
  writable: true,
});

// Mock AudioContext for sound tests
window.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 0 },
    type: 'sine',
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 0 },
  })),
  destination: {},
}));
