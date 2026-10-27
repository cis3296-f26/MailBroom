require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopAPI', {
  loginWithGoogle: () => ipcRenderer.invoke('electron-google-login'),
  unsubscribe: (args: { url: string; oneClick: boolean }) =>
    ipcRenderer.invoke('unsubscribe-https', args),
});

console.log('User Preload!');