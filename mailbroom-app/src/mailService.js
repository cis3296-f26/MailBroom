import {
  isAlreadyUnsubscribed,
  isAlreadyKept,
  saveUnsubscribedEmail,
  removeUnsubscribedEmail,
  saveKeptEmail,
} from './storage.js';

function cleanSenderEmail(from = '') {
  return from.match(/<([^>]+)>/)?.[1] || from;
}

class MailService {
  #credentials = null;
  #controller = null;

  beginLoading() {
    this.cancelActiveRequests();
    this.#controller = new AbortController();
    return this.#controller.signal;
  }

  cancelActiveRequests() {
    if (this.#controller) {
      this.#controller.abort();
      this.#controller = null;
    }
  }

  get isActive() {
    return !!this.#controller && !this.#controller.signal.aborted;
  }

  isCancelled(err) {
    return err?.name === 'AbortError' || (this.#controller ? this.#controller.signal.aborted : false);
  }

  async authenticate(credentials) {
    if (!window.desktopAPI) throw new Error('Desktop API not available');
    if (!credentials || !credentials.user || !credentials.pass) {
      throw new Error('Please enter both your email and your 16-character App Password.');
    }

    // Clean user input
    const cleanCreds = {
      user: credentials.user.trim(),
      pass: credentials.pass.trim().replace(/\s+/g, ''), // Strip any spaces from the 16-char password
      host: credentials.host?.trim() || undefined,
      port: credentials.port ? Number(credentials.port) : undefined,
      smtpHost: credentials.smtpHost?.trim() || undefined,
      smtpPort: credentials.smtpPort ? Number(credentials.smtpPort) : undefined,
    };

    // Verify credentials against the IMAP server
    const verifyRes = await window.desktopAPI.verifyCredentials(cleanCreds);
    if (!verifyRes.success) {
      throw new Error(verifyRes.error || 'Connection failed. Please check your email and App Password.');
    }

    // Save encrypted credentials to safeStorage
    await window.desktopAPI.saveCredentials(cleanCreds);
    this.#credentials = cleanCreds;
    return this.#credentials;
  }

  async getStoredCredentials() {
    if (!window.desktopAPI) return null;
    if (this.#credentials) return this.#credentials;

    try {
      const res = await window.desktopAPI.getStoredCredentials();
      if (res?.success && res.data) {
        this.#credentials = res.data;
        return this.#credentials;
      }
    } catch (err) {
      console.warn('Failed to load stored credentials:', err);
    }
    return null;
  }

  async logout() {
    this.cancelActiveRequests();
    this.#credentials = null;
    if (window.desktopAPI?.logout) {
      await window.desktopAPI.logout();
    }
  }

  get isAuthenticated() {
    return !!this.#credentials;
  }

  getUserEmail() {
    return this.#credentials?.user || '';
  }

  getToken() {
    return this.#credentials?.pass || null;
  }

  async loadSenders() {
    this.beginLoading();

    const creds = await this.getStoredCredentials();
    if (!creds) {
      throw new Error('Please sign in with your email and App Password.');
    }

    const res = await window.desktopAPI.fetchEmails(creds);
    if (!res.success) {
      throw new Error(res.error || 'Failed to fetch emails.');
    }

    if (!this.isActive) return [];

    const candidates = res.data || [];

    // Filter out senders that have already been unsubscribed or kept
    const filtered = [];
    for (const s of candidates) {
      if (!this.isActive) return [];
      const cleanEmail = cleanSenderEmail(s.from || s.email);
      if (!(await isAlreadyUnsubscribed(cleanEmail)) && !(await isAlreadyKept(cleanEmail))) {
        filtered.push(s);
      }
    }

    return filtered;
  }

  async unsubscribe(sender) {
    if (!sender) throw new Error('No sender provided');
    const creds = await this.getStoredCredentials();
    if (!creds) throw new Error('Not signed in');

    const cleanEmail = cleanSenderEmail(sender.from || sender.email);

    const res = await window.desktopAPI.sendUnsubscribe(creds, sender);
    if (!res.success) {
      throw new Error(res.error || 'Failed to process unsubscribe');
    }

    await saveUnsubscribedEmail(cleanEmail);

    return {
      ok: true,
      message: res.message || `Unsubscribed from ${sender.name || sender.from}`,
    };
  }

  async markUnsubscribed(senderOrEmail) {
    const email = typeof senderOrEmail === 'string'
      ? cleanSenderEmail(senderOrEmail)
      : cleanSenderEmail(senderOrEmail?.from || senderOrEmail?.email || '');
    await saveUnsubscribedEmail(email);
  }

  async cancelUnsubscribe(senderOrEmail) {
    const email = typeof senderOrEmail === 'string'
      ? cleanSenderEmail(senderOrEmail)
      : cleanSenderEmail(senderOrEmail?.from || senderOrEmail?.email || '');
    await removeUnsubscribedEmail(email);
  }

  async keepSender(senderOrEmail) {
    const email = typeof senderOrEmail === 'string'
      ? cleanSenderEmail(senderOrEmail)
      : cleanSenderEmail(senderOrEmail?.from || senderOrEmail?.email || '');
    await saveKeptEmail(email);
  }
}

export const mailService = new MailService();
export const gmailApi = mailService; // Backward-compatible alias for existing imports
