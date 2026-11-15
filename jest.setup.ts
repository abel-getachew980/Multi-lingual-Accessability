import '@testing-library/jest-dom';

// Mock Web Speech API for voice input tests
Object.assign(globalThis, {
  SpeechRecognition: jest.fn(),
  webkitSpeechRecognition: jest.fn(),
});

// Mock AudioContext for sound tests (browser/jsdom only)
if (typeof window !== 'undefined') {
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
}
