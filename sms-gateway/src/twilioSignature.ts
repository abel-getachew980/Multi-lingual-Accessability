import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Twilio request validation.
 *
 * Twilio signs the full webhook URL plus all POST parameters (sorted by key)
 * with HMAC-SHA1 using the account auth token, then sends the base64 digest in
 * `X-Twilio-Signature`.
 *
 * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const signedPayload = Object.keys(params)
    .sort()
    .reduce((payload, key) => payload + key + params[key], url);

  return createHmac('sha1', authToken).update(Buffer.from(signedPayload, 'utf-8')).digest('base64');
}

export function isValidTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;

  const expected = computeTwilioSignature(authToken, url, params);
  const provided = Buffer.from(signature, 'utf-8');
  const computed = Buffer.from(expected, 'utf-8');

  if (provided.length !== computed.length) return false;

  return timingSafeEqual(provided, computed);
}
