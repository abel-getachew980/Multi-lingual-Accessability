/** @jest-environment node */

import { DELETE, GET, POST } from '@/app/api/help/route';
import { DELETE as deleteById, GET as getById } from '@/app/api/help/[id]/route';
import { helpQueue, resetHelpQueue } from '@/services/humanHelp';

function jsonRequest(url: string, body?: unknown, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  resetHelpQueue();
});

describe('/api/help', () => {
  it('creates a pending request with queue position', async () => {
    const response = await POST(jsonRequest('http://localhost/api/help', {
      userId: 'learner-1',
      conversationHistory: [],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe('pending');
    expect(body.position).toBe(1);
    expect(body.requestId).toBeTruthy();
  });

  it('rejects requests without a user id', async () => {
    const response = await POST(jsonRequest('http://localhost/api/help', {
      conversationHistory: [],
    }));

    expect(response.status).toBe(400);
  });

  it('returns status and queue position by id', async () => {
    const created = await (await POST(jsonRequest('http://localhost/api/help', {
      userId: 'learner-1',
      conversationHistory: [],
    }))).json();

    const response = await GET(
      new Request(`http://localhost/api/help?id=${created.requestId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('pending');
    expect(body.position).toBe(1);
    expect(body.estimatedWait).toBe('2 minutes');
  });


  it('reports a connected request and assigned tutor', async () => {
    const created = await (await POST(jsonRequest('http://localhost/api/help', {
      userId: 'learner-1',
      conversationHistory: [],
    }))).json();

    helpQueue.assignTutor(created.requestId, 'tutor-1');

    const response = await GET(
      new Request(`http://localhost/api/help?id=${created.requestId}`),
    );
    const body = await response.json();

    expect(body.status).toBe('connected');
    expect(body.tutorId).toBe('tutor-1');
  });

  it('returns 404 for an unknown request', async () => {
    const response = await GET(new Request('http://localhost/api/help?id=missing'));
    expect(response.status).toBe(404);
  });

  it('cancels a request', async () => {
    const created = await (await POST(jsonRequest('http://localhost/api/help', {
      userId: 'learner-1',
      conversationHistory: [],
    }))).json();

    const response = await DELETE(
      new Request(`http://localhost/api/help?id=${created.requestId}`, { method: 'DELETE' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});

describe('/api/help/[id]', () => {
  it('reads and deletes a request by path id', async () => {
    const created = await (await POST(jsonRequest('http://localhost/api/help', {
      userId: 'learner-1',
      conversationHistory: [],
    }))).json();

    const statusResponse = await getById(
      new Request(`http://localhost/api/help/${created.requestId}`),
      { params: { id: created.requestId } },
    );
    expect((await statusResponse.json()).status).toBe('pending');

    const deleteResponse = await deleteById(
      new Request(`http://localhost/api/help/${created.requestId}`, { method: 'DELETE' }),
      { params: { id: created.requestId } },
    );
    expect(deleteResponse.status).toBe(200);
  });
});
