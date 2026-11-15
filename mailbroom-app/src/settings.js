import { Preferences } from '@capacitor/preferences';

export const DEFAULT_SETTINGS = Object.freeze({ emailsPerSession: 50, swipePreference: 'both' });
export const SWIPE_PREFERENCES = ['swipe', 'buttons', 'both'];

export function normalizeSettings(value = {}) {
  return {
    emailsPerSession: DEFAULT_SETTINGS.emailsPerSession,
    swipePreference: SWIPE_PREFERENCES.includes(value?.swipePreference) ? value.swipePreference : DEFAULT_SETTINGS.swipePreference,
  };
}

export function swipeAction(dx, preference = 'both') {
  if (preference === 'buttons') return null;
  const keep = dx > 0;
  return keep ? 'keep' : 'unsubscribe';
}

export function createSettingsStore(preferences = Preferences) {
  return {
    async read() {
      const { value } = await preferences.get({ key: 'appSettings' });
      return normalizeSettings(value ? JSON.parse(value) : DEFAULT_SETTINGS);
    },
    async save(value) {
      const settings = normalizeSettings(value);
      await preferences.set({ key: 'appSettings', value: JSON.stringify(settings) });
      return settings;
    },
  };
}

export const settingsStore = createSettingsStore();
