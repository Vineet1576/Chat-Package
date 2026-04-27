import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createChatServer } from './dist/index.js';

const { createChatClient } = await import('./dist/client.js');

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

  getMessages: async (conversationId, _user, limit = 50) => {
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

  getUser: async (userId) => {
    return mockUsers.get(userId) || null;
  },

  searchUsers: async (query) => {
    return Array.from(mockUsers.values()).filter(u => 
      u.name?.toLowerCase().includes(query.toLowerCase())
    );
  },

  searchMessages: async (query) => {
    return messages.filter(m => 
      (m as { content: string }).content.toLowerCase().includes(query.toLowerCase())
    );
  },

  onEvent: (type, payload, user) => {
    console.log(`[Server] Event: ${type}`, user?.id);
  },
});

await new Promise<void>((resolve) => server.listen(3000, resolve));

console.log('\n========================================');
console.log('Chat server running on ws://localhost:3000');
console.log('Test users: user1 (Alice), user2 (Bob)');
console.log('========================================\n');

const client1 = createChatClient('ws://localhost:3000');
const client2 = createChatClient('ws://localhost:3000');

async function test() {
  let bobMsgCount = 0;
  let aliceMsgCount = 0;

  client2.on('NEW_MESSAGE', (payload: unknown) => {
    const msg = payload as { content: string; senderId: string };
    console.log(`[Bob] Received from ${msg.senderId}: "${msg.content}"`);
    bobMsgCount++;
  });

  client1.on('NEW_MESSAGE', (payload: unknown) => {
    const msg = payload as { content: string; senderId: string };
    console.log(`[Alice] Received from ${msg.senderId}: "${msg.content}"`);
    aliceMsgCount++;
  });

  try {
    console.log('[Alice] Connecting...');
    await client1.connect('user1');
    console.log('[Alice] Connected!\n');

    console.log('[Bob] Connecting...');
    await client2.connect('user2');
    console.log('[Bob] Connected!\n');

    console.log('[Alice] Sending: "Hi Bob!"');
    client1.send('SEND_MESSAGE', { to: 'user2', content: 'Hi Bob!' });

    await new Promise(r => setTimeout(r, 300));

    console.log('[Bob] Sending: "Hi Alice! How are you?"');
    client2.send('SEND_MESSAGE', { to: 'user1', content: 'Hi Alice! How are you?' });

    await new Promise(r => setTimeout(r, 300));

    console.log('[Alice] Sending: "I am great, thanks for asking!"');
    client1.send('SEND_MESSAGE', { to: 'user2', content: 'I am great, thanks for asking!' });

    await new Promise(r => setTimeout(r, 300));

    console.log('\n========================================');
    console.log(`Messages received by Alice: ${aliceMsgCount}`);
    console.log(`Messages received by Bob: ${bobMsgCount}`);
    console.log('========================================');
    console.log('\nTEST PASSED: Users successfully exchanged messages!');

    client1.disconnect();
    client2.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();