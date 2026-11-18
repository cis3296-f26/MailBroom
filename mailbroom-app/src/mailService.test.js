import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { MailService } from './mailService.js';

//Setup Localstorage
const store = new Map();
const mockLocalStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};

function createDesktopAPIMock(overrides = {}) {
  return {
    verifyCredentials: async () => ({ success: true }),
    saveCredentials: async () => ({ success: true }),
    getStoredCredentials: async () => ({
      success: true,
      data: { user: 'user@example.com', pass: 'abcd1234efgh5678' },
    }),
    logout: async () => ({ success: true }),
    fetchEmails: async () => ({ success: true, data: [] }),
    sendUnsubscribe: async () => ({ success: true, message: 'Unsubscribed' }),
    deleteMessages: async () => ({ success: true, count: 0 }),
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  globalThis.localStorage = mockLocalStorage;
  globalThis.window = {
    localStorage: mockLocalStorage,
    desktopAPI: createDesktopAPIMock(),
  };
});

test('authenticate sanitizes credentials, strips password spaces, and saves on success', async () => {
  let verifiedCreds = null;
  let savedCreds = null;

  globalThis.window.desktopAPI = createDesktopAPIMock({
    verifyCredentials: async (creds) => {
      verifiedCreds = creds;
      return { success: true };
    },
    saveCredentials: async (creds) => {
      savedCreds = creds;
      return { success: true };
    },
  });

  const service = new MailService();
  const result = await service.authenticate({
    user: '  test@example.com  ',
    pass: 'abcd efgh ijkl mnop',
    host: ' imap.example.com ',
    port: '993',
    secure: 1,
  });

  assert.equal(result.user, 'test@example.com');
  assert.equal(result.pass, 'abcdefghijklmnop');
  assert.equal(result.host, 'imap.example.com');
  assert.equal(result.port, 993);
  assert.equal(result.secure, true);
  assert.deepEqual(verifiedCreds, savedCreds);
  assert.equal(service.isAuthenticated, true);
});

test('authenticate throws and does not save when verification fails', async () => {
  let saveCalled = false;
  globalThis.window.desktopAPI = createDesktopAPIMock({
    verifyCredentials: async () => ({ success: false, error: 'Invalid App Password' }),
    saveCredentials: async () => {
      saveCalled = true;
    },
  });

  const service = new MailService();
  await assert.rejects(
    service.authenticate({ user: 'test@example.com', pass: 'wrongpass' }),
    /Invalid App Password/
  );
  assert.equal(saveCalled, false);
  assert.equal(service.isAuthenticated, false);
});

test('loadSenders filters out already unsubscribed and kept senders', async () => {
  globalThis.window.desktopAPI = createDesktopAPIMock({
    fetchEmails: async () => ({
      success: true,
      data: [
        { from: 'Store A <a@store.com>', email: 'a@store.com' },
        { from: 'Store B <b@store.com>', email: 'b@store.com' },
        { from: 'Store C <c@store.com>', email: 'c@store.com' },
      ],
    }),
  });

  const service = new MailService();
  await service.markUnsubscribed('Store A <a@store.com>');
  await service.keepSender('b@store.com');

  const senders = await service.loadSenders();
  assert.equal(senders.length, 1);
  assert.equal(senders[0].email, 'c@store.com');
});

test('cancelUnsubscribe restores a previously unsubscribed sender to loadSenders', async () => {
  globalThis.window.desktopAPI = createDesktopAPIMock({
    fetchEmails: async () => ({
      success: true,
      data: [{ from: 'Store A <a@store.com>', email: 'a@store.com' }],
    }),
  });

  const service = new MailService();
  await service.markUnsubscribed('Store A <a@store.com>');
  assert.equal((await service.loadSenders()).length, 0);

  await service.cancelUnsubscribe('a@store.com');
  assert.equal((await service.loadSenders()).length, 1);
});

test('loadSenders returns empty array if cancelled mid-flight', async () => {
  const service = new MailService();

  globalThis.window.desktopAPI = createDesktopAPIMock({
    fetchEmails: async () => {
      service.cancelActiveRequests();
      return {
        success: true,
        data: [{ from: 'Store A <a@store.com>', email: 'a@store.com' }],
      };
    },
  });

  const senders = await service.loadSenders();
  assert.deepEqual(senders, []);
  assert.equal(service.isActive, false);
});

test('unsubscribe invokes IPC and persists unsubscribed sender email', async () => {
  let ipcSender = null;
  globalThis.window.desktopAPI = createDesktopAPIMock({
    sendUnsubscribe: async (_creds, sender) => {
      ipcSender = sender;
      return { success: true, message: 'One-Click complete' };
    },
    fetchEmails: async () => ({
      success: true,
      data: [{ from: 'Promo <promo@store.com>', email: 'promo@store.com' }],
    }),
  });

  const service = new MailService();
  const sender = { name: 'Promo', from: 'Promo <promo@store.com>', email: 'promo@store.com' };

  const res = await service.unsubscribe(sender);
  assert.deepEqual(res, { ok: true, message: 'One-Click complete' });
  assert.deepEqual(ipcSender, sender);

  const remaining = await service.loadSenders();
  assert.deepEqual(remaining, []);
});

test('trashSenderMessages validates email format and maps IPC count to result object', async () => {
  let deletedTarget = null;
  globalThis.window.desktopAPI = createDesktopAPIMock({
    deleteMessages: async (_creds, email) => {
      deletedTarget = email;
      return { success: true, count: 4 };
    },
  });

  const service = new MailService();

  await assert.rejects(
    service.trashSenderMessages('not-an-email'),
    /valid sender email address is required/
  );

  const result = await service.trashSenderMessages('news@store.com');
  assert.equal(deletedTarget, 'news@store.com');
  assert.deepEqual(result, { found: 4, trashed: 4, failed: 0 });
});