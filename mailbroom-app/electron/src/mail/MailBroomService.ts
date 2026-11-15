import { ImapClient } from './ImapClient';
import { SmtpClient } from './SmtpClient';
import { UnsubscribeCandidate } from './types';

export class MailBroomService {
    private imap: ImapClient;
    private smtp: SmtpClient;

    constructor(imapClient : ImapClient, smtpClient: SmtpClient) {
        this.imap = imapClient;
        this.smtp = smtpClient;
    }

    /**
     * Connects to IMAP, scans inbox, returns formatted candidates
     * @param {number} [limit=50] - Max number of candidates to return
     */
    async getUnsubscribeCandidates(limit : number = 50) : Promise<UnsubscribeCandidate[]>{
    await this.imap.connect();
    const candidates: UnsubscribeCandidate[] = [];

    try {
      const messages = await this.imap.fetchHeaders('1:*', ['list-unsubscribe']);

      for (const msg of messages) {
        const headerString = msg.headers ? msg.headers.toString('utf-8').toLowerCase() : '';

        //Parse and keep emails with an unsubscribe header
        if (headerString.includes('list-unsubscribe:')) {
          const fromAddress = msg.envelope?.from?.[0]?.address || 'Unknown';
          const fromName = msg.envelope?.from?.[0]?.name || fromAddress;

          //Extract https or mailto link for unsubscribe
          const httpsMatch = headerString.match(/<(https:\/\/[^>]+)>/);
          const mailtoMatch = headerString.match(/<(mailto:[^>]+)>/);

          candidates.push({
            email: fromAddress,
            name: fromName,
            httpsUrl: httpsMatch ? httpsMatch[1] : undefined,
            mailtoUrl: mailtoMatch ? mailtoMatch[1] : undefined
          });
        }
      }
      return candidates.slice(0, limit);
    } finally {
      await this.imap.disconnect();
    }
  }

    /**
     * Executes unsubscribe either via https or smtp
     * @param {UnsubscribeCandidate} candidate
     * @returns {Promise<boolean>} - True if successful
     */
    async processUnsubscribe(candidate: UnsubscribeCandidate) : Promise<boolean> {
        throw new Error("MailBroomService.processUnsubscribe() not implemented");
    }
}