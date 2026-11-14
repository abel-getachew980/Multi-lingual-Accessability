import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySessionStore } from './sessionManager';

test('creates a session with the default language', () => {
  let now = 0;
  const store = new InMemorySessionStore(1_000, () => now);

  const session = store.getOrCreate('+251911111111', 'am');

  assert.equal(session.language, 'am');
  assert.deepEqual(session.pendingChunks, []);
  assert.equal(store.size, 1);
});

test('returns the same session for an existing phone number', () => {
  const store = new InMemorySessionStore(1_000);
  const first = store.getOrCreate('+251911111111', 'am');

  first.language = 'en';
  store.save(first);

  const second = store.getOrCreate('+251911111111', 'am');
  assert.equal(second.language, 'en');
});

test('expires sessions after the ttl', () => {
  let now = 0;
  const store = new InMemorySessionStore(1_000, () => now);

  store.getOrCreate('+251911111111', 'en');

  now = 500;
  assert.ok(store.get('+251911111111'));

  now = 1_500;
  assert.equal(store.get('+251911111111'), undefined);
  assert.equal(store.size, 0);
});

test('save refreshes the activity timestamp', () => {
  let now = 0;
  const store = new InMemorySessionStore(1_000, () => now);
  const session = store.getOrCreate('+251911111111', 'am');

  now = 900;
  store.save(session);

  now = 1_500;
  assert.ok(store.get('+251911111111'));
});

test('prune removes only expired sessions', () => {
  let now = 0;
  const store = new InMemorySessionStore(1_000, () => now);

  store.getOrCreate('old', 'am');

  now = 900;
  store.getOrCreate('fresh', 'am');

  now = 1_100;
  store.prune();

  assert.equal(store.get('old'), undefined);
  assert.ok(store.get('fresh'));
});
