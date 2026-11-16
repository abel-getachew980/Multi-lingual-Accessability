import {
  isSoundSupported,
  notificationAudioConstructor,
  playNotificationSound,
  resetNotificationAudio,
  type AudioContextLike,
  type GainLike,
  type OscillatorLike,
} from '@/utils/soundNotifications';

interface Param {
  value: number;
  setValueAtTime: jest.Mock;
  exponentialRampToValueAtTime: jest.Mock;
}

interface FakeOscillator extends OscillatorLike {
  frequency: Param;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}

interface FakeGain extends GainLike {
  gain: Param;
  connect: jest.Mock;
}

function param(): Param {
  return {
    value: 0,
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  };
}

function fakeContext(currentTime = 10, state = 'running') {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];

  const createOscillator = jest.fn(() => {
    const oscillator: FakeOscillator = {
      type: 'sine',
      frequency: param(),
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    oscillators.push(oscillator);
    return oscillator;
  });

  const createGain = jest.fn(() => {
    const gain: FakeGain = {
      gain: param(),
      connect: jest.fn(),
    };
    gains.push(gain);
    return gain;
  });

  const context: AudioContextLike & {
    oscillators: FakeOscillator[];
    gains: FakeGain[];
    createOscillator: jest.Mock;
    createGain: jest.Mock;
  } = {
    currentTime,
    state,
    destination: {},
    oscillators,
    gains,
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    createOscillator,
    createGain,
  };

  return context;
}

afterEach(() => {
  resetNotificationAudio();
});

describe('sound support detection', () => {
  it('reports support when the browser exposes AudioContext', () => {
    expect(isSoundSupported()).toBe(true);
  });

  it('reports no support when neither constructor exists', () => {
    const audioWindow = window as unknown as Record<string, unknown>;
    const standard = audioWindow.AudioContext;
    const webkit = audioWindow.webkitAudioContext;

    delete audioWindow.AudioContext;
    delete audioWindow.webkitAudioContext;

    try {
      expect(isSoundSupported()).toBe(false);
      expect(playNotificationSound('message')).toBe(false);
    } finally {
      audioWindow.AudioContext = standard;
      audioWindow.webkitAudioContext = webkit;
    }
  });

  it('falls back to webkitAudioContext', () => {
    const audioWindow = window as unknown as Record<string, unknown>;
    const standard = audioWindow.AudioContext;
    const webkit = audioWindow.webkitAudioContext;

    delete audioWindow.AudioContext;
    audioWindow.webkitAudioContext = jest.fn().mockImplementation(() => fakeContext());

    try {
      expect(isSoundSupported()).toBe(true);
    } finally {
      audioWindow.AudioContext = standard;
      audioWindow.webkitAudioContext = webkit;
    }
  });
});

describe('playNotificationSound', () => {
  it('schedules nothing when sound is turned off', () => {
    const context = fakeContext();

    expect(playNotificationSound('message', { context, enabled: false })).toBe(
      false,
    );
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
  });

  it('plays one short high tone for a new message', () => {
    const context = fakeContext();

    expect(playNotificationSound('message', { context })).toBe(true);

    expect(context.oscillators).toHaveLength(1);
    const [oscillator] = context.oscillators;
    expect(oscillator.type).toBe('sine');
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(660, 10);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(10.1, 5);
  });

  it('plays a rising two-tone chime for success', () => {
    const context = fakeContext();

    playNotificationSound('success', { context });

    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      660,
      10,
    );
    expect(context.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      880,
      expect.closeTo(10.1, 5),
    );
    // Each tone gets its own gain node and is connected through it.
    expect(context.gains).toHaveLength(2);
    context.oscillators.forEach((oscillator, index) => {
      expect(oscillator.connect).toHaveBeenCalledWith(context.gains[index]);
      expect(context.gains[index].connect).toHaveBeenCalledWith(
        context.destination,
      );
    });
  });

  it('plays a low descending tone for an error', () => {
    const context = fakeContext();

    playNotificationSound('error', { context });

    expect(context.oscillators.map((oscillator) => oscillator.type)).toEqual([
      'triangle',
      'triangle',
    ]);
    expect(context.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      220,
      10,
    );
    expect(context.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(
      180,
      expect.closeTo(10.14, 5),
    );
  });

  it('ramps the gain down to silence so the tone cannot click', () => {
    const context = fakeContext();

    playNotificationSound('message', { context, volume: 0.2 });

    const gain = context.gains[0].gain;
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 10);
    const ramps = gain.exponentialRampToValueAtTime.mock.calls;
    expect(ramps[0][0]).toBe(0.2);
    expect(ramps[0][1]).toBeCloseTo(10.01, 5);
    expect(ramps[1][0]).toBe(0.0001);
    expect(ramps[1][1]).toBeCloseTo(10.08, 5);
  });

  it('clamps the requested volume to 0–1', () => {
    const loud = fakeContext();
    const silent = fakeContext();

    playNotificationSound('message', { context: loud, volume: 5 });
    playNotificationSound('message', { context: silent, volume: -2 });

    const loudRamps = loud.gains[0].gain.exponentialRampToValueAtTime.mock.calls;
    const silentRamps =
      silent.gains[0].gain.exponentialRampToValueAtTime.mock.calls;

    expect(loudRamps[0][0]).toBe(1);
    expect(silentRamps[0][0]).toBe(0.0001);
  });

  it('resumes a suspended context before scheduling', () => {
    const context = fakeContext(10, 'suspended');

    playNotificationSound('message', { context });

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.oscillators).toHaveLength(1);
  });

  it('fails silently when the browser blocks audio', () => {
    const context = fakeContext();
    context.createOscillator.mockImplementation(() => {
      throw new DOMException('autoplay blocked', 'NotAllowedError');
    });

    expect(playNotificationSound('message', { context })).toBe(false);
  });

  it('reports failure when no context can be created', () => {
    const audioWindow = window as unknown as Record<string, unknown>;
    const standard = audioWindow.AudioContext;
    const webkit = audioWindow.webkitAudioContext;

    delete audioWindow.AudioContext;
    delete audioWindow.webkitAudioContext;

    try {
      expect(playNotificationSound('message')).toBe(false);
    } finally {
      audioWindow.AudioContext = standard;
      audioWindow.webkitAudioContext = webkit;
    }
  });
});

describe('shared audio context', () => {
  it('creates the default context lazily and reuses it', () => {
    const first = fakeContext();
    const Constructor = jest.fn().mockImplementation(() => first);
    const audioWindow = window as unknown as Record<string, unknown>;
    const standard = audioWindow.AudioContext;

    audioWindow.AudioContext = Constructor;

    try {
      expect(playNotificationSound('message')).toBe(true);
      expect(playNotificationSound('success')).toBe(true);

      expect(Constructor).toHaveBeenCalledTimes(1);
      expect(notificationAudioConstructor()).toBe(Constructor);
      expect(first.oscillators).toHaveLength(3);
    } finally {
      audioWindow.AudioContext = standard;
    }
  });

  it('closes and forgets the context on reset', () => {
    const context = fakeContext();
    const Constructor = jest.fn().mockImplementation(() => context);
    const audioWindow = window as unknown as Record<string, unknown>;
    const standard = audioWindow.AudioContext;

    audioWindow.AudioContext = Constructor;

    try {
      playNotificationSound('message');
      resetNotificationAudio();

      expect(context.close).toHaveBeenCalledTimes(1);
      expect(notificationAudioConstructor()).toBeNull();

      playNotificationSound('message');
      expect(Constructor).toHaveBeenCalledTimes(2);
    } finally {
      audioWindow.AudioContext = standard;
    }
  });

  it('does not throw when the constructor itself fails', () => {
    const audioWindow = window as unknown as Record<string, unknown>;
    const standard = audioWindow.AudioContext;

    audioWindow.AudioContext = jest.fn().mockImplementation(() => {
      throw new Error('no audio hardware');
    });

    try {
      expect(playNotificationSound('message')).toBe(false);
      expect(notificationAudioConstructor()).toBeNull();
    } finally {
      audioWindow.AudioContext = standard;
    }
  });
});
