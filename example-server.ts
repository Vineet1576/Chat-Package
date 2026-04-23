import http from 'http';
import { createChatServer, EventTypes, type Message, type User, type Conversation } from '@chatcore/server';

const users = new Map<string, User>();
const messages = new Map<string, Message[]>();
const conversations = new Map<string, Conversation>();

async function authenticate(token: string): Promise<User> {
  const user = users.get(token);
  if (!user) throw new Error('Invalid token');
  return user;
}

async function saveMessage(message: Message): Promise<Message> {
  const convMessages = messages.get(message.conversationId) || [];
  convMessages.push(message);
  messages.set(message.conversationId, convMessages);
  return message;
}

async function getMessages(conversationId: string, user: User, limit = 50): Promise<Message[]> {
  return messages.get(conversationId)?.slice(-limit) || [];
}

async function getConversations(userId: string): Promise<Conversation[]> {
  return Array.from(conversations.values()).filter(c => c.participants.includes(userId));
}

async function getUser(userId: string, requesterId: string): Promise<User | null> {
  return users.get(userId) || null;
}

async function searchUsers(query: string): Promise<User[]> {
  return Array.from(users.values()).filter(u => u.name?.toLowerCase().includes(query.toLowerCase()));
}

async function searchMessages(query: string, userId: string): Promise<Message[]> {
  const results: Message[] = [];
  for (const msgs of messages.values()) {
    results.push(...msgs.filter(m => m.content.toLowerCase().includes(query.toLowerCase())));
  }
  return results;
}

const server = http.createServer();

const chat = createChatServer(server, {
  authenticate,
  saveMessage,
  getMessages,
  getConversations,
  getUser,
  searchUsers,
  searchMessages,
  onEvent: (type, payload, user) => {
    console.log(`[${type}]`, user?.id);
  },
});

server.listen(3000, () => {
  const user1: User = { id: 'user_01', name: 'Alice', isOnline: true };
  const user2: User = { id: 'user_02', name: 'Bob', isOnline: false, lastSeen: Date.now() };
  const user3: User = { id: 'user_03', name: 'Charlie', isOnline: true };

  users.set('token_alice', user1);
  users.set('token_bob', user2);
  users.set('token_charlie', user3);

  const conv1: Conversation = {
    id: 'user_01:user_02',
    type: 'direct',
    participants: ['user_01', 'user_02'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  conversations.set(conv1.id, conv1);

  console.log('Chat server running on http://localhost:3000');
  console.log('Test users: Alice (token_alice), Bob (token_bob), Charlie (token_charlie)');
});