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
        throw new Error("MailBroomService.getUnsubscribeCandidate() not implemented");
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