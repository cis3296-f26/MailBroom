import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmailStorage } from './storage.js';

function createMemoryPreferences() {
  const values = new Map();
  return {
    async get({ key }) {
      return { value: values.get(key) ?? null };
    },
    async set({ key, value }) {
      values.set(key, value);
    },
  };
}

test('unsubscribed addresses can be saved once and removed', async () => {
  const storage = createEmailStorage(createMemoryPreferences());

  await storage.saveUnsubscribedEmail('news@example.com');
  await storage.saveUnsubscribedEmail('news@example.com');
  assert.equal(await storage.isAlreadyUnsubscribed('news@example.com'), true);

  await storage.removeUnsubscribedEmail('news@example.com');
  assert.equal(await storage.isAlreadyUnsubscribed('news@example.com'), false);
});

test('kept addresses are stored separately from unsubscribed addresses', async () => {
  const storage = createEmailStorage(createMemoryPreferences());

  await storage.saveKeptEmail('news@example.com');
  assert.equal(await storage.isAlreadyKept('news@example.com'), true);
  assert.equal(await storage.isAlreadyUnsubscribed('news@example.com'), false);
});
