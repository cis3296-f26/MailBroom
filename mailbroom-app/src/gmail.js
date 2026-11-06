const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class GmailService {
  #token = null;

  // 1. AUTHENTICATION
  async authenticate() {
    if (!window.desktopAPI) throw new Error("Desktop API not available");
    this.#token = await window.desktopAPI.loginWithGoogle();
    return this.#token;
  }

  get isAuthenticated() {
    return !!this.#token;
  }

  async #request(path, options = {}) {
    if (!this.#token) throw new Error("Not authenticated with Gmail");

    const { onRetry = () => {}, fetchImpl = fetch, sleep = wait, method = 'GET', body } = options;

    for (let attempt = 0; ; attempt++) {
      const headers = { Authorization: `Bearer ${this.#token}` };
      if (body) headers['Content-Type'] = 'application/json';

      const res = await fetchImpl(`${GMAIL_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      
      const data = await res.json();
      if (res.ok) return data;

      const reasons = data.error?.errors?.map((error) => error.reason) || [];
      const rateLimited = res.status === 429 || (res.status === 403 && reasons.includes('rateLimitExceeded'));
      if (!rateLimited || attempt >= 4) throw new Error(`Gmail API Error: ${res.status}`);
      
      const delay = 1000 * 2 ** attempt; 
      onRetry(Math.ceil(delay / 1000));
      await sleep(delay);
    }
  }

  // 3. SPECIFIC API ACTIONS
  async fetchPromotions(query, onRetry) {
    const q = encodeURIComponent(query);
    return this.#request(`/messages?maxResults=50&labelIds=INBOX&q=${q}`, { onRetry });
  }

  async fetchMessageDetails(messages, { onRetry, onProgress }) {
    const details = [];
    for (const message of messages) {
      onProgress(details.length, messages.length);
      details.push(
        await this.#request(`/messages/${message.id}?format=full&fields=id,labelIds,internalDate,snippet,payload/headers`, { onRetry })
      );
    }
    return details;
  }

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