import { ImapFlow, MailboxLockObject } from 'imapflow';
import { ProviderConfig } from './types';

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
    this.client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: true,
      auth: {
        user: config.user,
        pass: config.pass
      },
      logger: false // Allows network debugging
    });
  }

  /**
   * Opens the TCP connection and authenticates.
   */
  async connect(): Promise<void> {
    await this.client.connect();
    this.lock = await this.client.getMailboxLock('INBOX'); //Lock for sequential fetches
  }

  /**
   * Fetches headers for a specific range of emails.
   * @param range Sequence range (e.g., "1:*")
   * @param headers Array of headers to fetch (e.g., ['list-unsubscribe'])
   * @returns Raw envelope data from ImapFlow
   */
  async fetchHeaders(range: string, headers: string[]): Promise<any[]> {
    const messages = [];

    //Only fetch metadata and headers
    const fetchOptions = {
      envelope: true,
      headers: headers
    }

    for await (const message of this.client.fetch(range, fetchOptions)) {
      messages.push(message);
    }

    return messages;
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