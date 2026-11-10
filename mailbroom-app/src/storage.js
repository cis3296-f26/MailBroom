import { Preferences } from '@capacitor/preferences';

export function createEmailStorage(preferences = Preferences) {
  async function readList(key) {
    const { value } = await preferences.get({ key });
    return JSON.parse(value || '[]');
  }

  async function writeList(key, emails) {
    await preferences.set({ key, value: JSON.stringify(emails) });
  }

  async function saveEmail(key, email) {
    const saved = await readList(key);
    if (!saved.includes(email)) {
      saved.push(email);
      await writeList(key, saved);
    }
  }

  return {
    saveUnsubscribedEmail: (email) => saveEmail('unsubscribedEmails', email),
    isAlreadyUnsubscribed: async (email) =>
      (await readList('unsubscribedEmails')).includes(email),
    removeUnsubscribedEmail: async (email) => {
      const saved = await readList('unsubscribedEmails');
      await writeList('unsubscribedEmails', saved.filter((item) => item !== email));
    },
    saveKeptEmail: (email) => saveEmail('keptEmails', email),
    isAlreadyKept: async (email) => (await readList('keptEmails')).includes(email),
  };
}

const emailStorage = createEmailStorage();

export const {
  saveUnsubscribedEmail,
  isAlreadyUnsubscribed,
  removeUnsubscribedEmail,
  saveKeptEmail,
  isAlreadyKept,
} = emailStorage;