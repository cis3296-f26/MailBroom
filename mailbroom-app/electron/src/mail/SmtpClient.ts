import * as nodemailer from 'nodemailer';
import { ProviderConfig } from './types';

export class SmtpClient {
  private transporter: nodemailer.Transporter;
  private userEmail: string;

  /**
   * Initializes the IMAP client with connection credentials.
   * @param config The provider configuration and user credentials
   */
  constructor(config: ProviderConfig) {
    this.userEmail = config.user;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: true,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  async sendMail(to: string, body: string, subject: string) {
    const info = await this.transporter.sendMail({
      from: this.userEmail,
      to: to,
      subject: subject,
      text: body,
    });

    // Returns true if server accepts email
    return info.accepted.length > 0;
  }

}