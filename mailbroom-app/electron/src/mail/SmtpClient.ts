import * as nodemailer from 'nodemailer';
import { ProviderConfig } from './types';

export class SmtpClient {
  private transporter: nodemailer.Transporter;
  private userEmail: string;

  /**
   * Initializes the SMTP client with connection credentials.
   * @param config The provider configuration and user credentials
   */
  constructor(config: ProviderConfig) {
    this.userEmail = config.user;
    const isGmail = !config.smtpHost || config.smtpHost === 'smtp.gmail.com';
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost || 'smtp.gmail.com',
      port: config.smtpPort || (isGmail ? 465 : 587),
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  /**
   * Sends an email via SMTP.
   * @param to Recipient address
   * @param body Email text content
   * @param subject Email subject
   * @returns True if the mail server accepted the message
   */
  async sendMail(to: string, body: string = 'unsubscribe', subject: string = 'unsubscribe'): Promise<boolean> {
    const info = await this.transporter.sendMail({
      from: this.userEmail,
      to: to,
      subject: subject,
      text: body,
    });

    // Returns true if server accepted the email
    return (info.accepted && info.accepted.length > 0) || false;
  }
}
