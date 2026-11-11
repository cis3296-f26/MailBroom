import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, BrowserWindow, ipcMain, shell, safeStorage } from 'electron';
import { OAuth2Client } from 'google-auth-library';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';

import * as fs from 'fs';
import * as path from 'path';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';

const appPathCredentials = path.join(app.getAppPath(), 'credentials.json');
const devPathCredentials = path.join(__dirname, '../../../credentials.json');
const credentialsPath = fs.existsSync(appPathCredentials)
  ? appPathCredentials
  : devPathCredentials;

let credentials: { CLIENT_ID: string; CLIENT_SECRET: string } = { CLIENT_ID: '', CLIENT_SECRET: '' };
if (fs.existsSync(credentialsPath)) {
  try {
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse credentials at ${credentialsPath}:`, err);
  }
} else {
  console.warn(`credentials.json not found at: ${credentialsPath}`);
}

const oAuth2Client = new OAuth2Client({
  clientId: credentials.CLIENT_ID, 
  clientSecret: credentials.CLIENT_SECRET, 
  redirectUri: 'http://localhost/callback',
  transporterOptions: {
    fetchImplementation: fetch,
  },
});
if (oAuth2Client.transporter) {
  oAuth2Client.transporter.defaults.fetchImplementation = fetch;
}

// Token Storage Helper Functions
const TOKEN_FILE_NAME = 'gmail-refresh-token.enc';
function getTokenFilePath(): string {
  return path.join(app.getPath('userData'), TOKEN_FILE_NAME);
}

function saveRefreshToken(refreshToken: string): boolean {
  try {
    const tokenPath = getTokenFilePath();
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(refreshToken);
      fs.writeFileSync(tokenPath, encrypted);
      return true;
    } else {
      console.warn('safeStorage encryption is unavailable on this platform.');
      return false;
    }
  } catch (err) {
    console.error('Failed to encrypt and store refresh token:', err);
    return false;
  }
}

function loadRefreshToken(): string | null {
  try {
    const tokenPath = getTokenFilePath();
    if (!fs.existsSync(tokenPath)) {
      return null;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('safeStorage encryption is unavailable on this platform.');
      return null;
    }
    const encrypted = fs.readFileSync(tokenPath);
    return safeStorage.decryptString(encrypted);
  } catch (err) {
    console.error('Failed to decrypt stored refresh token. Clearing corrupted/invalid file:', err);
    clearRefreshToken();
    return null;
  }
}

function clearRefreshToken(): void {
  try {
    const tokenPath = getTokenFilePath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  } catch (err) {
    console.error('Failed to delete stored refresh token file:', err);
  }
}

// Automatically save refreshed tokens if Google rotates the refresh token
oAuth2Client.on('tokens', (newTokens) => {
  if (newTokens.refresh_token) {
    saveRefreshToken(newTokens.refresh_token);
  }
});

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

    // IPC: Interactive Google OAuth login
    ipcMain.handle('electron-google-login', async () => {
      return new Promise((resolve, reject) => {
        const authWindow = new BrowserWindow({ width: 500, height: 600 });
        let settled = false;

        authWindow.on('closed', () => {
          if (!settled) {
            settled = true;
            reject(new Error('User closed the login window'));
          }
        });

        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent', // Ensures Google returns a refresh_token
          scope: ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.settings.basic'] as any
        });

        authWindow.loadURL(authUrl);

        authWindow.webContents.on('will-redirect', async (_event, url) => {
          const parsedUrl = new URL(url);
          if (parsedUrl.origin === 'http://localhost' && parsedUrl.pathname === '/callback') {
            settled = true;
            authWindow.close();
            const code = parsedUrl.searchParams.get('code');
            try {
              const { tokens } = await oAuth2Client.getToken(code!);
              oAuth2Client.setCredentials(tokens);
              if (tokens.refresh_token) {
                saveRefreshToken(tokens.refresh_token);
              }
              resolve(tokens.access_token);
            } catch (err) {
              reject(err);
            }
          }
        });
      });
    });

    // IPC: Silent retrieval/refresh of access token using stored safeStorage refresh token
    ipcMain.handle('electron-get-access-token', async () => {
      const refreshToken = loadRefreshToken();
      if (!refreshToken) return null;

      oAuth2Client.setCredentials({ refresh_token: refreshToken });
      try {
        const { token } = await oAuth2Client.getAccessToken();
        return token || null;
      } catch (err: any) {
        console.error('Failed to get access token using refresh token:', err);
        if (err?.message?.includes('invalid_grant')) {
          clearRefreshToken();
          oAuth2Client.setCredentials({});
        }
        return null;
      }
    });

    // IPC: Logout - deletes encrypted token and resets credentials
    ipcMain.handle('electron-logout', async () => {
      clearRefreshToken();
      oAuth2Client.setCredentials({});
      return { ok: true };
    });
  });

  // Check for updates if we are in a packaged app.
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('Auto-update check skipped/failed:', err?.message || err);
  });
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

ipcMain.handle('unsubscribe-https', async (_event, { url, oneClick }) => {
  if (!url.startsWith('https://')) return { ok: false, error: 'Not an https link' };
  if (oneClick) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    });
    return { ok: res.ok };
  }
  await shell.openExternal(url); // let the user confirm on the site
  return { ok: true, opened: true };
});
