import { MessagesService } from '../src/modules/messages/messages.service';

const prismaMocks = {
  conversationParticipant: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  conversation: { findFirst: jest.fn(), create: jest.fn() },
  message: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() }
};

jest.mock('../src/config/prisma', () => ({ prisma: prismaMocks }));

describe('MessagesService', () => {
  it('sends a message', async () => {
    prismaMocks.message.create.mockResolvedValue({ id: 'message-1', content: 'hello' });
    const service = new MessagesService();

    const message = await service.sendMessage('conversation-1', 'user-1', { content: 'hello', messageType: 'TEXT' });

    expect(message.id).toBe('message-1');
    expect(prismaMocks.message.create).toHaveBeenCalled();
  });
});
