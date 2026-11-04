import assert from 'node:assert/strict';
import test from 'node:test';
import { getGmail, getMessageDetails } from './gmail.js';

const response = (status, data = {}, retryAfter = null) => ({
  ok: status === 200,
  status,
  json: async () => data,
  headers: { get: () => retryAfter },
});

test('rate-limited reads recover after waiting, including Retry-After', async () => {
  const responses = [response(429, {}, '3'), response(200, { id: 'email' })];
  const delays = [];
  const result = await getGmail('/messages/email', 'test-token', {
    fetchImpl: async () => responses.shift(),
    sleep: async (ms) => delays.push(ms),
  });
  assert.deepEqual(result, { id: 'email' });
  assert.equal(delays.length, 1);
  assert.ok(delays[0] >= 3000);
});

test('persistent rate limits stop after bounded retries with increasing delays', async () => {
  let calls = 0;
  const delays = [];
  await assert.rejects(getGmail('/messages', 'test-token', {
    fetchImpl: async () => { calls++; return response(429); },
    sleep: async (ms) => delays.push(ms),
  }), /Gmail is limiting requests/);
  assert.equal(calls, 5);
  assert.equal(delays.length, 4);
  assert.ok(delays.every((ms, i) => i === 0 || ms > delays[i - 1]));
});

test('authentication failures do not retry', async () => {
  let calls = 0;
  await assert.rejects(getGmail('/messages', 'test-token', {
    fetchImpl: async () => { calls++; return response(401); },
    sleep: async () => assert.fail('Must not wait for an auth failure'),
  }), /session expired/);
  assert.equal(calls, 1);
});

test('long server cooldowns return an error without retrying early', async () => {
  await assert.rejects(getGmail('/messages', 'test-token', {
    fetchImpl: async () => response(429, {}, '120'),
    sleep: async () => assert.fail('Must return control during a long cooldown'),
  }), /Gmail is limiting requests/);
});

test('message reads stay sequential and keep their order', async () => {
  let active = 0;
  let peak = 0;
  const messages = Array.from({ length: 50 }, (_, id) => ({ id: String(id) }));
  const result = await getMessageDetails(messages, 'test-token', {
    fetchImpl: async (url) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return response(200, { id: new URL(url).pathname.split('/').pop() });
    },
  });
  assert.equal(peak, 1);
  assert.deepEqual(result, messages);
});

test('a failed message stops the queue instead of launching remaining reads', async () => {
  let calls = 0;
  await assert.rejects(getMessageDetails([{ id: '1' }, { id: '2' }], 'test-token', {
    fetchImpl: async () => { calls++; return response(403); },
  }), /403/);
  assert.equal(calls, 1);
});
