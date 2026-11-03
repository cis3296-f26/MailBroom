const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'proton.me', 'protonmail.com', 'pm.me', 'mail.com',
]);

const MAIL_SUBDOMAINS = new Set([
  'service', 'mail', 'email', 'emails', 'mailer', 'notifications',
  'notification', 'notify', 'news', 'newsletter', 'newsletters',
  'marketing', 'updates', 'messages', 'info', 'bounce', 'bounces',
]);

function companyDomain(domain) {
  const parts = domain.split('.');
  // Strip recognized mailing prefixes, preserving names such as example.co.uk.
  // Do not guess by taking the last two labels: co.uk is not a company.
  while (parts.length > 2 && MAIL_SUBDOMAINS.has(parts[0])) {
    if (parts.length === 3 && parts[2].length === 2 && parts[1].length <= 3) break;
    parts.shift();
  }
  return parts.join('.');
}

export function getSenderIdentity(from = '') {
  const value = from.trim();
  const match = value.match(/^(.*?)\s*<([^<>]+)>$/);
  const email = (match ? match[2] : value).trim();
  const name = match?.[1].trim().replace(/^"(.*)"$/, '$1') || email;
  const domain = email.match(/^[^\s<>@]+@([a-z0-9.-]+\.[a-z]{2,})$/i)?.[1].toLowerCase();
  const words = name.split('@')[0].split(/[\s._-]+/).filter(Boolean);
  const initials = words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
    : (words[0]?.slice(0, 2).toUpperCase() || '?');

  const website = domain ? companyDomain(domain) : null;

  return {
    name,
    email,
    initials,
    iconUrl: website && !PERSONAL_DOMAINS.has(website)
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(website)}&sz=64`
      : null,
  };
}
