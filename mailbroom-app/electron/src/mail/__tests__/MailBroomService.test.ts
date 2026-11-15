import { MailBroomService } from '../MailBroomService';
import { ImapClient } from '../ImapClient';
import { SmtpClient } from '../SmtpClient';

//Mockup versions of classes
jest.mock('../ImapClient');
jest.mock('../SmtpClient');

describe('MailBroomService', () => {
  let service: MailBroomService;
  let mockImap: jest.Mocked<ImapClient>;
  let mockSmtp: jest.Mocked<SmtpClient>;

  //Setup MailBroomService per test
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
    expect(mockImap.fetchHeaders).toHaveBeenCalledWith('1:*', ['list-unsubscribe']);
    expect(mockImap.disconnect).toHaveBeenCalledTimes(1);
  });

  test('filter out emails that lack a list-unsubscribe header', async () => {
    // 1. Arrange: Provide one junk email and one valid promotional email
    mockImap.fetchHeaders.mockResolvedValue([
      { envelope: { from: [{ address: 'mom@gmail.com' }] }, headers: '' },
      { envelope: { from: [{ address: 'spam@store.com' }] }, headers: 'list-unsubscribe: <mailto:unsub@store.com>' }
    ]);

    const results = await service.getUnsubscribeCandidates();

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('spam@store.com');
  });
});