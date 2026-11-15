import '@testing-library/jest-dom';

// Polyfill structuredClone for Node.js < 17
if (typeof structuredClone !== 'function') {
  global.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj));
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
