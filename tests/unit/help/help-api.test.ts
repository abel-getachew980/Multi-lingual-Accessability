/**
 * @jest-environment node
 */

import { helpQueue, signalStore } from '@/services/help';
import { POST, GET, DELETE } from '@/app/api/help/route';
import {
  GET as getById,
  DELETE as deleteById,
  PATCH as patchById,
} from '@/app/api/help/[id]/route';
import {
  POST as postSignal,
  GET as getSignal,
} from '@/app/api/help/signal/route';

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function params(id: string) {
  return { params: { id } };
}

async function createTicket(
  userId = 'learner-1',
  extra: Record<string, unknown> = {},
) {
  const response = await POST(
    jsonRequest('http://localhost/api/help', 'POST', { userId, ...extra }),
  );

  return { response, body: await response.json() };
}

beforeEach(() => {
  helpQueue.clear();
  signalStore.reset();
  delete process.env.HELP_TUTOR_KEY;
});

afterAll(() => {
  delete process.env.HELP_TUTOR_KEY;
});

describe('POST /api/help', () => {
  it('creates a pending request with both requestId and id', async () => {
    const { response, body } = await createTicket('learner-1', {
      language: 'en',
      channel: 'web',
      conversationHistory: [{ role: 'user', content: 'What is a cell?' }],
    });

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      status: 'pending',
      position: 1,
      estimatedWaitMinutes: 2,
      channel: 'web',
      language: 'en',
    });
    expect(body.requestId).toBe(body.id);
    expect(typeof body.requestId).toBe('string');
    expect(body.reused).toBe(false);
  });

  it('returns the active request instead of creating a duplicate', async () => {
    const first = await createTicket('learner-1');
    const second = await createTicket('learner-1');

    expect(second.response.status).toBe(200);
    expect(second.body.requestId).toBe(first.body.requestId);
    expect(second.body.reused).toBe(true);
    expect(helpQueue.stats().pending).toBe(1);
  });

  it('keeps the SMS gateway contract intact', async () => {
    const { response, body } = await createTicket('sms:+251911000000', {
      channel: 'sms',
      phoneNumber: '+251911000000',
      language: 'am',
      conversationHistory: [{ role: 'user', content: 'ሰላም' }],
    });

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      requestId: expect.any(String),
      status: 'pending',
      channel: 'sms',
    });
  });

  it('rejects malformed JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: 'invalid_json' },
    });
  });

  it('rejects a missing userId', async () => {
    const response = await POST(
      jsonRequest('http://localhost/api/help', 'POST', { language: 'am' }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: 'invalid_request' },
    });
  });

  it('returns 429 with Retry-After during the cooldown', async () => {
    const first = await createTicket('learner-1');
    await deleteById(
      new Request(`http://localhost/api/help/${first.body.id}`, {
        method: 'DELETE',
      }),
      params(first.body.id),
    );

    const response = await POST(
      jsonRequest('http://localhost/api/help', 'POST', { userId: 'learner-1' }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: 'cooldown' },
    });
  });
});

describe('GET /api/help', () => {
  it('returns the ticket by id', async () => {
    const created = await createTicket('learner-1');

    const response = await GET(
      new Request(`http://localhost/api/help?id=${created.body.id}`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      id: created.body.id,
      status: 'pending',
    });
  });

  it('returns queue statistics without an id', async () => {
    await createTicket('learner-1');
    await createTicket('learner-2');

    const response = await GET(new Request('http://localhost/api/help'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queue).toMatchObject({ pending: 2, total: 2 });
  });

  it('returns 404 for an unknown id', async () => {
    const response = await GET(
      new Request('http://localhost/api/help?id=help-missing'),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ success: false });
  });
});

describe('DELETE /api/help', () => {
  it('cancels from the query string', async () => {
    const created = await createTicket('learner-1');

    const response = await DELETE(
      new Request(`http://localhost/api/help?id=${created.body.id}`, {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'cancelled' });
  });

  it('accepts the id in a JSON body', async () => {
    const created = await createTicket('learner-1');

    const response = await DELETE(
      jsonRequest('http://localhost/api/help', 'DELETE', {
        requestId: created.body.id,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'cancelled' });
  });

  it('requires an id', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/help', { method: 'DELETE' }),
    );

    expect(response.status).toBe(400);
  });
});

describe('/api/help/[id]', () => {
  it('reads a single ticket', async () => {
    const created = await createTicket('learner-1');

    const response = await getById(
      new Request(`http://localhost/api/help/${created.body.id}`),
      params(created.body.id),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.body.id });
  });

  it('cancels a ticket and clears its signaling room', async () => {
    const created = await createTicket('learner-1');
    signalStore.add({
      requestId: created.body.id,
      role: 'learner',
      type: 'offer',
      payload: { sdp: 'v=0' },
    });

    const response = await deleteById(
      new Request(`http://localhost/api/help/${created.body.id}`, {
        method: 'DELETE',
      }),
      params(created.body.id),
    );

    expect(response.status).toBe(200);
    expect(signalStore.has(created.body.id)).toBe(false);
  });

  it('allows tutor actions when no key is configured outside production', async () => {
    const created = await createTicket('learner-1');

    const response = await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'connected', tutorId: 'tutor-sara' },
      ),
      params(created.body.id),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'connected',
      assignedTutor: 'tutor-sara',
      position: 0,
    });
  });

  it('requires the tutor key when it is configured', async () => {
    process.env.HELP_TUTOR_KEY = 'secret-key';
    const created = await createTicket('learner-1');

    const forbidden = await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'connected' },
      ),
      params(created.body.id),
    );

    expect(forbidden.status).toBe(403);

    const wrongKey = await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'connected' },
        { 'x-help-tutor-key': 'nope' },
      ),
      params(created.body.id),
    );

    expect(wrongKey.status).toBe(403);

    const allowed = await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'connected', tutorId: 'tutor-sara' },
        { 'x-help-tutor-key': 'secret-key' },
      ),
      params(created.body.id),
    );

    expect(allowed.status).toBe(200);
  });

  it('rejects an unknown or repeated transition', async () => {
    const created = await createTicket('learner-1');

    const invalid = await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'exploded' },
      ),
      params(created.body.id),
    );
    expect(invalid.status).toBe(400);

    await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'resolved' },
      ),
      params(created.body.id),
    );

    const conflict = await patchById(
      jsonRequest(
        `http://localhost/api/help/${created.body.id}`,
        'PATCH',
        { status: 'in_progress' },
      ),
      params(created.body.id),
    );
    expect(conflict.status).toBe(409);
  });
});

describe('/api/help/signal', () => {
  async function startRequest(userId = 'learner-1') {
    const created = await createTicket(userId);
    return created.body.id as string;
  }

  it('exchanges an offer from the learner to the tutor', async () => {
    const requestId = await startRequest();

    const posted = await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId,
        role: 'learner',
        type: 'offer',
        payload: { sdp: 'v=0' },
      }),
    );
    expect(posted.status).toBe(200);

    const polled = await getSignal(
      new Request(
        `http://localhost/api/help/signal?requestId=${requestId}&role=tutor&since=0`,
      ),
    );
    const body = await polled.json();

    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({ role: 'learner', type: 'offer' });
    expect(body.nextSince).toBeGreaterThan(0);
  });

  it("does not echo a role's own messages", async () => {
    const requestId = await startRequest();

    await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId,
        role: 'learner',
        type: 'offer',
        payload: {},
      }),
    );

    const polled = await getSignal(
      new Request(
        `http://localhost/api/help/signal?requestId=${requestId}&role=learner`,
      ),
    );

    expect((await polled.json()).messages).toEqual([]);
  });

  it('returns only messages after the cursor', async () => {
    const requestId = await startRequest();

    const first = await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId,
        role: 'learner',
        type: 'offer',
        payload: {},
      }),
    );
    const firstBody = await first.json();

    await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId,
        role: 'learner',
        type: 'ice-candidate',
        payload: { candidate: 'abc' },
      }),
    );

    const polled = await getSignal(
      new Request(
        `http://localhost/api/help/signal?requestId=${requestId}&role=tutor&since=${firstBody.id}`,
      ),
    );
    const body = await polled.json();

    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].type).toBe('ice-candidate');
  });

  it('validates the request and the role', async () => {
    const missing = await getSignal(
      new Request('http://localhost/api/help/signal?role=tutor'),
    );
    expect(missing.status).toBe(400);

    const badRole = await getSignal(
      new Request('http://localhost/api/help/signal?requestId=x&role=hacker'),
    );
    expect(badRole.status).toBe(400);

    const badSince = await getSignal(
      new Request('http://localhost/api/help/signal?requestId=x&role=tutor&since=-1'),
    );
    expect(badSince.status).toBe(400);

    const invalidJson = await postSignal(
      new Request('http://localhost/api/help/signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'nope',
      }),
    );
    expect(invalidJson.status).toBe(400);
  });

  it('rejects signals for an unknown request', async () => {
    const response = await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId: 'help-missing',
        role: 'learner',
        type: 'offer',
        payload: {},
      }),
    );

    expect(response.status).toBe(404);
  });

  it('refuses tutor signals without the tutor key when configured', async () => {
    process.env.HELP_TUTOR_KEY = 'secret-key';
    const requestId = await startRequest();

    const response = await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId,
        role: 'tutor',
        type: 'answer',
        payload: {},
      }),
    );

    expect(response.status).toBe(403);
  });

  it('stops signaling once the request has ended', async () => {
    const requestId = await startRequest();

    await DELETE(
      new Request(`http://localhost/api/help?id=${requestId}`, {
        method: 'DELETE',
      }),
    );

    const response = await postSignal(
      jsonRequest('http://localhost/api/help/signal', 'POST', {
        requestId,
        role: 'learner',
        type: 'offer',
        payload: {},
      }),
    );

    expect(response.status).toBe(409);
  });
});
