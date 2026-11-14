import '@testing-library/jest-dom';

// Mock Web Speech API for voice input tests
global.SpeechRecognition = jest.fn();
global.webkitSpeechRecognition = jest.fn();

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
