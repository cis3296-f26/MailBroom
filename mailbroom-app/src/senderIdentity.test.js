import assert from 'node:assert/strict';
import test from 'node:test';
import { getSenderIdentity } from './senderIdentity.js';

test('extracts sender identity and company domain from a mailing address', () => {
  assert.deepEqual(
    getSenderIdentity('Acme Updates <hello@news.acme.co.uk>'),
    {
      name: 'Acme Updates',
      email: 'hello@news.acme.co.uk',
      initials: 'AU',
      iconUrl: 'https://www.google.com/s2/favicons?domain=acme.co.uk&sz=64',
    }
  );
});

test('does not request a company icon for personal email domains', () => {
  const identity = getSenderIdentity('Jane Doe <jane@gmail.com>');
  assert.equal(identity.name, 'Jane Doe');
  assert.equal(identity.email, 'jane@gmail.com');
  assert.equal(identity.initials, 'JD');
  assert.equal(identity.iconUrl, null);
});
