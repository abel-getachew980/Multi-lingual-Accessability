/**
 * @jest-environment node
 */

import { POST, GET } from '@/app/api/telegram/route';
import { botEndpoint } from '@/services/telegram/webhookEndpoint';

const originalEnv = { ...process.env };

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function update(updateId = 1): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: 1,
      date: 1_700_000_000,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Learner' },
      text: 'ሰላም',
    },
  };
}

function okResponse(status = 200): Response {
  return { ok: status >= 200 && status < 300, status } as unknown as Response;
}

let fetchMock: jest.Mock;

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.TELEGRAM_BOT_URL;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_WEBHOOK_PATH;
  setNodeEnv('test');

  fetchMock = jest.fn().mockResolvedValue(okResponse());
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('POST /api/telegram', () => {
  it('returns 503 when the bot URL is missing', async () => {
    const response = await POST(jsonRequest(update()));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'bot_not_configured' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to run in production without a secret', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';
    setNodeEnv('production');

    const response = await POST(jsonRequest(update()));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'webhook_secret_missing' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing or incorrect secret', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';

    const missing = await POST(jsonRequest(update()));
    expect(missing.status).toBe(401);

    const wrong = await POST(
      jsonRequest(update(), { 'x-telegram-bot-api-secret-token': 'nope' }),
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({
      error: { code: 'unauthorized' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards a valid update with the secret header', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';

    const response = await POST(
      jsonRequest(update(7), { 'x-telegram-bot-api-secret-token': 'secret' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3002/telegram');
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': 'secret',
    });
    expect(JSON.parse(init.body)).toMatchObject({ update_id: 7 });
  });

  it('uses a custom webhook path and avoids doubling it', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002/hook';
    process.env.TELEGRAM_WEBHOOK_PATH = '/hook';

    await POST(jsonRequest(update()));

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3002/hook');
  });

  it('forwards without a secret in development', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002/';

    const response = await POST(jsonRequest(update()));

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3002/telegram');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      'x-telegram-bot-api-secret-token',
    );
  });

  it('rejects malformed JSON', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';

    const response = await POST(
      new Request('http://localhost/api/telegram', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_json' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a body that is not an update', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';

    const response = await POST(jsonRequest({ hello: 'world' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_update' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the bot rejects the forward', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';
    fetchMock.mockResolvedValue(okResponse(500));

    const response = await POST(jsonRequest(update()));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: 'bot_forward_failed' },
    });
  });

  it('returns 502 when the bot is unreachable', async () => {
    process.env.TELEGRAM_BOT_URL = 'http://localhost:3002';
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await POST(jsonRequest(update()));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: 'bot_unreachable' },
    });
  });
});

describe('GET /api/telegram', () => {
  it('explains that Telegram uses POST', async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({
      error: { code: 'method_not_allowed' },
    });
  });
});

describe('botEndpoint', () => {
  it('strips trailing slashes and appends the path', () => {
    expect(botEndpoint('http://localhost:3002/')).toBe(
      'http://localhost:3002/telegram',
    );
  });

  it('keeps a URL that already has the path', () => {
    expect(botEndpoint('http://localhost:3002/telegram')).toBe(
      'http://localhost:3002/telegram',
    );
  });
});
