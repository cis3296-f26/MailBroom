import { ImapFlow, MailboxLockObject } from 'imapflow';
import { ProviderConfig } from './types';
import { resolveProvider, DEFAULT_PROVIDER } from './emailProviders';

export class ImapClient {
  private config: ProviderConfig;
  private client: ImapFlow;
  private lock: MailboxLockObject | null = null;

  /**
   * Initializes the IMAP client with connection credentials.
   * @param config The provider configuration and user credentials
   */
  constructor(config: ProviderConfig) {
    this.config = config;
    const provider = resolveProvider(config.user);
    const host = config.host || provider?.imap.host || DEFAULT_PROVIDER.imap.host;
    const port = config.port || provider?.imap.port || DEFAULT_PROVIDER.imap.port;
    const defaultSecure = port === 993 ? true : (provider?.imap.secure ?? (port === 993));
    const secure = config.secure !== undefined ? config.secure : defaultSecure;

    this.client = new ImapFlow({
      host: host,
      port: port,
      secure: secure,
      auth: {
        user: config.user,
        pass: config.pass
      },
      logger: false // Set to true for network debugging if needed
    });
  }

  /**
   * Helper method to inspect client options (useful for testing and diagnostics).
   */
  getClientOptions(): any {
    return (this.client as any).options;
  }

  /**
   * Opens the TCP connection and authenticates.
   */
  async connect(): Promise<void> {
    await this.client.connect();
    this.lock = await this.client.getMailboxLock('INBOX'); // Lock for sequential fetches
  }

  /**
   * Fetches headers and metadata for a range of emails.
   * If range is '1:*' and mailbox has many emails, fetches the most recent slice.
   * @param range Sequence range (defaults to recent window)
   * @param headers Array of headers to fetch (e.g., ['list-unsubscribe', 'list-unsubscribe-post'])
   * @returns Raw envelope and header data from ImapFlow
   */
  async fetchHeaders(range: string = '1:*', headers: string[] = ['list-unsubscribe', 'list-unsubscribe-post']): Promise<any[]> {
    const messages = [];

    let targetRange = range;
    // If range is '1:*', prefer targeting the latest 150 emails to avoid scanning thousands of historical emails
    const mailboxExists = (this.client.mailbox as any)?.exists;
    if (range === '1:*' && typeof mailboxExists === 'number' && mailboxExists > 150) {
      targetRange = `${Math.max(1, mailboxExists - 150)}:*`;
    }

    const fetchOptions = {
      envelope: true,
      flags: true,
      internalDate: true,
      headers: headers
    };

    for await (const message of this.client.fetch(targetRange, fetchOptions)) {
      messages.push(message);
    }

    return messages;
  }

  /**
   * Deletes all emails associated with a sender's email
   * @param senderEmail 
   * @returns {Promise<number>} representing number of emails deleted
   */
  async deleteMessagesBySender(senderEmail: string): Promise<number> {
    if (!this.lock) throw new Error('Mailbox is not locked.');

    const sequenceArray = await this.client.search({ from: senderEmail });

    if (!sequenceArray || sequenceArray.length === 0) {
      return 0; // No messages found
    }

    // Two-step deletion: marks messages with \Deleted flag and executes EXPUNGE
    await this.client.messageDelete(sequenceArray);

    return sequenceArray.length;
  }

  /**
   * Releases locks and gracefully closes the connection.
   */
  async disconnect(): Promise<void> {
    if (this.lock) {
      this.lock.release();
      this.lock = null;
    }
    await this.client.logout();
  }
}
