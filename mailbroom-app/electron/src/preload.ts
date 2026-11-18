require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
import { contextBridge, ipcRenderer } from 'electron';
import { ProviderConfig, Sender } from './mail/types';

contextBridge.exposeInMainWorld('desktopAPI', {
  // Credential management via safeStorage
  saveCredentials: (config: ProviderConfig) => 
    ipcRenderer.invoke('email-save-credentials', config),

  getStoredCredentials: () => 
    ipcRenderer.invoke('email-load-credentials'),

  clearCredentials: () => 
    ipcRenderer.invoke('email-clear-credentials'),

  logout: () => 
    ipcRenderer.invoke('electron-logout'),

  // Connection testing
  verifyCredentials: (config: ProviderConfig) =>
    ipcRenderer.invoke('verify-credentials', config),

  // Email fetching & unsubscription
  // added limit parameter
  fetchEmails: (config: ProviderConfig, limit: number = 50) => 
    ipcRenderer.invoke('fetch-emails', config, limit),
    
  sendUnsubscribe: (config: ProviderConfig, candidate: Sender) => 
    ipcRenderer.invoke('send-unsubscribe', config, candidate),

  deleteMessages: (config: ProviderConfig, senderEmail: string) => 
    ipcRenderer.invoke('delete-messages', config, senderEmail),

  // External browser navigation
  openExternal: (url: string) => 
    ipcRenderer.invoke('open-external', url),
});

console.log('MailBroom Desktop API loaded');