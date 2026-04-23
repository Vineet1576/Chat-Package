import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'http';
import { EventTypes } from './events.js';
import type { 
  ChatConfig, 
  ChatServer, 
  User, 
  Message, 
  Conversation,
  MessageReaction,
  TypingPayload,
  ReadPayload,
  GroupCreatePayload,
  BlockPayload,
  GroupUpdate
} from './types.js';
import { validateConfig } from './validate.js';

interface ConnectedClient {
  ws: WebSocket;
  user: User;
}

export function createChatServer(server: Server, config: ChatConfig): ChatServer {
  validateConfig(config);

  const wss = new WebSocketServer({ server });
  const clients = new Map<string, ConnectedClient>();

  wss.on('connection', (ws: WebSocket) => {
    let user: User | null = null;

    const sendMessage = (type: string, payload?: unknown): void => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
      }
    };

    const sendError = (code: string, message: string, details?: unknown): void => {
      sendMessage(EventTypes.ERROR, { code, message, details });
    };

    const broadcastTo = (userIds: string[], type: string, payload: unknown): void => {
      const message = JSON.stringify({ type, payload });
      for (const userId of userIds) {
        const client = clients.get(userId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
        }
      }
    };

    const isOnline = (userId: string): boolean => {
      const client = clients.get(userId);
      return client?.ws.readyState === WebSocket.OPEN;
    };

    ws.on('message', async (raw: Buffer): Promise<void> => {
      let data: { type: string; token?: string; payload?: unknown };
      try {
        data = JSON.parse(raw.toString());
      } catch {
        sendError('INVALID_PAYLOAD', 'Unable to parse JSON');
        return;
      }

      if (!user) {
        if (data.type === EventTypes.AUTH) {
          try {
            user = await handleAuth(ws, data.token!, config, clients, sendMessage);
          } catch {
            ws.close();
          }
        } else if (data.type !== EventTypes.PING) {
          sendError('UNAUTHENTICATED', 'Please authenticate before sending events.');
        }
        return;
      }

      await handleEvent(ws, user, data, config, clients, sendMessage, sendError, broadcastTo, isOnline);
    });

    ws.on('close', (): void => {
      if (user) {
        clients.delete(user.id);
        broadcastTo([user.id], EventTypes.OFFLINE, { userId: user.id, lastSeen: Date.now() });
        config.onEvent?.(EventTypes.DISCONNECT, null, user);
      }
    });

    ws.on('error', (err: Error): void => {
      config.onEvent?.(EventTypes.WS_ERROR, { error: err.message }, user);
    });
  });

  return {
    broadcast(payload: unknown): void {
      const message = JSON.stringify(payload);
      for (const client of clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
        }
      }
    },
    broadcastTo(userIds: string[], payload: unknown): void {
      const message = JSON.stringify(payload);
      for (const userId of userIds) {
        const client = clients.get(userId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
        }
      }
    },
    getActiveUsers(): string[] {
      return Array.from(clients.keys());
    },
    isUserOnline(userId: string): boolean {
      const client = clients.get(userId);
      return client?.ws.readyState === WebSocket.OPEN;
    },
  };
}

async function handleAuth(
  ws: WebSocket,
  token: string,
  config: ChatConfig,
  clients: Map<string, ConnectedClient>,
  sendMessage: (type: string, payload?: unknown) => void
): Promise<User> {
  if (!token) {
    sendMessage(EventTypes.ERROR, { code: 'AUTH_ERROR', message: 'Missing authentication token.' });
    throw new Error('Missing token');
  }

  const user = await config.authenticate(token);

  if (!user || !user.id) {
    sendMessage(EventTypes.ERROR, { code: 'AUTH_ERROR', message: 'Invalid user object returned by authenticate.' });
    throw new Error('Invalid user');
  }

  clients.set(user.id, { ws, user });
  sendMessage(EventTypes.AUTH_SUCCESS, { user, isOnline: true });
  config.onEvent?.(EventTypes.AUTH_SUCCESS, null, user);

  return user;
}

async function handleEvent(
  _ws: WebSocket,
  user: User,
  data: { type: string; payload?: unknown },
  config: ChatConfig,
  clients: Map<string, ConnectedClient>,
  sendMessage: (type: string, payload?: unknown) => void,
  _sendError: (code: string, message: string, details?: unknown) => void,
  broadcastTo: (userIds: string[], type: string, payload: unknown) => void,
  isOnline: (userId: string) => boolean
): Promise<void> {
  const { type, payload = {} } = data as { type: string; payload: Record<string, unknown> };
  const p = payload as Record<string, unknown>;

  switch (type) {
    case EventTypes.SEND_MESSAGE: {
      const conversationId = (p.conversationId as string) ?? (p.to as string);
      const message: Message = {
        id: uuidv4(),
        senderId: user.id,
        content: (p.content as string) || '',
        to: (p.to as string) || conversationId,
        conversationId,
        type: (p.type as Message['type']) || 'text',
        replyTo: p.replyTo as string,
        forwardedFrom: p.forwardedFrom as string,
        metadata: p.metadata as Record<string, unknown>,
        createdAt: Date.now(),
      };

      const savedMessage = await config.saveMessage(message);
      config.onEvent?.(EventTypes.SEND_MESSAGE, savedMessage, user);

      const recipientIds = conversationId.includes(':') 
        ? conversationId.split(':') 
        : [message.to];

      for (const recipientId of recipientIds) {
        if (isOnline(recipientId)) {
          const client = clients.get(recipientId);
          client?.ws.send(JSON.stringify({ type: EventTypes.NEW_MESSAGE, payload: savedMessage }));
        }
      }

      sendMessage(EventTypes.MESSAGE_SENT, { id: savedMessage.id, message: savedMessage });
      break;
    }

    case EventTypes.EDIT_MESSAGE: {
      const messageId = p.messageId as string;
      const newContent = p.content as string;
      
      const updatedMessage = await config.saveMessage({
        id: messageId,
        senderId: user.id,
        content: newContent,
        to: p.to as string,
        conversationId: p.conversationId as string,
        type: 'text',
        editedAt: Date.now(),
        createdAt: Date.now(),
      } as Message);

      broadcastTo([p.to as string], EventTypes.MESSAGE_EDITED, { messageId, content: newContent, message: updatedMessage });
      break;
    }

    case EventTypes.DELETE_MESSAGE: {
      const messageId = p.messageId as string;
      
      await config.saveMessage({
        id: messageId,
        senderId: user.id,
        content: '',
        to: p.to as string,
        conversationId: p.conversationId as string,
        type: 'text',
        deletedAt: Date.now(),
        createdAt: Date.now(),
      } as Message);

      broadcastTo([p.to as string], EventTypes.MESSAGE_DELETED, { messageId });
      break;
    }

    case EventTypes.REACTION: {
      const reaction: MessageReaction = {
        messageId: p.messageId as string,
        userId: user.id,
        emoji: p.emoji as string,
        createdAt: Date.now(),
      };

      broadcastTo([p.to as string], EventTypes.MESSAGE_REACTION, reaction);
      break;
    }

    case EventTypes.GET_MESSAGES: {
      const messages = await config.getMessages(p.conversationId as string, user, p.limit as number);
      sendMessage(EventTypes.MESSAGES, { conversationId: p.conversationId, messages });
      break;
    }

    case EventTypes.GET_CONVERSATIONS: {
      const conversations = await config.getConversations(user.id);
      sendMessage(EventTypes.CONVERSATIONS, conversations);
      break;
    }

    case EventTypes.TYPING: {
      const payloadTyped: TypingPayload = { from: user.id, to: p.to as string, conversationId: p.conversationId as string, state: p.state as 'started' | 'stopped' };
      
      if (isOnline(p.to as string)) {
        const target = clients.get(p.to as string);
        target?.ws.send(JSON.stringify({ type: EventTypes.TYPING, payload: payloadTyped }));
      }
      break;
    }

    case EventTypes.READ: {
      const payloadTyped: ReadPayload = { from: user.id, to: p.to as string, conversationId: p.conversationId as string, messageId: p.messageId as string };
      
      if (isOnline(p.to as string)) {
        const target = clients.get(p.to as string);
        target?.ws.send(JSON.stringify({ type: EventTypes.READ_RECEIPT, payload: payloadTyped }));
      }
      break;
    }

    case EventTypes.CREATE_GROUP_CHAT: {
      const groupData: GroupCreatePayload = {
        name: p.name as string,
        avatar: p.avatar as string,
        participants: p.participants as string[],
      };

      const conversationId = `group:${uuidv4()}`;
      const conversation: Conversation = {
        id: conversationId,
        type: 'group',
        name: groupData.name,
        avatar: groupData.avatar,
        participants: [user.id, ...groupData.participants],
        adminIds: [user.id],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      sendMessage(EventTypes.GROUP_CREATED, conversation);
      
      broadcastTo(groupData.participants, EventTypes.GROUP_JOINED, conversation);
      break;
    }

    case EventTypes.JOIN_GROUP: {
      const conversation = await config.getConversations(user.id).then(convs => convs.find(c => c.id === p.groupId));
      if (conversation) {
        conversation.participants.push(user.id);
        sendMessage(EventTypes.GROUP_JOINED, conversation);
        broadcastTo(conversation.participants, EventTypes.GROUP_MEMBER_JOINED, { groupId: p.groupId, userId: user.id });
      }
      break;
    }

    case EventTypes.LEAVE_GROUP: {
      const conversation = await config.getConversations(user.id).then(convs => convs.find(c => c.id === p.groupId));
      if (conversation) {
        conversation.participants = conversation.participants.filter(id => id !== user.id);
        sendMessage(EventTypes.GROUP_LEFT, { groupId: p.groupId });
        broadcastTo(conversation.participants, EventTypes.GROUP_MEMBER_LEFT, { groupId: p.groupId, userId: user.id });
      }
      break;
    }

    case EventTypes.UPDATE_GROUP: {
      const groupUpdate: GroupUpdate = {
        type: p.updateType as GroupUpdate['type'],
        userId: p.userId as string,
        data: p.data as Record<string, unknown>,
      };

      broadcastTo(p.participants as string[], EventTypes.GROUP_UPDATED, { groupId: p.groupId, update: groupUpdate });
      break;
    }

    case EventTypes.PIN_MESSAGE: {
      broadcastTo([p.to as string], EventTypes.MESSAGE_PINNED, { messageId: p.messageId, conversationId: p.conversationId });
      break;
    }

    case EventTypes.UNPIN_MESSAGE: {
      broadcastTo([p.to as string], EventTypes.MESSAGE_UNPINNED, { messageId: p.messageId, conversationId: p.conversationId });
      break;
    }

    case EventTypes.BLOCK_USER: {
      const blockPayload: BlockPayload = { userId: p.userId as string };
      sendMessage(EventTypes.USER_BLOCKED, blockPayload);
      break;
    }

    case EventTypes.UNBLOCK_USER: {
      const unblockPayload: BlockPayload = { userId: p.userId as string };
      sendMessage(EventTypes.USER_UNBLOCKED, unblockPayload);
      break;
    }

    case EventTypes.SEARCH_USERS: {
      const users = await config.searchUsers(p.query as string);
      sendMessage(EventTypes.USER_SEARCH, users);
      break;
    }

    case EventTypes.SEARCH_MESSAGES: {
      const messages = await config.searchMessages(p.query as string, user.id);
      sendMessage(EventTypes.SEARCH_RESULTS, messages);
      break;
    }

    case EventTypes.GET_USER: {
      const profileUser = await config.getUser(p.userId as string, user.id);
      sendMessage(EventTypes.USER_PROFILE, profileUser);
      break;
    }

    case EventTypes.UPDATE_PROFILE: {
      const updates = { ...(user as Record<string, unknown>), ...(p.updates as Record<string, unknown>) };
      sendMessage(EventTypes.PROFILE_UPDATED, updates);
      break;
    }

    case EventTypes.UPDATE_SETTINGS: {
      user.settings = p.settings as User['settings'];
      sendMessage(EventTypes.SETTINGS_UPDATED, user.settings);
      break;
    }

    case EventTypes.PONG: {
      break;
    }

    default: {
      config.onEvent?.(type, payload, user);
      break;
    }
  }
}