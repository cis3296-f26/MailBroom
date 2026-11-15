import assert from 'node:assert/strict';
import test from 'node:test';
import { createReviewHistory, summarizeHistory } from './history.js';

function memoryPreferences() {
  const values = new Map();
  return {
    async get({ key }) { return { value: values.get(key) ?? null }; },
    async set({ key, value }) { values.set(key, value); },
  };
}

test('history survives reopening and replaces repeat decisions for the same sender', async () => {
  const preferences = memoryPreferences();
  const history = createReviewHistory(preferences);
  await history.save({ from: 'News <NEWS@example.com>' }, 'kept');
  await history.save({ from: 'News <news@example.com>' }, 'requested');
  const entries = await createReviewHistory(preferences).read();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].email, 'news@example.com');
  assert.equal(entries[0].outcome, 'requested');
});

test('concurrent review decisions are saved without losing senders, newest first', async () => {
  const history = createReviewHistory(memoryPreferences());
  await Promise.all([
    history.save({ from: 'a@example.com' }, 'kept'),
    history.save({ from: 'b@example.com' }, 'requested'),
    history.save({ from: 'c@example.com' }, 'filtered'),
  ]);
  const entries = await history.read();
  assert.deepEqual(entries.map((entry) => entry.email), ['c@example.com', 'b@example.com', 'a@example.com']);
  const kept = summarizeHistory(entries, 'kept');
  assert.deepEqual([kept.reviewed, kept.kept, kept.removed], [3, 1, 2]);
  assert.equal(kept.entries.length, 1);
  assert.equal(summarizeHistory(entries, 'removed').entries.length, 2);
  assert.equal(summarizeHistory([], 'all').reviewed, 0);
});

test('a failed history save does not prevent later saves', async () => {
  const preferences = memoryPreferences();
  const set = preferences.set;
  let failNext = true;
  preferences.set = async (args) => {
    if (failNext) { failNext = false; throw new Error('Storage unavailable'); }
    return set(args);
  };
  const history = createReviewHistory(preferences);
  await assert.rejects(history.save({ from: 'a@example.com' }, 'kept'));
  await history.save({ from: 'b@example.com' }, 'requested');
  assert.equal((await history.read())[0].email, 'b@example.com');
});
