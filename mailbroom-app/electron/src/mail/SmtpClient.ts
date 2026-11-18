import * as nodemailer from 'nodemailer';
import { ProviderConfig } from './types';
import { resolveProvider, DEFAULT_PROVIDER } from './emailProviders';

export class SmtpClient {
  private transporter: nodemailer.Transporter;
  private userEmail: string;

  /**
   * Initializes the SMTP client with connection credentials.
   * @param config The provider configuration and user credentials
   */
  constructor(config: ProviderConfig) {
    this.userEmail = config.user;
    const provider = resolveProvider(config.user);

    // Derive host: explicit config, provider preset, IMAP host inference, or default provider preset
    const derivedFromImap = config.host?.startsWith('imap.') ? config.host.replace(/^imap\./, 'smtp.') : config.host;
    const host = config.smtpHost || provider?.smtp.host || derivedFromImap || DEFAULT_PROVIDER.smtp.host;

    // Derive port: explicit config, provider preset, or default port
    const defaultPort = provider?.smtp.port || (host === DEFAULT_PROVIDER.smtp.host ? DEFAULT_PROVIDER.smtp.port : 587);
    const port = config.smtpPort || defaultPort;

    // Derive secure mode: explicit config, provider preset, or port standard (465 = SSL vs 587 = STARTTLS)
    const defaultSecure = provider?.smtp.secure !== undefined ? provider.smtp.secure : (port === 465);
    const secure = config.secure !== undefined ? config.secure : defaultSecure;

    this.transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  /**
   * Helper method to inspect transport options (useful for testing and diagnostics).
   */
  getTransportOptions(): any {
    return (this.transporter as any).options;
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
