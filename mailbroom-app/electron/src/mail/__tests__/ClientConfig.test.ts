import { SmtpClient } from '../SmtpClient';
import { ImapClient } from '../ImapClient';
import { DEFAULT_PROVIDER } from '../emailProviders';

describe('Multi-Provider Client Configuration', () => {
  describe('SmtpClient', () => {
    test('configures Google SMTP with port 465 and direct SSL (secure: true)', () => {
      const client = new SmtpClient({
        user: 'user@gmail.com',
        pass: 'app-password',
        host: 'imap.gmail.com',
        port: 993,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        secure: true,
      });

      const options = client.getTransportOptions();
      expect(options.host).toBe('smtp.gmail.com');
      expect(options.port).toBe(465);
      expect(options.secure).toBe(true);
      expect(options.auth).toEqual({ user: 'user@gmail.com', pass: 'app-password' });
    });

    test('configures Microsoft Outlook SMTP with port 587 and STARTTLS (secure: false)', () => {
      const client = new SmtpClient({
        user: 'user@outlook.com',
        pass: 'app-password',
        host: 'outlook.office365.com',
        port: 993,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        secure: false,
      });

      const options = client.getTransportOptions();
      expect(options.host).toBe('smtp.office365.com');
      expect(options.port).toBe(587);
      expect(options.secure).toBe(false);
      expect(options.auth.user).toBe('user@outlook.com');
    });

    test('configures Yahoo SMTP with port 465 and SSL', () => {
      const client = new SmtpClient({
        user: 'user@yahoo.com',
        pass: 'app-password',
        host: 'imap.mail.yahoo.com',
        port: 993,
        smtpHost: 'smtp.mail.yahoo.com',
        smtpPort: 465,
        secure: true,
      });

      const options = client.getTransportOptions();
      expect(options.host).toBe('smtp.mail.yahoo.com');
      expect(options.port).toBe(465);
      expect(options.secure).toBe(true);
    });

    test('configures Apple iCloud SMTP with port 587 and STARTTLS', () => {
      const client = new SmtpClient({
        user: 'user@icloud.com',
        pass: 'app-password',
        host: 'imap.mail.me.com',
        port: 993,
        smtpHost: 'smtp.mail.me.com',
        smtpPort: 587,
        secure: false,
      });

      const options = client.getTransportOptions();
      expect(options.host).toBe('smtp.mail.me.com');
      expect(options.port).toBe(587);
      expect(options.secure).toBe(false);
    });

    test('automatically resolves provider SMTP presets when host/port are omitted', () => {
      const outlook = new SmtpClient({ user: 'user@outlook.com', pass: 'pass' });
      expect(outlook.getTransportOptions().host).toBe('smtp.office365.com');
      expect(outlook.getTransportOptions().port).toBe(587);
      expect(outlook.getTransportOptions().secure).toBe(false);

      const yahoo = new SmtpClient({ user: 'user@yahoo.com', pass: 'pass' });
      expect(yahoo.getTransportOptions().host).toBe('smtp.mail.yahoo.com');
      expect(yahoo.getTransportOptions().port).toBe(465);
      expect(yahoo.getTransportOptions().secure).toBe(true);

      const icloud = new SmtpClient({ user: 'user@icloud.com', pass: 'pass' });
      expect(icloud.getTransportOptions().host).toBe('smtp.mail.me.com');
      expect(icloud.getTransportOptions().port).toBe(587);
      expect(icloud.getTransportOptions().secure).toBe(false);
    });

    test('auto-derives secure mode from custom port when secure flag is omitted', () => {
      const port465Client = new SmtpClient({
        user: 'admin@custom.org',
        pass: 'pass',
        smtpHost: 'smtp.custom.org',
        smtpPort: 465,
      });
      expect(port465Client.getTransportOptions().secure).toBe(true);

      const port587Client = new SmtpClient({
        user: 'admin@custom.org',
        pass: 'pass',
        smtpHost: 'smtp.custom.org',
        smtpPort: 587,
      });
      expect(port587Client.getTransportOptions().secure).toBe(false);
    });

    test('derives smtpHost from imap host if smtpHost is omitted', () => {
      const client = new SmtpClient({
        user: 'admin@domain.com',
        pass: 'pass',
        host: 'imap.domain.com',
      });
      expect(client.getTransportOptions().host).toBe('smtp.domain.com');
    });
  });

  describe('ImapClient', () => {
    test('configures Google IMAP with default port 993 and TLS', () => {
      const client = new ImapClient({
        user: 'user@gmail.com',
        pass: 'app-password',
        host: 'imap.gmail.com',
        port: 993,
      });

      const options = client.getClientOptions();
      expect(options.host).toBe('imap.gmail.com');
      expect(options.port).toBe(993);
      expect(options.secure).toBe(true);
      expect(options.auth).toEqual({ user: 'user@gmail.com', pass: 'app-password' });
    });

    test('automatically resolves provider IMAP presets when host is omitted', () => {
      const outlook = new ImapClient({ user: 'user@outlook.com', pass: 'pass' });
      expect(outlook.getClientOptions().host).toBe('outlook.office365.com');
      expect(outlook.getClientOptions().port).toBe(993);
      expect(outlook.getClientOptions().secure).toBe(true);

      const yahoo = new ImapClient({ user: 'user@yahoo.com', pass: 'pass' });
      expect(yahoo.getClientOptions().host).toBe('imap.mail.yahoo.com');
      expect(yahoo.getClientOptions().port).toBe(993);
      expect(yahoo.getClientOptions().secure).toBe(true);
    });

    test('configures custom IMAP on port 143 with STARTTLS (secure: false)', () => {
      const client = new ImapClient({
        user: 'user@localmail.net',
        pass: 'pass',
        host: 'mail.localmail.net',
        port: 143,
        secure: false,
      });

      const options = client.getClientOptions();
      expect(options.host).toBe('mail.localmail.net');
      expect(options.port).toBe(143);
      expect(options.secure).toBe(false);
    });

    test('defaults unknown domain safely to DEFAULT_PROVIDER preset', () => {
      const client = new ImapClient({
        user: 'user@example.com',
        pass: 'pass',
      });

      const options = client.getClientOptions();
      expect(options.host).toBe(DEFAULT_PROVIDER.imap.host);
      expect(options.port).toBe(DEFAULT_PROVIDER.imap.port);
      expect(options.secure).toBe(DEFAULT_PROVIDER.imap.secure);
    });
  });
});
