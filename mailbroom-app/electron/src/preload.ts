require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopAPI', {
  loginWithGoogle: () => ipcRenderer.invoke('electron-google-login'),
  getStoredAccessToken: () => ipcRenderer.invoke('electron-get-access-token'),
  logout: () => ipcRenderer.invoke('electron-logout'),
  unsubscribe: (args: { url: string; oneClick: boolean }) =>
    ipcRenderer.invoke('unsubscribe-https', args),
});

console.log('User Preload!');
