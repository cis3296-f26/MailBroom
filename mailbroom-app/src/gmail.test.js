import assert from 'node:assert/strict';
import test from 'node:test';
import { GmailService } from './gmail.js';

const response = (status, data = {}) => ({
  ok: status === 200,
  status,
  json: async () => data,
  headers: { get: () => null },
});

function createService({ fetchImpl, sleep = async () => {} }) {
  const service = new GmailService({ fetchImpl, sleep });
  globalThis.window = {
    desktopAPI: { loginWithGoogle: async () => 'test-token' },
  };
  return service.authenticate().then(() => service);
}

test('rate-limited reads retry with increasing delays and then recover', async () => {
  const responses = [response(429), response(200, { id: 'email' })];
  const delays = [];
  const service = await createService({
    fetchImpl: async () => responses.shift(),
    sleep: async (ms) => delays.push(ms),
  });

  assert.deepEqual(await service.fetchPromotions('category:promotions'), { id: 'email' });
  assert.deepEqual(delays, [1000]);
});

test('persistent rate limits stop after bounded retries', async () => {
  let calls = 0;
  const delays = [];
  const service = await createService({
    fetchImpl: async () => {
      calls++;
      return response(429);
    },
    sleep: async (ms) => delays.push(ms),
  });

  await assert.rejects(service.fetchPromotions('category:promotions'), /Gmail API Error: 429/);
  assert.equal(calls, 5);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000]);
});

test('authentication failures do not retry', async () => {
  let calls = 0;
  const service = await createService({
    fetchImpl: async () => {
      calls++;
      return response(401);
    },
    sleep: async () => assert.fail('Must not wait for an auth failure'),
  });

  await assert.rejects(service.fetchPromotions('category:promotions'), /Gmail API Error: 401/);
  assert.equal(calls, 1);
});

test('message reads stay sequential and keep their order', async () => {
  let active = 0;
  let peak = 0;
  const messages = Array.from({ length: 5 }, (_, id) => ({ id: String(id) }));
  const service = await createService({
    fetchImpl: async (url) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return response(200, { id: new URL(url).pathname.split('/').pop() });
    },
  });
  service.beginLoading();

  const result = await service.fetchMessageDetails(messages);
  assert.equal(peak, 1);
  assert.deepEqual(result, messages);
});

test('a failed message is skipped and subsequent messages are still read', async () => {
  let calls = 0;
  const service = await createService({
    fetchImpl: async () => {
      calls++;
      return calls === 1 ? response(403) : response(200, { id: '2' });
    },
  });
  service.beginLoading();
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    assert.deepEqual(await service.fetchMessageDetails([{ id: '1' }, { id: '2' }]), [{ id: '2' }]);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls, 2);
});

test('Gmail scans stay fixed at 50 even with a previous custom session size', async () => {
  const urls = [];
  const service = await createService({ fetchImpl: async (url) => {
    urls.push(new URL(url));
    return response(200, { messages: [] });
  } });
  await service.loadSenders({ maxResults: 25 });
  assert.equal(urls[0].searchParams.get('maxResults'), '50');
  await service.fetchPromotions('category:promotions', undefined, 999);
  assert.equal(urls[1].searchParams.get('maxResults'), '50');
});

test('account profile requests use their own cancellation signal', async () => {
  const controller = new AbortController();
  const service = await createService({ fetchImpl: async (url, options) => {
    assert.equal(new URL(url).pathname, '/gmail/v1/users/me/profile');
    assert.equal(options.signal, controller.signal);
    return response(200, { emailAddress: 'test@example.com' });
  } });
  assert.deepEqual(await service.getProfile({ signal: controller.signal }), { emailAddress: 'test@example.com' });
});
