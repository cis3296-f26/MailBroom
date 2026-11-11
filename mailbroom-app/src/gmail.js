import {
  isAlreadyUnsubscribed,
  isAlreadyKept,
  saveUnsubscribedEmail,
  removeUnsubscribedEmail,
  saveKeptEmail,
} from './storage.js';

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

// Extracts the clean email address from a "Name <email@domain.com>" string
function cleanSenderEmail(from = '') {
  return from.match(/<([^>]+)>/)?.[1] || from;
}

// Parses List-Unsubscribe and List-Unsubscribe-Post headers
function parseUnsubscribe(listUnsub = '', listUnsubPost = '') {
  const links = [...listUnsub.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  return {
    https: links.find((l) => l.startsWith('https://')),
    mailto: links.find((l) => l.startsWith('mailto:')),
    oneClick: /One-Click/i.test(listUnsubPost),
  };
}

class GmailService {
  #token = null;
  #controller = null;
  #fetchImpl;
  #sleep;

  constructor({ fetchImpl = fetch, sleep = wait } = {}) {
    this.#fetchImpl = fetchImpl;
    this.#sleep = sleep;
  }

  // Cancels previous requests, initializes abortController
  beginLoading() {
    this.cancelActiveRequests();
    this.#controller = new AbortController();
    return this.#controller.signal;
  }

  // Stops active HTTP requests
  cancelActiveRequests() {
    if (this.#controller) {
      this.#controller.abort();
      this.#controller = null;
    }
  }

  // Returns true if there is an active request that has not been aborted
  get isActive() {
    return !!this.#controller && !this.#controller.signal.aborted;
  }

  // Returns the current AbortSignal, creating a new one if necessary
  get currentSignal() {
    if (!this.#controller || this.#controller.signal.aborted) {
      this.#controller = new AbortController();
    }
    return this.#controller.signal;
  }

  // Returns true if the error is an AbortError or if the current signal has been aborted
  isCancelled(err) {
    return err?.name === 'AbortError' || (this.#controller ? this.#controller.signal.aborted : false);
  }

  // AUTHENTICATION
  async authenticate(interactive = true) {
    if (!window.desktopAPI) throw new Error("Desktop API not available");

    if (!interactive && window.desktopAPI.getStoredAccessToken) {
      const storedToken = await window.desktopAPI.getStoredAccessToken();
      if (storedToken) {
        this.#token = storedToken;
        return this.#token;
      }
      return null;
    }

    this.#token = await window.desktopAPI.loginWithGoogle();
    return this.#token;
  }

  // Logout user and clear tokens
  async logout() {
    this.cancelActiveRequests();
    this.#token = null;
    if (window.desktopAPI?.logout) {
      await window.desktopAPI.logout();
    }
  }

  // Returns true if the user is authenticated 
  get isAuthenticated() {
    return !!this.#token;
  }

    // Returns the current token for making external API calls like spam filters
  getToken() {
    return this.#token;
  }

  // Private method to make requests to Gmail API with retry logic for rate limiting and token refresh
  async #request(path, options = {}) {
    if (!this.#token) throw new Error("Not authenticated with Gmail");

    const signal = options.signal || this.currentSignal;
    const {
      onRetry = () => {},
      fetchImpl = this.#fetchImpl,
      sleep = this.#sleep,
      method = 'GET',
      body,
      _retriedAuth = false,
    } = options;

    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const headers = { Authorization: `Bearer ${this.#token}` };
      if (body) headers['Content-Type'] = 'application/json';

      const res = await fetchImpl(`${GMAIL_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      // If access token expired, attempt one silent refresh before throwing
      if (res.status === 401 && !_retriedAuth && window.desktopAPI?.getStoredAccessToken) {
        const refreshedToken = await window.desktopAPI.getStoredAccessToken();
        if (refreshedToken) {
          this.#token = refreshedToken;
          return this.#request(path, { ...options, _retriedAuth: true, signal });
        }
      }
      
      const data = await res.json();
      if (res.ok) return data;

      const reasons = data.error?.errors?.map((error) => error.reason) || [];
      const errorMessage = data.error?.message || '';
      
      // Match all variations of Google rate limiting and quota errors
      const isRateLimit =
        res.status === 429 ||
        (res.status === 403 &&
          (reasons.some((r) => /ratelimit|quota/i.test(r)) ||
            /rate limit|quota/i.test(errorMessage)));

      if (!isRateLimit || attempt >= 4) {
        throw new Error(
          `Gmail API Error: ${res.status}${errorMessage ? ` - ${errorMessage}` : ''}`
        );
      }
      
      const delay = 1000 * 2 ** attempt; 
      onRetry(Math.ceil(delay / 1000));
      await sleep(delay, signal);
    }
  }

  // Fetches a list of targeted messages from the user's inbox based on a search query
  async fetchPromotions(query, onRetry) {
    const q = encodeURIComponent(query);
    return this.#request(`/messages?maxResults=50&labelIds=INBOX&q=${q}`, { onRetry });
  }

  // Fetches detailed information for a list of messages, including headers and snippet
  async fetchMessageDetails(messages, { onRetry, onProgress } = {}) {
    const details = [];
    for (const message of messages) {
      if (!this.isActive) {
        throw new DOMException('Aborted', 'AbortError');
      }

      onProgress?.(details.length, messages.length);

      try {
        const detail = await this.#request(
          `/messages/${message.id}?format=full&fields=id,labelIds,internalDate,snippet,payload/headers`,
          { onRetry }
        );
        if (detail) details.push(detail);
      } catch (err) {
        if (this.isCancelled(err)) {
          throw err;
        }
        // If an individual message was deleted/missing or forbidden, skip it gracefully
        console.warn(`Could not fetch details for message ${message.id}:`, err?.message || err);
      }
    }
    return details;
  }

  // Loads and aggregates senders from promotion/newsletter emails, filtering already handled senders
  async loadSenders({ onRetry, onProgress, query = 'category:promotions OR unsubscribe' } = {}) {
    this.beginLoading();

    const listData = await this.fetchPromotions(query, onRetry);
    const messages = listData?.messages || [];

    const details = await this.fetchMessageDetails(messages, {
      onRetry,
      onProgress,
    });

    const bySender = {};

    for (const msg of details) {
      const h = Object.fromEntries(
        (msg.payload?.headers || []).map((x) => [
          x.name.toLowerCase(),
          x.value,
        ])
      );

      if (!h['list-unsubscribe'] || !h.from) continue;

      const from = h.from;

      if (!bySender[from]) {
        bySender[from] = {
          from,
          count: 0,
          unread: 0,
          latest: null,
          ...parseUnsubscribe(
            h['list-unsubscribe'],
            h['list-unsubscribe-post']
          ),
        };
      }

      const sender = bySender[from];
      sender.count++;

      if ((msg.labelIds || []).includes('UNREAD')) {
        sender.unread++;
      }

      const timestamp = Number(msg.internalDate);

      if (!sender.latest || timestamp > sender.latest.timestamp) {
        sender.latest = {
          timestamp,
          subject: h.subject || '(No subject)',
          snippet: msg.snippet || 'No preview available.',
        };
      }
    }

    if (!this.isActive) return [];

    const ranked = Object.values(bySender)
      .map((s) => ({ ...s, opened: s.count - s.unread }))
      .sort((a, b) => b.count - a.count);

    // Filter out senders that have already been unsubscribed or kept
    const filtered = [];
    for (const s of ranked) {
      if (!this.isActive) return [];
      const cleanEmail = cleanSenderEmail(s.from);
      if (!(await isAlreadyUnsubscribed(cleanEmail)) && !(await isAlreadyKept(cleanEmail))) {
        filtered.push(s);
      }
    }

    return filtered;
  }

  // Sends an unsubscribe email to the specified mailto URL
  async sendUnsubscribeEmail(mailtoUrl) {
    const url = new URL(mailtoUrl);
    const clean = (s) => s.replace(/[\r\n]/g, ''); 
    const to = clean(decodeURIComponent(url.pathname));
    const subject = clean(url.searchParams.get('subject') || 'unsubscribe');
    const raw = `To: ${to}\r\nSubject: ${subject}\r\n\r\nunsubscribe`;
    const encoded = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    return this.#request('/messages/send', { 
      method: 'POST', 
      body: { raw: encoded } 
    });
  }

  // Executes unsubscribe request via desktop API, browser, or mailto email
  async unsubscribe(sender) {
    if (!sender) throw new Error('No sender provided');

    const cleanEmail = cleanSenderEmail(sender.from);

    if (sender.https) {
      if (window.desktopAPI?.unsubscribe) {
        const result = await window.desktopAPI.unsubscribe({
          url: sender.https,
          oneClick: sender.oneClick,
        });

        if (!result.ok) {
          throw new Error(result.error || `HTTPS Unsubscribe Failed: ${result.status}`);
        }
        await saveUnsubscribedEmail(cleanEmail);

        return {
          ok: true,
          type: 'https',
          message: `Unsubscribe request sent for ${sender.from}`,
        };
      } else {
        window.open(sender.https, '_blank');
        await saveUnsubscribedEmail(cleanEmail);

        return {
          ok: true,
          type: 'https',
          message: `Opened unsubscribe page for ${sender.from}`,
        };
      }
    } else if (sender.mailto) {
      await this.sendUnsubscribeEmail(sender.mailto);
      await saveUnsubscribedEmail(cleanEmail);

      return {
        ok: true,
        type: 'mailto',
        message: `Unsubscribe email sent to ${sender.from}`,
      };
    }

    throw new Error(`No unsubscribe link or email found for ${sender.from}`);
  }

  // Marks an email as unsubscribed in local storage
  async markUnsubscribed(senderOrEmail) {
    const email = typeof senderOrEmail === 'string'
      ? cleanSenderEmail(senderOrEmail)
      : cleanSenderEmail(senderOrEmail?.from || '');
    await saveUnsubscribedEmail(email);
  }

  // Removes an email from the unsubscribed list in local storage (undo)
  async cancelUnsubscribe(senderOrEmail) {
    const email = typeof senderOrEmail === 'string'
      ? cleanSenderEmail(senderOrEmail)
      : cleanSenderEmail(senderOrEmail?.from || '');
    await removeUnsubscribedEmail(email);
  }

  // Marks an email as kept in local storage
  async keepSender(senderOrEmail) {
    const email = typeof senderOrEmail === 'string'
      ? cleanSenderEmail(senderOrEmail)
      : cleanSenderEmail(senderOrEmail?.from || '');
    await saveKeptEmail(email);
  }
}

export { GmailService };
export const gmailApi = new GmailService();
