import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createChatServer } from './dist/index.js';

const mockUsers = new Map([
  ['user1', { id: 'user1', name: 'Alice' }],
  ['user2', { id: 'user2', name: 'Bob' }],
]);

const messages: unknown[] = [];

const server = createServer();
const wss = new WebSocketServer({ server });

const chatServer = createChatServer(server, {
  authenticate: async (token) => {
    const user = mockUsers.get(token);
    if (!user) throw new Error('Invalid token');
    return user;
  },

  saveMessage: async (message) => {
    messages.push(message);
    return message;
  },

  getMessages: async (conversationId, user, limit = 50) => {
    return messages.filter(m => 
      (m as { conversationId: string }).conversationId === conversationId
    ).slice(-limit);
  },

  getConversations: async (userId) => {
    const convs = new Map<string, unknown>();
    for (const m of messages) {
      const msg = m as { conversationId: string; senderId: string; to: string };
      if (msg.senderId === userId || msg.to === userId) {
        convs.set(msg.conversationId, {
          id: msg.conversationId,
          participants: [msg.senderId, msg.to],
          type: 'direct',
        });
      }
    }
    return Array.from(convs.values());
  },

  getUser: async (userId, requesterId) => {
    return mockUsers.get(userId) || null;
  },

  searchUsers: async (query) => {
    return Array.from(mockUsers.values()).filter(u => 
      u.name?.toLowerCase().includes(query.toLowerCase())
    );
  },

  searchMessages: async (query, userId) => {
    return messages.filter(m => 
      (m as { content: string }).content.toLowerCase().includes(query.toLowerCase())
    );
  },

  onEvent: (type, payload, user) => {
    console.log(`Event: ${type}`, user?.id, payload);
  },
});

server.listen(3000, () => {
  console.log('Chat server running on ws://localhost:3000');
  console.log('Test users: user1 (Alice), user2 (Bob)');
});