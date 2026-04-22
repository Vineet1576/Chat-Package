# Chat Core

A lightweight, flexible, real-time chat framework built around native WebSockets and pluggable handlers.

## Features

- Pluggable authentication
- Custom persistence adapter support
- Event hooks for logging, analytics, or business logic
- Built-in support for `SEND_MESSAGE`, `GET_MESSAGES`, `TYPING`, and `READ`

## Installation

```bash
npm install ws uuid
```

## Server Usage

```js
import http from "http";
import { createChatServer } from "./index.js";

const server = http.createServer();

createChatServer(server, {
  authenticate: async (token) => {
    return { id: "user_01", name: "Alex" };
  },
  saveMessage: async (message) => {
    // save to DB
  },
  getMessages: async (conversationId) => {
    return [];
  },
  onEvent: (type, payload, user) => {
    console.log(type, payload, user);
  }
});

server.listen(3000);
```

## Client Protocol

Send JSON messages with a `type` and optional `payload`:

- `AUTH` — `{ type: "AUTH", token: "..." }`
- `SEND_MESSAGE` — `{ type: "SEND_MESSAGE", payload: { content, to, conversationId } }`
- `GET_MESSAGES` — `{ type: "GET_MESSAGES", payload: { conversationId } }`
- `TYPING` — `{ type: "TYPING", payload: { to, conversationId, state } }`
- `READ` — `{ type: "READ", payload: { to, conversationId, messageId } }`

## Example

```bash
node example-server.js
```
