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
  const testUser = 'user@gmail.com'; // Define a test user

  await storage.saveUnsubscribedEmail(testUser, 'news@example.com');
  await storage.saveUnsubscribedEmail(testUser, 'news@example.com'); // Save again to test deduplication
  assert.equal(await storage.isAlreadyUnsubscribed(testUser, 'news@example.com'), true);

  await storage.removeUnsubscribedEmail(testUser, 'news@example.com');
  assert.equal(await storage.isAlreadyUnsubscribed(testUser, 'news@example.com'), false);
});

test('kept addresses are stored separately from unsubscribed addresses', async () => {
  const storage = createEmailStorage(createMemoryPreferences());
  const testUser = 'user@gmail.com'; // Define a test user

  await storage.saveKeptEmail(testUser, 'news@example.com');
  assert.equal(await storage.isAlreadyKept(testUser, 'news@example.com'), true);
  assert.equal(await storage.isAlreadyUnsubscribed(testUser, 'news@example.com'), false);
});