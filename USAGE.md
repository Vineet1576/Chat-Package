# @chatcore/server - Complete Usage Guide

A full-featured real-time chat framework like WhatsApp/Telegram.

---

## Quick Start

```bash
cd Chat-Package
npm install
npm run build
```

---

## All Features

This package includes everything you need for a full messaging platform:

- 1:1 Chat & Group Chat
- Message Reactions (emoji)
- Message Edit/Delete
- Reply to Messages (Threading)
- Forward Messages
- Pin Messages
- File/Image/Audio/Video sharing
- Online Presence & Last Seen
- Typing Indicators
- Read Receipts
- Block/Unblock Users
- User Search
- Message Search
- User Profile Management

---

## Server Setup

```typescript
import http from 'http';
import { createChatServer, EventTypes, type Message, type User, type Conversation } from '@chatcore/server';

const server = http.createServer();

createChatServer(server, {
  // REQUIRED: Verify token and return user
  authenticate: async (token: string): Promise<User> => {
    const user = await db.users.findOne({ token });
    if (!user) throw new Error('Invalid token');
    return user;
  },

  // REQUIRED: Save/edit/delete message
  saveMessage: async (message: Message): Promise<Message> => {
    return await db.messages.save(message);
  },

  // REQUIRED: Fetch messages
  getMessages: async (conversationId: string, user: User, limit?: number): Promise<Message[]> => {
    return await db.messages.find({ conversationId }, { limit: limit || 50 });
  },

  // REQUIRED: Fetch user's conversations
  getConversations: async (userId: string): Promise<Conversation[]> => {
    return await db.conversations.find({ participants: userId });
  },

  // REQUIRED: Get user profile
  getUser: async (userId: string, requesterId: string): Promise<User | null> => {
    return await db.users.findOne({ id: userId });
  },

  // REQUIRED: Search users
  searchUsers: async (query: string): Promise<User[]> => {
    return await db.users.search(query);
  },

  // REQUIRED: Search messages
  searchMessages: async (query: string, userId: string): Promise<Message[]> => {
    return await db.messages.search(query, { userId });
  },

  // OPTIONAL: Event hook for analytics
  onEvent: (type, payload, user) => {
    console.log(`[${type}]`, user?.id, payload);
  }
});

server.listen(3000, () => {
  console.log('Chat server on http://localhost:3000');
});
```

---

## Client Usage

```typescript
import { createChatClient, EventTypes } from '@chatcore/server';

const chat = createChatClient('ws://localhost:3000');

await chat.connect('your-token');

// Listen to events
chat.on(EventTypes.NEW_MESSAGE, (payload) => { /* handle new message */ });
chat.on(EventTypes.TYPING, (payload) => { /* handle typing */ });
chat.on(EventTypes.READ_RECEIPT, (payload) => { /* handle read receipt */ });
chat.on(EventTypes.REACTION, (payload) => { /* handle reaction */ });
chat.on(EventTypes.OFFLINE, (payload) => { /* user went offline */ });

// Send Messages
chat.send(EventTypes.SEND_MESSAGE, {
  content: 'Hello!',
  to: 'user_02',
  conversationId: 'user_01:user_02',
  type: 'text', // text, image, video, audio, file
  metadata: {} // any custom data
});

// Reply/Thread
chat.send(EventTypes.SEND_MESSAGE, {
  content: 'Replying to...',
  to: 'user_02',
  replyTo: 'message_id_to_reply_to'
});

// Forward message
chat.send(EventTypes.FORWARD_MESSAGE, {
  messageId: 'original_message_id',
  to: 'recipient_id'
});

// Edit message
chat.send(EventTypes.EDIT_MESSAGE, {
  messageId: 'message_id',
  content: 'Updated content',
  to: 'user_02'
});

// Delete message
chat.send(EventTypes.DELETE_MESSAGE, {
  messageId: 'message_id',
  to: 'user_02'
});

// React to message
chat.send(EventTypes.REACTION, {
  messageId: 'message_id',
  emoji: '👍',
  to: 'user_02'
});

// Typing indicator
chat.send(EventTypes.TYPING, {
  to: 'user_02',
  conversationId: 'user_01:user_02',
  state: 'started' // or 'stopped'
});

// Send read receipt
chat.send(EventTypes.READ, {
  to: 'user_02',
  conversationId: 'user_01:user_02',
  messageId: 'message_id'
});

// Get messages
chat.send(EventTypes.GET_MESSAGES, {
  conversationId: 'user_01:user_02',
  limit: 50
});

// Get conversations
chat.send(EventTypes.GET_CONVERSATIONS, {});

// Create group
chat.send(EventTypes.CREATE_GROUP_CHAT, {
  name: 'My Group',
  avatar: 'https://...',
  participants: ['user_03', 'user_04', 'user_05']
});

// Join group
chat.send(EventTypes.JOIN_GROUP, {
  groupId: 'group_id'
});

// Leave group
chat.send(EventTypes.LEAVE_GROUP, {
  groupId: 'group_id'
});

// Update group (name, avatar, add/remove members, make admin)
chat.send(EventTypes.UPDATE_GROUP, {
  groupId: 'group_id',
  updateType: 'name',
  userId: 'user_to_add',
  data: { newName: 'New Group Name' }
});

// Pin/Unpin message
chat.send(EventTypes.PIN_MESSAGE, {
  messageId: 'message_id',
  to: 'user_02',
  conversationId: 'conversation_id'
});

// Block/Unblock user
chat.send(EventTypes.BLOCK_USER, {
  userId: 'user_to_block'
});

// Search users
chat.send(EventTypes.SEARCH_USERS, {
  query: 'john'
});

// Search messages
chat.send(EventTypes.SEARCH_MESSAGES, {
  query: 'hello'
});

// Get user profile
chat.send(EventTypes.GET_USER, {
  userId: 'user_id'
});

// Update profile
chat.send(EventTypes.UPDATE_PROFILE, {
  name: 'New Name',
  bio: 'New bio'
});

// Update settings
chat.send(EventTypes.UPDATE_SETTINGS, {
  notifications: true,
  readReceipts: true,
  typingIndicator: false
});
```

---

## Complete Event Reference

| Event | Sender | Payload |
|-------|--------|---------|
| **Auth** |||
| `AUTH` | Client | `{ token: string }` |
| `AUTH_SUCCESS` | Server | `{ user, isOnline }` |
| `AUTH_ERROR` | Server | `{ message }` |
| **Messages** |||
| `SEND_MESSAGE` | Client | `{ content, to, conversationId, type?, replyTo?, metadata? }` |
| `NEW_MESSAGE` | Server | `Message` |
| `MESSAGE_SENT` | Server | `{ id, message }` |
| `EDIT_MESSAGE` | Client | `{ messageId, content }` |
| `MESSAGE_EDITED` | Server | `{ messageId, content }` |
| `DELETE_MESSAGE` | Client | `{ messageId }` |
| `MESSAGE_DELETED` | Server | `{ messageId }` |
| **Message Content** |||
| `REPLY` | Client | Reply to message |
| `FORWARD_MESSAGE` | Client | `{ messageId, to }` |
| `REACTION` | Client | `{ messageId, emoji }` |
| `MESSAGE_REACTION` | Server | `{ messageId, userId, emoji }` |
| **Fetching** |||
| `GET_MESSAGES` | Client | `{ conversationId, limit? }` |
| `MESSAGES` | Server | `{ conversationId, messages }` |
| `GET_CONVERSATIONS` | Client | - |
| `CONVERSATIONS` | Server | `Conversation[]` |
| **Typing & Read** |||
| `TYPING` | Both | `{ from, to, conversationId, state }` |
| `READ` | Both | `{ from, to, conversationId, messageId }` |
| `READ_RECEIPT` | Server | `{ from, to, conversationId, messageId }` |
| **Presence** |||
| `ONLINE` | Server | `{ userId }` |
| `OFFLINE` | Server | `{ userId, lastSeen }` |
| **Groups** |||
| `CREATE_GROUP_CHAT` | Client | `{ name, avatar?, participants }` |
| `GROUP_CREATED` | Server | `Conversation` |
| `JOIN_GROUP` | Client | `{ groupId }` |
| `GROUP_JOINED` | Server | `Conversation` |
| `LEAVE_GROUP` | Client | `{ groupId }` |
| `GROUP_LEFT` | Server | `{ groupId }` |
| `GROUP_MEMBER_JOINED` | Server | `{ groupId, userId }` |
| `GROUP_MEMBER_LEFT` | Server | `{ groupId, userId }` |
| `UPDATE_GROUP` | Client | `{ groupId, updateType, userId, data }` |
| `GROUP_UPDATED` | Server | `{ groupId, update }` |
| **Pins** |||
| `PIN_MESSAGE` | Client | `{ messageId, to, conversationId }` |
| `MESSAGE_PINNED` | Server | `{ messageId, conversationId }` |
| `UNPIN_MESSAGE` | Client | `{ messageId, to, conversationId }` |
| `MESSAGE_UNPINNED` | Server | `{ messageId, conversationId }` |
| **Block** |||
| `BLOCK_USER` | Client | `{ userId }` |
| `USER_BLOCKED` | Server | `{ userId }` |
| `UNBLOCK_USER` | Client | `{ userId }` |
| `USER_UNBLOCKED` | Server | `{ userId }` |
| **Search** |||
| `SEARCH_USERS` | Client | `{ query }` |
| `USER_SEARCH` | Server | `User[]` |
| `SEARCH_MESSAGES` | Client | `{ query }` |
| `SEARCH_RESULTS` | Server | `Message[]` |
| **User** |||
| `GET_USER` | Client | `{ userId }` |
| `USER_PROFILE` | Server | `User` |
| `UPDATE_PROFILE` | Client | `{ name?, bio?, avatar? }` |
| `PROFILE_UPDATED` | Server | `User` |
| `UPDATE_SETTINGS` | Client | `{ notifications?, readReceipts?, typingIndicator? }` |
| `SETTINGS_UPDATED` | Server | `UserSettings` |

---

## Type Definitions

### Message Types
```typescript
type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'link';
```

### Conversation Types
```typescript
type ConversationType = 'direct' | 'group';
```

### Message Interface
```typescript
interface Message {
  id: string;
  senderId: string;
  content: string;
  to: string;
  conversationId: string;
  type: MessageType;
  replyTo?: string;
  forwardedFrom?: string;
  reactions?: MessageReaction[];
  media?: MediaAttachment[];
  metadata?: Record<string, unknown>;
  editedAt?: number;
  deletedAt?: number;
  createdAt: number;
}
```

### Conversation Interface
```typescript
interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar?: string;
  participants: string[];
  adminIds?: string[];
  lastMessage?: Message;
  pinnedMessageIds?: string[];
  createdAt: number;
  updatedAt: number;
}
```

### User Interface
```typescript
interface User {
  id: string;
  name?: string;
  avatar?: string;
  bio?: string;
  lastSeen?: number;
  isOnline?: boolean;
  settings?: {
    notifications?: boolean;
    readReceipts?: boolean;
    typingIndicator?: boolean;
  };
}
```

---

## With Express

```typescript
import express from 'express';
import { createServer } from 'http';
import { createChatServer } from '@chatcore/server';

const app = express();
const server = createServer(app);

// Chat WebSocket
createChatServer(server, {
  authenticate: async (token) => { /* ... */ },
  saveMessage: async (m) => { /* ... */ },
  getMessages: async (id, u, l) => { /* ... */ },
  getConversations: async (id) => { /* ... */ },
  getUser: async (id, r) => { /* ... */ },
  searchUsers: async (q) => { /* ... */ },
  searchMessages: async (q, u) => { /* ... */ }
});

// Your API routes
app.get('/api/user', (req, res) => { res.json({}); });

server.listen(3000, () => {
  console.log('Server on http://localhost:3000');
});
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PAYLOAD` | JSON parse failed |
| `UNAUTHENTICATED` | Event before auth |
| `AUTH_ERROR` | Invalid token |
| `NOT_IMPLEMENTED` | Handler missing |

---

## Build & Test

```bash
npm run build   # Compile
npm test       # Run tests
npm start      # Run example
```