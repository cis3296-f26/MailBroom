import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, BrowserWindow, ipcMain } from 'electron';
import { OAuth2Client } from 'google-auth-library';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';

import * as fs from 'fs';
import * as path from 'path';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';

const credentialsPath = path.join(__dirname, '../../../credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

const oAuth2Client = new OAuth2Client(
  credentials.CLIENT_ID, 
  credentials.CLIENT_SECRET, 
  'http://localhost/callback'
);

// Graceful handling of unhandled errors.
unhandled();

// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}

// If we are in Dev mode, use the file watcher components.
if (electronIsDev) {
  setupReloadWatcher(myCapacitorApp);
}

// Run Application
(async () => {
  // Wait for electron app to be ready.
  app.whenReady().then(() => {
  // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());

  // Initialize our app, build windows, and load content.
  myCapacitorApp.init();

  // ... existing capacitor window creation ...

  ipcMain.handle('electron-google-login', async () => {
    return new Promise((resolve, reject) => {
      const authWindow = new BrowserWindow({ width: 500, height: 600 });
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://mail.google.com/']
      });

      authWindow.loadURL(authUrl);

      authWindow.webContents.on('will-redirect', async (event, url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === 'http://localhost' && parsedUrl.pathname === '/callback') {
          authWindow.close();
          const code = parsedUrl.searchParams.get('code');
          try {
            const { tokens } = await oAuth2Client.getToken(code);
            resolve(tokens.access_token);
          } catch (err) {
            reject(err);
          }
        }
      });
    });
  });
});
  // Check for updates if we are in a packaged app.
  autoUpdater.checkForUpdatesAndNotify();
})();

// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the dock icon is clicked.
app.on('activate', async function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});

// Place all ipc or other electron api calls and custom functionality under this line
