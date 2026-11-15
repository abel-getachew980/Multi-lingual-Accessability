/**
 * TwiML helpers.
 *
 * Every message is returned as its own <Message> element so Twilio sends the
 * segments in order. Content is escaped because course answers may contain
 * `&`, `<` or `>`.
 */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildTwiml(messages: readonly string[]): string {
  const body = messages
    .filter((message) => message.trim().length > 0)
    .map((message) => `  <Message>${escapeXml(message)}</Message>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body ? `\n${body}\n` : ''}</Response>`;
}
