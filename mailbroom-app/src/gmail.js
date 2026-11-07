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

class GmailService {
  #token = null;
  #controller = null;

  //Cancels previous requests, initializes abortController
  beginLoading() {
    this.cancelActiveRequests();
    this.#controller = new AbortController();
    return this.#controller.signal;
  }

  //Stops active HTTP requests
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

  //AUTHENTICATION
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

  //Private method to make requests to Gmail API with retry logic for rate limiting and token refresh
  async #request(path, options = {}) {
    if (!this.#token) throw new Error("Not authenticated with Gmail");

    const signal = options.signal || this.currentSignal;
    const {
      onRetry = () => {},
      fetchImpl = fetch,
      sleep = wait,
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

  // Fetches a list of targetted messages from the user's inbox based on a search query
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
}

export const gmailApi = new GmailService();
