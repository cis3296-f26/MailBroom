import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProvider } from './emailProviders.js';

describe('emailProviders - resolveProvider', () => {
  it('resolves Google presets for gmail.com and googlemail.com', () => {
    const p1 = resolveProvider('test@gmail.com');
    assert.ok(p1);
    assert.strictEqual(p1.name, 'Google');
    assert.strictEqual(p1.imap.host, 'imap.gmail.com');
    assert.strictEqual(p1.imap.port, 993);
    assert.strictEqual(p1.smtp.host, 'smtp.gmail.com');
    assert.strictEqual(p1.smtp.port, 465);
    assert.strictEqual(p1.smtp.secure, true);

    const p2 = resolveProvider('user@googlemail.com');
    assert.strictEqual(p2?.name, 'Google');
  });

  it('resolves Microsoft presets for outlook, hotmail, live, and msn domains', () => {
    const outlook = resolveProvider('test@outlook.com');
    assert.ok(outlook);
    assert.strictEqual(outlook.name, 'Microsoft / Outlook');
    assert.strictEqual(outlook.imap.host, 'outlook.office365.com');
    assert.strictEqual(outlook.smtp.host, 'smtp.office365.com');
    assert.strictEqual(outlook.smtp.port, 587);
    assert.strictEqual(outlook.smtp.secure, false);

    assert.strictEqual(resolveProvider('user@hotmail.com')?.name, 'Microsoft / Outlook');
    assert.strictEqual(resolveProvider('user@live.com')?.name, 'Microsoft / Outlook');
    assert.strictEqual(resolveProvider('user@msn.com')?.name, 'Microsoft / Outlook');
  });

  it('resolves Yahoo/AOL presets with port 465 direct SSL', () => {
    const yahoo = resolveProvider('test@yahoo.com');
    assert.ok(yahoo);
    assert.strictEqual(yahoo.name, 'Yahoo / AOL');
    assert.strictEqual(yahoo.imap.host, 'imap.mail.yahoo.com');
    assert.strictEqual(yahoo.smtp.host, 'smtp.mail.yahoo.com');
    assert.strictEqual(yahoo.smtp.port, 465);
    assert.strictEqual(yahoo.smtp.secure, true);

    assert.strictEqual(resolveProvider('user@aol.com')?.name, 'Yahoo / AOL');
    assert.strictEqual(resolveProvider('user@ymail.com')?.name, 'Yahoo / AOL');
  });

  it('resolves Apple iCloud presets with port 587 STARTTLS', () => {
    const icloud = resolveProvider('user@icloud.com');
    assert.ok(icloud);
    assert.strictEqual(icloud.name, 'Apple iCloud');
    assert.strictEqual(icloud.imap.host, 'imap.mail.me.com');
    assert.strictEqual(icloud.smtp.host, 'smtp.mail.me.com');
    assert.strictEqual(icloud.smtp.port, 587);
    assert.strictEqual(icloud.smtp.secure, false);

    assert.strictEqual(resolveProvider('user@me.com')?.name, 'Apple iCloud');
    assert.strictEqual(resolveProvider('user@mac.com')?.name, 'Apple iCloud');
  });

  it('returns null for unknown or custom domains', () => {
    assert.strictEqual(resolveProvider('worker@company.org'), null);
    assert.strictEqual(resolveProvider('user@fastmail.com'), null);
    assert.strictEqual(resolveProvider('admin@custom-server.net'), null);
  });

  it('handles casing, whitespace, and invalid inputs gracefully', () => {
    assert.strictEqual(resolveProvider('  USER@GMAIL.COM  ')?.name, 'Google');
    assert.strictEqual(resolveProvider('User.Name@Hotmail.Com')?.name, 'Microsoft / Outlook');
    assert.strictEqual(resolveProvider(''), null);
    assert.strictEqual(resolveProvider('no-at-sign'), null);
    assert.strictEqual(resolveProvider(null), null);
    assert.strictEqual(resolveProvider(undefined), null);
  });
});
