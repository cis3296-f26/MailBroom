require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopAPI', {
  loginWithGoogle: () => ipcRenderer.invoke('electron-google-login')
});

console.log('User Preload!');
