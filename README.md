# @chatcore/server

A lightweight, flexible, and developer-first real-time chat framework designed to handle the heavy lifting of WebSocket orchestration while leaving the business logic in your hands.

## Installation

```bash
npm install @chatcore/server
```

## Features

- **Pluggable Architecture**: Bring your own Auth and DB
- **TypeScript Support**: Full type definitions included
- **Structured Event System**: Predefined types for messages, typing, and read receipts
- **Auto-reconnection**: Client handles reconnection automatically
- **Heartbeat**: Built-in ping/pong for connection health

## Usage

### 1. Server Setup

```typescript
import http from 'http';
import { createChatServer } from '@chatcore/server';

const server = http.createServer();

const chat = createChatServer(server, {
  authenticate: async (token) => {
    // Verify token and return user
    return { id: 'user_01', name: 'Alex' };
  },

  saveMessage: async (message) => {
    // Save to your database
    console.log('Saving:', message);
  },

  getMessages: async (conversationId, user) => {
    // Fetch from your database
    return [];
  },

  onEvent: (type, payload, user) => {
    console.log(`Event: ${type}`, payload);
  }
});

server.listen(3000, () => {
  console.log('Chat server running on port 3000');
});
```

### 2. Client Usage

```typescript
import { createChatClient, EventTypes } from '@chatcore/server';

const chat = createChatClient('ws://localhost:3000');

await chat.connect('valid-token');

chat.on(EventTypes.NEW_MESSAGE, (payload) => {
  console.log('New message:', payload);
});

chat.send(EventTypes.SEND_MESSAGE, {
  content: 'Hello!',
  to: 'user_02'
});

chat.disconnect();
```

## API

### Server

#### `createChatServer(httpServer, config)`

Creates a WebSocket chat server.

**Parameters:**
- `httpServer` - An HTTP server instance
- `config` - Configuration object

**Config:**
```typescript
interface ChatConfig {
  authenticate: (token: string) => Promise<User>;
  saveMessage: (message: Message) => Promise<void>;
  getMessages: (conversationId: string, user: User) => Promise<Message[]>;
  onEvent?: (type: string, payload: unknown, user: User | null) => void;
}
```

**Returns:**
```typescript
interface ChatServer {
  broadcast: (payload: unknown) => void;
  getActiveUsers: () => string[];
}
```

### Client

#### `createChatClient(url)`

Creates a WebSocket chat client.

**Parameters:**
- `url` - WebSocket server URL

**Returns:**
```typescript
interface ChatClient {
  connect: (token: string) => Promise<User>;
  send: (type: string, payload?: unknown) => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
  disconnect: () => void;
}
```

## Event Types

| Event | Direction | Description |
|-------|----------|-------------|
| `AUTH` | Client → Server | Initial handshake with token |
| `AUTH_SUCCESS` | Server → Client | Authentication successful |
| `AUTH_ERROR` | Server → Client | Authentication failed |
| `SEND_MESSAGE` | Client → Server | Send a message |
| `NEW_MESSAGE` | Server → Client | Incoming message |
| `MESSAGE_SENT` | Server → Client | Message sent confirmation |
| `GET_MESSAGES` | Client → Server | Request message history |
| `MESSAGES` | Server → Client | Message history response |
| `TYPING` | Bidirectional | Typing indicator |
| `READ` | Bidirectional | Message read receipt |
| `PING` | Bidirectional | Heartbeat |
| `ERROR` | Server → Client | Error response |

## TypeScript

This package is written in TypeScript and includes type definitions.

```typescript
import { createChatServer, type ChatConfig, type Message, type User } from '@chatcore/server';
```

## License

MIT