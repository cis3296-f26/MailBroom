import { app, IpcMain, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ImapClient } from './ImapClient';
import { SmtpClient } from './SmtpClient';
import { MailBroomService } from './MailBroomService';
import { ProviderConfig, UnsubscribeCandidate } from './types';

// Encrypted Credential Storage using safeStorage (DPAPI / Keychain)
const CREDENTIALS_FILE_NAME = 'email-credentials.enc';

function getCredentialsFilePath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE_NAME);
}

export function saveEmailCredentials(config: ProviderConfig): boolean {
  try {
    const credsPath = getCredentialsFilePath();
    const data = JSON.stringify(config);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(credsPath, encrypted);
      return true;
    } else {
      fs.writeFileSync(credsPath, data);
      return true;
    }
  } catch (err) {
    console.error('Failed to encrypt and store email credentials:', err);
    return false;
  }
}

export function loadEmailCredentials(): ProviderConfig | null {
  try {
    const credsPath = getCredentialsFilePath();
    if (!fs.existsSync(credsPath)) return null;
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(credsPath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    }
    const plain = fs.readFileSync(credsPath, 'utf-8');
    return JSON.parse(plain);
  } catch (err) {
    console.error('Failed to read or decrypt stored email credentials:', err);
    clearEmailCredentials();
    return null;
  }
}

export function clearEmailCredentials(): void {
  try {
    const credsPath = getCredentialsFilePath();
    if (fs.existsSync(credsPath)) {
      fs.unlinkSync(credsPath);
    }
  } catch (err) {
    console.error('Failed to clear email credentials file:', err);
  }
}

export function registerMailHandlers(ipcMain: IpcMain) {
  // Test connection and credentials without fetching full mailbox
  ipcMain.handle('verify-credentials', async (_event, config: ProviderConfig) => {
    try {
      const imap = new ImapClient(config);
      await imap.connect();
      await imap.disconnect();
      return { success: true };
    } catch (error: any) {
      console.error('Failed to verify credentials:', error);
      return { success: false, error: error?.message || 'Connection failed' };
    }
  });

  // Fetch candidate senders with unsubscribe options
  ipcMain.handle('fetch-emails', async (_event, config: ProviderConfig) => {
    try {
      const imap = new ImapClient(config);
      const smtp = new SmtpClient(config);
      const service = new MailBroomService(imap, smtp);
      
      const candidates = await service.getUnsubscribeCandidates(50);
      return { success: true, data: candidates };
    } catch (error: any) {
      console.error('Failed to fetch emails:', error);
      return { success: false, error: error?.message || 'Failed to fetch emails' };
    }
  });

  // Execute unsubscribe (automated One-Click POST or SMTP email; defers non-one-click web popups)
  ipcMain.handle('send-unsubscribe', async (_event, config: ProviderConfig, candidate: UnsubscribeCandidate) => {
    try {
      const imap = new ImapClient(config);
      const smtp = new SmtpClient(config);
      const service = new MailBroomService(imap, smtp);
      
      const result = await service.processUnsubscribe(candidate);
      return { success: result.ok, message: result.message };
    } catch (error: any) {
      console.error('Failed to process unsubscribe:', error);
      return { success: false, error: error?.message || 'Unsubscribe action failed' };
    }
  });

  // Credential storage handlers (safeStorage)
  ipcMain.handle('email-save-credentials', async (_event, config: ProviderConfig) => {
    const saved = saveEmailCredentials(config);
    return { success: saved };
  });

  ipcMain.handle('email-load-credentials', async () => {
    const creds = loadEmailCredentials();
    return { success: !!creds, data: creds };
  });

  ipcMain.handle('email-clear-credentials', async () => {
    clearEmailCredentials();
    return { success: true };
  });

  // Logout handler
  ipcMain.handle('electron-logout', async () => {
    clearEmailCredentials();
    return { ok: true };
  });

  // External link handler
  ipcMain.handle('open-external', async (_event, url: string) => {
    try {
      if (typeof url === 'string' && (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('mailto:'))) {
        const { shell } = await import('electron');
        await shell.openExternal(url);
        return { success: true };
      }
      return { success: false, error: 'Invalid URL scheme' };
    } catch (err: any) {
      console.error('Failed to open external link:', err);
      return { success: false, error: err?.message || 'Failed to open link' };
    }
  });
}

// Backward-compatible alias
export const registerEmailHandlers = registerMailHandlers;
