import { ImapClient } from './ImapClient';
import { SmtpClient } from './SmtpClient';
import { Sender } from './types';

export interface UnsubscribeResult {
  ok: boolean;
  message?: string;
}

export class MailBroomService {
  private imap: ImapClient;
  private smtp: SmtpClient;

  constructor(imapClient: ImapClient, smtpClient: SmtpClient) {
    this.imap = imapClient;
    this.smtp = smtpClient;
  }

  /**
   * Connects to IMAP, scans inbox, aggregates candidates by sender, and returns formatted candidates.
   * @param {number} [limit=50] - Max number of candidate senders to return
   */
  async getUnsubscribeCandidates(limit: number = 50): Promise<Sender[]> {
    await this.imap.connect();
    const bySender = new Map<string, Sender>();

    try {
      const messages = await this.imap.fetchHeaders('1:*', ['list-unsubscribe', 'list-unsubscribe-post']);

      for (const msg of messages) {
        const headerString = msg.headers ? msg.headers.toString('utf-8') : '';

        // Only parse emails that contain a List-Unsubscribe header
        if (!headerString.toLowerCase().includes('list-unsubscribe:')) {
          continue;
        }

        const rawAddress = msg.envelope?.from?.[0]?.address || 'Unknown';
        const fromAddress = rawAddress.toLowerCase();
        const fromName = msg.envelope?.from?.[0]?.name || rawAddress;
        const formattedFrom = msg.envelope?.from?.[0]?.name
          ? `"${msg.envelope.from[0].name}" <${rawAddress}>`
          : rawAddress;

        // Extract https or mailto link for unsubscribe
        const httpsMatch = headerString.match(/<(https:\/\/[^>]+)>/i);
        const mailtoMatch = headerString.match(/<(mailto:[^>]+)>/i);
        const oneClick = /list-unsubscribe-post:[^\r\n]*one-click/i.test(headerString);

        const isRead = Boolean(
          msg.flags?.has?.('\\Seen') || 
          msg.flags?.includes?.('\\Seen') || 
          (Array.isArray(msg.flags) && msg.flags.includes('\\Seen'))
        );

        const timestamp = msg.internalDate 
          ? new Date(msg.internalDate).getTime() 
          : (msg.envelope?.date ? new Date(msg.envelope.date).getTime() : Date.now());

        const subject = msg.envelope?.subject || '(No subject)';

        if (!bySender.has(fromAddress)) {
          bySender.set(fromAddress, {
            email: fromAddress,
            name: fromName,
            from: formattedFrom,
            count: 0,
            opened: 0,
            unread: 0,
            latest: {
              timestamp,
              subject,
              snippet: subject,
            },
            httpsUrl: httpsMatch ? httpsMatch[1] : undefined,
            mailtoUrl: mailtoMatch ? mailtoMatch[1] : undefined,
            https: httpsMatch ? httpsMatch[1] : undefined,
            mailto: mailtoMatch ? mailtoMatch[1] : undefined,
            oneClick,
          });
        }

        const sender = bySender.get(fromAddress)!;
        sender.count++;
        if (isRead) {
          sender.opened++;
        } else {
          sender.unread++;
        }

        if (timestamp >= (sender.latest?.timestamp || 0)) {
          sender.latest = {
            timestamp,
            subject,
            snippet: subject,
          };
        }
      }

      // Rank senders by message frequency descending
      const ranked = Array.from(bySender.values()).sort((a, b) => b.count - a.count);
      return ranked.slice(0, limit);
    } finally {
      await this.imap.disconnect();
    }
  }

  /**
   * Executes unsubscribe via One-Click HTTP POST or SMTP email.
   * Defers manual web unsubscription (does not open external browser windows).
   * @param {Sender} candidate
   * @returns {Promise<UnsubscribeResult>} - Result object indicating outcome
   */
  async processUnsubscribe(candidate: Sender): Promise<UnsubscribeResult> {
    const httpsLink = candidate.https || candidate.httpsUrl;
    const mailtoLink = candidate.mailto || candidate.mailtoUrl;

    // Try automated One-Click HTTP POST if availible
    if (httpsLink && candidate.oneClick) {
      try {
        const response = await fetch(httpsLink, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
        });

        if (response.ok) {
          return {
            ok: true,
            message: `Unsubscribe request sent for ${candidate.name || candidate.email}`,
          };
        }
      } catch (error) {
        console.warn(`One-Click POST failed for ${httpsLink}, trying mailto fallback:`, error);
      }
    }

    // Fallback to automated mailto unsubscription via SMTP
    if (mailtoLink) {
      const cleanMailto = mailtoLink.replace(/^mailto:/i, '').split('?')[0];
      const sent = await this.smtp.sendMail(cleanMailto, 'unsubscribe', 'unsubscribe');
      if (sent) {
        return {
          ok: true,
          message: `Unsubscribe email sent to ${candidate.name || candidate.email}`,
        };
      }
      return {
        ok: false,
        message: `Failed to send unsubscribe email to ${cleanMailto}`,
      };
    }

    //Web-only non-One-Click link, deferred for later handling
    if (httpsLink) {
      return {
        ok: false,
        message: `Web unsubscription for ${candidate.name || candidate.email} is deferred for manual review.`,
      };
    }

    return {
      ok: false,
      message: `No unsubscribe link or email found for ${candidate.name || candidate.email}`,
    };
  }

  /**
   * Deletes all messages found associated of an email
   * @param {string} email Target email address
   * @return {Promise<number>} Number of emails deleted
   */
  async deleteSenderMessages(email: string): Promise<number> {
    await this.imap.connect();
    
    try {
      return await this.imap.deleteMessagesBySender(email);
    } finally {
      await this.imap.disconnect();
    }
  }
}
