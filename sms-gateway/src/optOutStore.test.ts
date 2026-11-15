import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOptOutStore } from './optOutStore';

test('tracks opt-outs per phone number', () => {
  const store = new InMemoryOptOutStore();

  assert.equal(store.isOptedOut('a'), false);
  store.optOut('a');
  assert.equal(store.isOptedOut('a'), true);
  assert.equal(store.isOptedOut('b'), false);
  assert.equal(store.size, 1);
});

test('opting in removes the number from the registry', () => {
  const store = new InMemoryOptOutStore();

  store.optOut('a');
  store.optIn('a');

  assert.equal(store.isOptedOut('a'), false);
  assert.equal(store.size, 0);
});

test('opting in an unknown number is a no-op', () => {
  const store = new InMemoryOptOutStore();
  store.optIn('missing');
  assert.equal(store.size, 0);
});
