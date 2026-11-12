import { Preferences } from '@capacitor/preferences';
import { getSenderIdentity } from './senderIdentity.js';

export function summarizeHistory(entries, filter = 'all') {
  const kept = entries.filter((entry) => entry.outcome === 'kept').length;
  return {
    reviewed: entries.length,
    kept,
    removed: entries.length - kept,
    entries: entries.filter((entry) => filter === 'all' || (filter === 'kept' ? entry.outcome === 'kept' : entry.outcome !== 'kept')),
  };
}

export function createReviewHistory(preferences = Preferences) {
  let writes = Promise.resolve();
  const read = async () => {
    const { value } = await preferences.get({ key: 'reviewHistory' });
    const entries = JSON.parse(value || '[]');
    if (!Array.isArray(entries)) throw new Error('Invalid review history');
    return entries.filter((entry) => entry && typeof entry.from === 'string' && typeof entry.email === 'string' && ['kept', 'requested', 'filtered'].includes(entry.outcome));
  };

  return {
    read: () => writes.then(read),
    save(sender, outcome) {
      const task = writes.then(async () => {
        const email = getSenderIdentity(sender.from).email.toLowerCase();
        const entries = await read();
        const next = [
          { email, from: sender.from, outcome, reviewedAt: new Date().toISOString() },
          ...entries.filter((entry) => entry.email !== email),
        ];
        await preferences.set({ key: 'reviewHistory', value: JSON.stringify(next) });
        return next;
      });
      // A failed write must not block later decisions from being saved.
      writes = task.catch(() => {});
      return task;
    },
  };
}

export const reviewHistory = createReviewHistory();
