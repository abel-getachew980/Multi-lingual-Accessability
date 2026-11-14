import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * SMS webhook for Twilio (or a compatible provider).
 *
 * The heavy lifting lives in the standalone SMS gateway (`sms-gateway/`) so it
 * can keep running independently of the app deployment. This route verifies
 * the Twilio signature and forwards the request to `SMS_GATEWAY_URL`.
 *
 * Point Twilio at either this route or the gateway directly - see
 * `sms-gateway/README.md`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

const APOLOGY =
  'SMS service is temporarily unavailable. Please try again. / አገልግሎቱ ለጊዜው አይገኝም። እባክዎ በኋላ ይሞክሩ።';

function twiml(messages: string[]): string {
  const body = messages
    .map(
      (message) =>
        `  <Message>${message
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</Message>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body ? `\n${body}\n` : ''}</Response>`;
}

function verifyTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;

  const signedPayload = Object.keys(params)
    .sort()
    .reduce((payload, key) => payload + key + params[key], url);

  const expected = createHmac('sha1', authToken)
    .update(Buffer.from(signedPayload, 'utf-8'))
    .digest('base64');

  const provided = Buffer.from(signature, 'utf-8');
  const computed = Buffer.from(expected, 'utf-8');

  return provided.length === computed.length && timingSafeEqual(provided, computed);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};

    for (const [key, value] of Array.from(formData.entries())) {
      if (typeof value === 'string') params[key] = value;
    }

    const authToken = process.env.SMS_AUTH_TOKEN;
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? process.env.SMS_WEBHOOK_URL;

    if (authToken && webhookUrl) {
      const signature = request.headers.get('x-twilio-signature');
      if (!verifyTwilioSignature(authToken, signature, webhookUrl, params)) {
        return new NextResponse('Invalid signature', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }

    const from = params.From ?? params.from;
    const body = params.Body ?? params.text ?? params.body;

    if (!from || body === undefined) {
      return new NextResponse(twiml([]), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const gatewayUrl = (process.env.SMS_GATEWAY_URL ?? 'http://localhost:3001').replace(
      /\/+$/,
      '',
    );

    const response = await fetch(`${gatewayUrl}/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(request.headers.get('x-twilio-signature')
          ? { 'X-Twilio-Signature': request.headers.get('x-twilio-signature') as string }
          : {}),
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`SMS gateway responded with ${response.status}`);
    }

    const xml = await response.text();

    return new NextResponse(xml || EMPTY_TWIML, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[sms] webhook failed', error);

    return new NextResponse(twiml([APOLOGY]), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Use POST for SMS webhooks.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
