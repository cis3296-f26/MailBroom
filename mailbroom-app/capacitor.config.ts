import type { CapacitorConfig } from '@capacitor/cli';
import credentials from './credentials.json' with { type: 'json' };

const config: CapacitorConfig = {
  appId: 'com.yourname.mailbroom',
  appName: 'MailBroom',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email", "https://mail.google.com/"],
      serverClientId: credentials.CLIENT_ID,
      forceCodeForRefreshToken: true
    }
  }
};

export default config;