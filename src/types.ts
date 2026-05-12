import type { EventType } from "./events.js";

export interface User {
  id: string;
  name?: string;
  avatar?: string;
  bio?: string;
  lastSeen?: number;
  isOnline?: boolean;
  settings?: UserSettings;
  [key: string]: unknown;
}

export interface UserSettings {
  notifications?: boolean;
  readReceipts?: boolean;
  typingIndicator?: boolean;
}

export interface Message {
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

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "link";

export interface MessageReaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface MediaAttachment {
  id: string;
  type: "image" | "video" | "audio" | "file";
  url: string;
  thumbnail?: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;
  avatar?: string;
  participants: string[];
  adminIds?: string[];
  lastMessage?: Message;
  pinnedMessageIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface GroupUpdate {
  type:
    | "name"
    | "avatar"
    | "member_added"
    | "member_left"
    | "member_removed"
    | "admin_added"
    | "admin_removed";
  userId: string;
  data?: Record<string, unknown>;
}

export interface TypingPayload {
  from: string;
  to: string;
  conversationId: string;
  state: "started" | "stopped";
}

export interface ReadPayload {
  from: string;
  to: string;
  conversationId: string;
  messageId: string;
}

export interface ReactionPayload {
  messageId: string;
  emoji: string;
  to: string;
}

export interface GroupCreatePayload {
  name: string;
  avatar?: string;
  participants: string[];
}

export interface GroupUpdatePayload {
  groupId: string;
  update: GroupUpdate;
}

export interface BlockPayload {
  userId: string;
}

export interface SearchPayload {
  query: string;
  conversationId?: string;
  limit?: number;
}

export interface WsMessage<T = unknown> {
  type: EventType;
  payload?: T;
}

export interface ChatConfig {
  authenticate?: (token: string) => Promise<User>;
  saveMessage: (message: Message) => Promise<Message>;
  getMessages: (
    conversationId: string,
    user: User,
    limit?: number,
  ) => Promise<Message[]>;
  getConversations: (userId: string) => Promise<Conversation[]>;
  getUser: (userId: string, requesterId: string) => Promise<User | null>;
  searchUsers: (query: string) => Promise<User[]>;
  searchMessages: (query: string, userId: string) => Promise<Message[]>;
  onEvent?: (type: string, payload: unknown, user: User | null) => void;
  requireAuth?: boolean;
}

export interface ChatServer {
  broadcast: (payload: unknown) => void;
  broadcastTo: (userIds: string[], payload: unknown) => void;
  getActiveUsers: () => string[];
  isUserOnline: (userId: string) => boolean;
}

export interface ChatClient {
  connect: (token: string) => Promise<User>;
  send: (type: string, payload?: unknown) => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
  disconnect: () => void;
}

