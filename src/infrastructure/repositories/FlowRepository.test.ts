import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { FlowRepository } from './FlowRepository';

const BASE = 'http://localhost/api';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const repo = () => new FlowRepository(axios.create({ baseURL: BASE }));

const FLOW = {
  id: 'f1',
  api_name: 'research',
  display_name: 'Research',
  description: null,
  enabled: true,
  slash_api_name: null,
  exposed_as_slash: false,
  metadata: {},
  definition: 'd',
  nodes: [],
  edges: [],
};

describe('FlowRepository', () => {
  it('list + get map flows', async () => {
    server.use(
      http.get(`${BASE}/flows`, () => HttpResponse.json([FLOW])),
      http.get(`${BASE}/flows/f1`, () => HttpResponse.json(FLOW)),
    );
    expect((await repo().list())[0]).toMatchObject({ apiName: 'research' });
    expect(await repo().get('f1')).toMatchObject({ id: 'f1' });
  });

  it('saveFromYaml flags created=true on 201, false otherwise', async () => {
    server.use(http.post(`${BASE}/flows/from-yaml`, () => HttpResponse.json(FLOW, { status: 201 })));
    expect((await repo().saveFromYaml('yaml')).created).toBe(true);

    server.use(http.post(`${BASE}/flows/from-yaml`, () => HttpResponse.json(FLOW, { status: 200 })));
    expect((await repo().saveFromYaml('yaml')).created).toBe(false);
  });

  it('saveFromYamlById always reports created=false (update)', async () => {
    server.use(http.put(`${BASE}/flows/f1/from-yaml`, () => HttpResponse.json(FLOW)));
    const res = await repo().saveFromYamlById('f1', 'yaml');
    expect(res.created).toBe(false);
    expect(res.flow.id).toBe('f1');
  });

  it('validateYaml passes the result through', async () => {
    server.use(
      http.post(`${BASE}/flows/validate-yaml`, () =>
        HttpResponse.json({ valid: false, errors: [{ path: 'a', message: 'bad' }] }),
      ),
    );
    expect(await repo().validateYaml('y')).toEqual({ valid: false, errors: [{ path: 'a', message: 'bad' }] });
  });

  it('updateFlow PATCHes /flows/{id} with only the provided fields (snake_case)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/flows/f1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...FLOW, enabled: false });
      }),
    );
    const flow = await repo().updateFlow('f1', { enabled: false });
    // Omitted fields are NOT sent (so they stay unchanged server-side).
    expect(body).toEqual({ enabled: false });
    expect(flow.enabled).toBe(false);
  });

  it('updateFlow sends display_name + description when provided (description nullable)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/flows/f1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(FLOW);
      }),
    );
    await repo().updateFlow('f1', { displayName: 'R2', description: null });
    expect(body).toEqual({ display_name: 'R2', description: null });
  });

  it('updateSlashExposure builds the body (incl. clear flag)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/flows/f1/slash-exposure`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(FLOW);
      }),
    );
    await repo().updateSlashExposure('f1', { slashApiName: 'r', exposedAsSlash: true, clearSlashApiName: true });
    expect(body).toEqual({ slash_api_name: 'r', exposed_as_slash: true, clear_slash_api_name: true });
  });
});
