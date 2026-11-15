import { ProviderConfig } from './types';

export class SmtpClient {
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

  async sendMail(to:string, body: string, subject: string) {
    throw new Error('SmtpClient.sendMail() is not implemented yet.');
  }

}