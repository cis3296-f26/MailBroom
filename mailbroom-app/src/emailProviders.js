/**
 * Helper constants and functions for email providers, tagged with their domain names
 */
export const PROVIDER_PRESETS = {
  google: {
    name: 'Google',
    domains: ['gmail.com', 'googlemail.com'],
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    guideUrl: 'https://myaccount.google.com/apppasswords',
    guideName: 'Google App Password',
  },
  microsoft: {
    name: 'Microsoft / Outlook',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    guideUrl: 'https://account.live.com/proofs/manage/additional',
    guideName: 'Microsoft App Password',
  },
  yahoo: {
    name: 'Yahoo / AOL',
    domains: ['yahoo.com', 'ymail.com', 'myyahoo.com', 'aol.com', 'aim.com'],
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    guideUrl: 'https://login.yahoo.com/account/security',
    guideName: 'Yahoo App Password',
  },
  icloud: {
    name: 'Apple iCloud',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    guideUrl: 'https://appleid.apple.com/account/manage',
    guideName: 'Apple App-Specific Password',
  },
};
export const DEFAULT_PROVIDER = PROVIDER_PRESETS.google;

export function resolveProvider(email = '') {
  if (typeof email !== 'string') return null;
  const domain = email.trim().split('@')[1]?.toLowerCase();
  if (!domain) return null;
  for (const provider of Object.values(PROVIDER_PRESETS)) {
    if (provider.domains.includes(domain)) return provider;
  }
  return null; // Custom / corporate domain
}