const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only retry reads: unsubscribe/send operations must not be repeated here.
export async function getGmail(path, token, {
  onRetry = () => {},
  fetchImpl = fetch,
  sleep = wait,
} = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${GMAIL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) return data;

    const reasons = data.error?.errors?.map((error) => error.reason) || [];
    const rateLimited = res.status === 429 || (res.status === 403 &&
      reasons.some((reason) => ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason)));
    const retryable = rateLimited || res.status >= 500;
    const message = rateLimited
      ? 'Gmail is limiting requests. Please wait a little, then retry.'
      : res.status === 401
        ? 'Your Google session expired. Please sign in again.'
        : `Gmail could not load emails (${res.status}). Please try again.`;

    if (!retryable || attempt >= 4) throw new Error(message);

    const retryAfter = res.headers.get('Retry-After');
    const retryMs = retryAfter === null ? 0 : /^\d+(\.\d+)?$/.test(retryAfter)
      ? Number(retryAfter) * 1000
      : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
    const delay = Math.max(1000 * 2 ** attempt + Math.random() * 500, retryMs);
    // A long server cooldown should return control to the user, not freeze loading.
    if (delay > 60000) throw new Error(message);
    onRetry(Math.ceil(delay / 1000));
    await sleep(delay);
  }
}

export async function getMessageDetails(messages, token, {
  onProgress = () => {},
  ...options
} = {}) {
  const details = [];
  // Avoid the per-user concurrency limit by fetching one email at a time.
  for (const message of messages) {
    onProgress(details.length, messages.length);
    details.push(await getGmail(
      `/messages/${message.id}?format=full&fields=id,labelIds,internalDate,snippet,payload/headers`,
      token,
      options
    ));
  }
  return details;
}
