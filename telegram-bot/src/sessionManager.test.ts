import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySessionStore } from './sessionManager';

test('creates a session with the default language', () => {
  const store = new InMemorySessionStore(60_000);
  const session = store.getOrCreate('42', 'am');

  assert.equal(session.chatId, '42');
  assert.equal(session.language, 'am');
  assert.deepEqual(session.history, []);
  assert.equal(store.get('42'), session);
  assert.equal(store.size, 1);
});

test('returns the same session for repeated lookups', () => {
  const store = new InMemorySessionStore(60_000);
  const first = store.getOrCreate('42', 'en');
  const second = store.getOrCreate('42', 'am');

  assert.equal(first, second);
  assert.equal(second.language, 'en');
});

test('expires a session after the ttl', () => {
  let now = 1_000;
  const store = new InMemorySessionStore(5_000, () => now);

  store.getOrCreate('42', 'am');
  now += 5_001;

  assert.equal(store.get('42'), undefined);
  assert.equal(store.size, 0);
});

test('saving refreshes the ttl', () => {
  let now = 1_000;
  const store = new InMemorySessionStore(5_000, () => now);
  const session = store.getOrCreate('42', 'am');

  now += 4_000;
  store.save(session);
  now += 4_000;

  assert.equal(store.get('42'), session);
});

test('prunes only expired sessions', () => {
  let now = 1_000;
  const store = new InMemorySessionStore(5_000, () => now);

  store.getOrCreate('old', 'am');
  now += 4_000;
  store.getOrCreate('fresh', 'en');
  now += 2_000;

  store.prune();

  assert.equal(store.get('old'), undefined);
  assert.ok(store.get('fresh'));
  assert.equal(store.size, 1);
});

test('deletes a session explicitly', () => {
  const store = new InMemorySessionStore(60_000);
  store.getOrCreate('42', 'am');
  store.delete('42');

  assert.equal(store.get('42'), undefined);
  assert.equal(store.size, 0);
});

test('rejects a nonsensical ttl', () => {
  assert.throws(() => new InMemorySessionStore(0), RangeError);
});
