import { ProviderConfig } from './types';

export class ImapClient {
  private config: ProviderConfig;
  private client: unknown | null; 

  /**
   * Initializes the IMAP client with connection credentials.
   * @param config The provider configuration and user credentials
   */
  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = null;
  }

  /**
   * Opens the TCP connection and authenticates.
   */
  async connect(): Promise<void> {
    throw new Error('ImapClient.connect() is not implemented yet.');
  }

  /**
   * Fetches headers for a specific range of emails.
   * @param range Sequence range (e.g., "1:*")
   * @param headers Array of headers to fetch (e.g., ['list-unsubscribe'])
   * @returns Raw envelope data from ImapFlow
   */
  async fetchHeaders(range: string, headers: string[]): Promise<any[]> {
    throw new Error('ImapClient.fetchHeaders() is not implemented yet.');
  }

  /**
   * Releases locks and gracefully closes the connection.
   */
  async disconnect(): Promise<void> {
    throw new Error('ImapClient.disconnect() is not implemented yet.');
  }
}