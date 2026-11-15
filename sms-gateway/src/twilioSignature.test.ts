import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTwilioSignature, isValidTwilioSignature } from './twilioSignature';

const AUTH_TOKEN = 'test-auth-token';
const URL = 'https://example.com/api/sms';
const PARAMS = { From: '+251911111111', Body: 'ሰላም', MessageSid: 'SM123' };

test('accepts a signature produced with the same token, URL and params', () => {
  const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);

  assert.equal(
    isValidTwilioSignature(AUTH_TOKEN, signature, URL, PARAMS),
    true,
  );
});

test('is independent of parameter order', () => {
  const reordered = {
    MessageSid: PARAMS.MessageSid,
    Body: PARAMS.Body,
    From: PARAMS.From,
  };
  const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);

  assert.equal(isValidTwilioSignature(AUTH_TOKEN, signature, URL, reordered), true);
});

test('rejects a signature for different parameters', () => {
  const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);

  assert.equal(
    isValidTwilioSignature(AUTH_TOKEN, signature, URL, {
      ...PARAMS,
      Body: 'different message',
    }),
    false,
  );
});

test('rejects a signature for a different URL', () => {
  const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);

  assert.equal(
    isValidTwilioSignature(AUTH_TOKEN, signature, 'https://example.com/other', PARAMS),
    false,
  );
});

test('rejects missing and malformed signatures', () => {
  assert.equal(isValidTwilioSignature(AUTH_TOKEN, undefined, URL, PARAMS), false);
  assert.equal(isValidTwilioSignature(AUTH_TOKEN, 'not-base64', URL, PARAMS), false);
  assert.equal(isValidTwilioSignature(AUTH_TOKEN, '', URL, PARAMS), false);
});
