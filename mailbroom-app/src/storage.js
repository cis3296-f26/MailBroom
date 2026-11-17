import { Preferences } from '@capacitor/preferences';

export function createEmailStorage(preferences = Preferences) {
  async function readList(key) {
    const { value } = await preferences.get({ key });
    return JSON.parse(value || '[]');
  }

  async function writeList(key, emails) {
    await preferences.set({ key, value: JSON.stringify(emails) });
  }

  async function saveEmail(key, userEmail, email) {
    const finalKey = `${key}_${userEmail}`;
    const saved = await readList(finalKey);
    if (!saved.includes(email)) {
      saved.push(email);
      await writeList(finalKey, saved);
    }
  }

  return {
    saveUnsubscribedEmail: (userEmail, email) => saveEmail('unsubscribedEmails', userEmail, email),
    isAlreadyUnsubscribed: async (userEmail, email) =>
      (await readList(`unsubscribedEmails_${userEmail}`)).includes(email),
    removeUnsubscribedEmail: async (userEmail, email) => {
      const finalKey = `unsubscribedEmails_${userEmail}`;
      const saved = await readList(finalKey);
      await writeList(finalKey, saved.filter((item) => item !== email));
    },
    saveKeptEmail: (userEmail, email) => saveEmail('keptEmails', userEmail, email),
    isAlreadyKept: async (userEmail, email) => 
      (await readList(`keptEmails_${userEmail}`)).includes(email),
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