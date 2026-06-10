import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AttachmentRepository } from './AttachmentRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new AttachmentRepository(axios.create({ baseURL: BASE }));

describe('AttachmentRepository', () => {
  it('upload posts to the attachments endpoint and maps the response', async () => {
    let hit = false;
    server.use(
      http.post(`${BASE}/conversations/c1/attachments`, () => {
        hit = true;
        return HttpResponse.json({
          id: 'a1',
          conversation_id: 'c1',
          message_id: null,
          filename: 'img.png',
          content_type: 'image/png',
          size_bytes: 4,
          uploaded_at: 'u',
          expired: false,
        });
      }),
    );
    const file = new File(['data'], 'img.png', { type: 'image/png' });
    const out = await repo().upload('c1', file);
    expect(hit).toBe(true);
    expect(out).toMatchObject({ id: 'a1', filename: 'img.png', contentType: 'image/png' });
  });

  it('fetchContent requests bytes and returns a Blob', async () => {
    server.use(
      http.get(`${BASE}/attachments/a1/content`, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('hello').buffer, {
          headers: { 'Content-Type': 'image/png' },
        }),
      ),
    );
    const blob = await repo().fetchContent('a1');
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe('hello');
  });
});
