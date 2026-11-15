import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettingsStore, DEFAULT_SETTINGS, normalizeSettings, swipeAction } from './settings.js';

test('preferences default safely when values are missing or unsupported', () => {
  assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ emailsPerSession: 999, swipePreference: 'anything' }), DEFAULT_SETTINGS);
});

test('saved preferences survive reopening the settings store', async () => {
  let value = null;
  const preferences = { get: async () => ({ value }), set: async (entry) => { value = entry.value; } };
  const store = createSettingsStore(preferences);
  assert.deepEqual(await store.read(), DEFAULT_SETTINGS);
  await store.save({ emailsPerSession: 25, swipePreference: 'buttons' });
  assert.deepEqual(await createSettingsStore(preferences).read(), { emailsPerSession: 50, swipePreference: 'buttons' });
});

test('swipe-only and both use the same directions, while buttons-only disables gestures', () => {
  for (const mode of ['swipe', 'both']) {
    assert.equal(normalizeSettings({ swipePreference: mode }).swipePreference, mode);
    assert.equal(swipeAction(-120, mode), 'unsubscribe');
    assert.equal(swipeAction(120, mode), 'keep');
  }
  assert.equal(swipeAction(-120, 'buttons'), null);
  assert.equal(swipeAction(120, 'buttons'), null);
});

test('previous direction-based preferences fall back to both controls', () => {
  assert.equal(normalizeSettings({ swipePreference: 'standard' }).swipePreference, 'both');
  assert.equal(normalizeSettings({ swipePreference: 'reversed' }).swipePreference, 'both');
});

test('storage failures are reported rather than claiming preferences were saved', async () => {
  const store = createSettingsStore({ set: async () => { throw new Error('Storage unavailable'); } });
  await assert.rejects(store.save(DEFAULT_SETTINGS), /Storage unavailable/);
});
