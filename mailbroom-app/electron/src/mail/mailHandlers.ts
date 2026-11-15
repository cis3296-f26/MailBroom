import { IpcMain } from 'electron';
import { ImapClient } from './ImapClient';
import { SmtpClient } from './SmtpClient';
import { MailBroomService } from './MailBroomService';
import { ProviderConfig, UnsubscribeCandidate } from './types';

export function registerMailHandlers(ipcMain: IpcMain) {
  ipcMain.handle('fetch-emails', async (event, config: ProviderConfig) => {
    try {
      const imap = new ImapClient(config);
      const smtp = new SmtpClient(config);
      const service = new MailBroomService(imap, smtp);
      
      // Fetch up to 50 candidates
      const candidates = await service.getUnsubscribeCandidates(50);
      return { success: true, data: candidates };
    } catch (error: any) {
      console.error('Failed to fetch emails:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('send-unsubscribe', async (event, config: ProviderConfig, candidate: UnsubscribeCandidate) => {
    try {
      const imap = new ImapClient(config);
      const smtp = new SmtpClient(config);
      const service = new MailBroomService(imap, smtp);
      
      const result = await service.processUnsubscribe(candidate);
      return { success: result };
    } catch (error: any) {
      console.error('Failed to process unsubscribe:', error);
      return { success: false, error: error.message };
    }
  });
}