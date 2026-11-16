import { SignalStore, HelpValidationError } from '@/services/help';

function makeStore() {
  let now = 1_700_000_000_000;

  return {
    store: new SignalStore(() => now, 3),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('SignalStore', () => {
  it('stores a signal and only returns it to the other role', () => {
    const { store } = makeStore();

    store.add({
      requestId: 'help-1',
      role: 'learner',
      type: 'offer',
      payload: { sdp: 'v=0' },
    });

    const forTutor = store.since('help-1', 'tutor', 0);
    const forLearner = store.since('help-1', 'learner', 0);

    expect(forTutor.messages).toHaveLength(1);
    expect(forTutor.messages[0]).toMatchObject({ role: 'learner', type: 'offer' });
    expect(forTutor.nextSince).toBe(1);
    expect(forLearner.messages).toEqual([]);
  });

  it('returns only messages newer than the cursor', () => {
    const { store } = makeStore();

    const first = store.add({
      requestId: 'help-1',
      role: 'learner',
      type: 'offer',
      payload: {},
    });
    store.add({
      requestId: 'help-1',
      role: 'learner',
      type: 'ice-candidate',
      payload: { candidate: 'a' },
    });

    const result = store.since('help-1', 'tutor', first.id);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe('ice-candidate');
    expect(result.nextSince).toBe(2);
  });

  it('keeps rooms separate', () => {
    const { store } = makeStore();

    store.add({ requestId: 'help-1', role: 'learner', type: 'offer', payload: {} });
    store.add({ requestId: 'help-2', role: 'tutor', type: 'answer', payload: {} });

    expect(store.since('help-1', 'tutor').messages).toHaveLength(1);
    expect(store.since('help-2', 'learner').messages).toHaveLength(1);
  });

  it('bounds the number of messages kept per request', () => {
    const { store } = makeStore();

    for (let index = 0; index < 5; index += 1) {
      store.add({
        requestId: 'help-1',
        role: 'learner',
        type: 'ice-candidate',
        payload: { index },
      });
    }

    const result = store.since('help-1', 'tutor');
    expect(result.messages).toHaveLength(3);
    expect(result.messages.map((message) => message.id)).toEqual([3, 4, 5]);
  });

  it('drops messages after ten minutes', () => {
    const { store, advance } = makeStore();

    store.add({ requestId: 'help-1', role: 'learner', type: 'offer', payload: {} });
    advance(11 * 60 * 1_000);

    expect(store.since('help-1', 'tutor').messages).toEqual([]);
    expect(store.has('help-1')).toBe(false);
  });

  it('validates the role, type and payload size', () => {
    const { store } = makeStore();

    expect(() =>
      store.add({
        requestId: 'help-1',
        role: 'admin' as never,
        type: 'offer',
        payload: {},
      }),
    ).toThrow(HelpValidationError);

    expect(() =>
      store.add({
        requestId: 'help-1',
        role: 'learner',
        type: 'hack' as never,
        payload: {},
      }),
    ).toThrow(HelpValidationError);

    expect(() =>
      store.add({
        requestId: '',
        role: 'learner',
        type: 'offer',
        payload: {},
      }),
    ).toThrow(HelpValidationError);

    expect(() =>
      store.add({
        requestId: 'help-1',
        role: 'learner',
        type: 'offer',
        payload: { sdp: 'x'.repeat(70_000) },
      }),
    ).toThrow(/too large/i);
  });

  it('clears a room when a session ends', () => {
    const { store } = makeStore();

    store.add({ requestId: 'help-1', role: 'learner', type: 'offer', payload: {} });
    store.clear('help-1');

    expect(store.has('help-1')).toBe(false);
  });
});
