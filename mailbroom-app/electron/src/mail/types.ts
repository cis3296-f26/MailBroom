export interface ProviderConfig {
  user: string; // The user's email address
  pass: string; // User's application password
  host?: string; // IMAP server address (defaults to imap.gmail.com)
  port?: number; // IMAP server port (defaults to 993)
  smtpHost?: string; // SMTP server address (defaults to smtp.gmail.com)
  smtpPort?: number; // SMTP server port (defaults to 465)
  secure?: boolean;
}

export interface UnsubscribeCandidate {
  email: string; // Sender's email address
  name: string; // Sender's display name
  from: string; // Formatted "Name <email>" string
  count: number; // Total emails from this sender in recent scan
  opened: number; // Number of opened/seen emails
  unread: number; // Number of unread emails
  latest?: {
    timestamp: number;
    subject: string;
    snippet: string;
  };
  httpsUrl?: string; // Online link to unsubscribe (optional)
  mailtoUrl?: string; // mailto link (optional)
  https?: string; // Alias for httpsUrl
  mailto?: string; // Alias for mailtoUrl
  oneClick: boolean; // True if List-Unsubscribe-Post One-Click is supported
}
