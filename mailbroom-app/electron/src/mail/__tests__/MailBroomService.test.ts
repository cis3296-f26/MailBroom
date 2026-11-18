import { MailBroomService } from '../MailBroomService';
import { ImapClient } from '../ImapClient';
import { SmtpClient } from '../SmtpClient';

// Mock versions of classes
jest.mock('../ImapClient');
jest.mock('../SmtpClient');

describe('MailBroomService', () => {
  let service: MailBroomService;
  let mockImap: jest.Mocked<ImapClient>;
  let mockSmtp: jest.Mocked<SmtpClient>;

  // Setup MailBroomService per test
  beforeEach(() => {
    jest.clearAllMocks();
    mockImap = new ImapClient({} as any) as jest.Mocked<ImapClient>;
    mockSmtp = new SmtpClient({} as any) as jest.Mocked<SmtpClient>;
    service = new MailBroomService(mockImap, mockSmtp);
  });

  test('connect, fetch nothing when inbox is empty, and disconnect', async () => {
    mockImap.fetchHeaders.mockResolvedValue([]);

    const results = await service.getUnsubscribeCandidates();

    expect(results).toEqual([]);
    expect(mockImap.connect).toHaveBeenCalledTimes(1);
    expect(mockImap.fetchHeaders).toHaveBeenCalledWith('1:*', ['list-unsubscribe', 'list-unsubscribe-post']);
    expect(mockImap.disconnect).toHaveBeenCalledTimes(1);
  });

  test('filter out emails that lack a list-unsubscribe header', async () => {
    mockImap.fetchHeaders.mockResolvedValue([
      { envelope: { from: [{ address: 'mom@gmail.com' }] }, headers: '' },
      { envelope: { from: [{ address: 'spam@store.com' }] }, headers: 'list-unsubscribe: <mailto:unsub@store.com>' }
    ]);

    const results = await service.getUnsubscribeCandidates();

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('spam@store.com');
  });

  test('aggregates multiple emails from the same sender and computes counts', async () => {
    mockImap.fetchHeaders.mockResolvedValue([
      {
        envelope: { from: [{ name: 'Store', address: 'newsletter@store.com' }], subject: 'Promo 1', date: new Date('2026-01-01') },
        headers: 'list-unsubscribe: <https://store.com/unsub>\r\nlist-unsubscribe-post: List-Unsubscribe=One-Click',
        flags: new Set(['\\Seen'])
      },
      {
        envelope: { from: [{ name: 'Store', address: 'newsletter@store.com' }], subject: 'Promo 2', date: new Date('2026-01-02') },
        headers: 'list-unsubscribe: <https://store.com/unsub>\r\nlist-unsubscribe-post: List-Unsubscribe=One-Click',
        flags: new Set()
      }
    ]);

    const results = await service.getUnsubscribeCandidates();

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('newsletter@store.com');
    expect(results[0].count).toBe(2);
    expect(results[0].opened).toBe(1);
    expect(results[0].unread).toBe(1);
    expect(results[0].oneClick).toBe(true);
    expect(results[0].latest?.subject).toBe('Promo 2');
  });

  test('processes mailto unsubscribe via SMTP', async () => {
    mockSmtp.sendMail.mockResolvedValue(true);

    const result = await service.processUnsubscribe({
      email: 'news@store.com',
      name: 'Store',
      from: 'Store <news@store.com>',
      count: 1,
      opened: 1,
      unread: 0,
      mailtoUrl: 'mailto:unsub@store.com?subject=cancel',
      oneClick: false,
    });

    expect(result.ok).toBe(true);
    expect(mockSmtp.sendMail).toHaveBeenCalledWith('unsub@store.com', 'unsubscribe', 'unsubscribe');
  });

  test('processes RFC 8058 One-Click HTTPS unsubscribe via HTTP POST', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch as any;

    try {
      const result = await service.processUnsubscribe({
        email: 'news@store.com',
        name: 'Store',
        from: 'Store <news@store.com>',
        count: 1,
        opened: 0,
        unread: 1,
        httpsUrl: 'https://store.com/unsub/oneclick',
        oneClick: true,
      });

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://store.com/unsub/oneclick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('falls back to mailto if non-one-click HTTPS is present alongside mailto', async () => {
    mockSmtp.sendMail.mockResolvedValue(true);

    const result = await service.processUnsubscribe({
      email: 'news@store.com',
      name: 'Store',
      from: 'Store <news@store.com>',
      count: 1,
      opened: 1,
      unread: 0,
      httpsUrl: 'https://store.com/unsub/form',
      mailtoUrl: 'mailto:unsub@store.com',
      oneClick: false,
    });

    expect(result.ok).toBe(true);
    expect(mockSmtp.sendMail).toHaveBeenCalledWith('unsub@store.com', 'unsubscribe', 'unsubscribe');
  });

  test('holds off on opening browser window for web-only non-one-click unsubscribe', async () => {
    const result = await service.processUnsubscribe({
      email: 'news@store.com',
      name: 'Store',
      from: 'Store <news@store.com>',
      count: 1,
      opened: 1,
      unread: 0,
      httpsUrl: 'https://store.com/unsub/form',
      oneClick: false,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/deferred/i);
  });

  test('returns error when candidate has no unsubscribe links', async () => {
    const result = await service.processUnsubscribe({
      email: 'news@store.com',
      name: 'Store',
      from: 'Store <news@store.com>',
      count: 1,
      opened: 0,
      unread: 1,
      oneClick: false,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No unsubscribe link/);
  });

  describe('deleteSenderMessages', () => {
    test('connects, delegates to deleteMessagesBySender, returns count, and disconnects', async () => {
      mockImap.deleteMessagesBySender.mockResolvedValue(5);

      const count = await service.deleteSenderMessages('news@store.com');

      expect(count).toBe(5);
      expect(mockImap.connect).toHaveBeenCalledTimes(1);
      expect(mockImap.deleteMessagesBySender).toHaveBeenCalledWith('news@store.com');
      expect(mockImap.disconnect).toHaveBeenCalledTimes(1);
    });

    test('always disconnects even if deleteMessagesBySender throws', async () => {
      mockImap.deleteMessagesBySender.mockRejectedValue(new Error('Connection dropped'));

      await expect(service.deleteSenderMessages('news@store.com')).rejects.toThrow('Connection dropped');
      expect(mockImap.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
