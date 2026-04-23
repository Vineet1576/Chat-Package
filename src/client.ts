import { EventTypes } from "./events.js";
import type { User, ChatClient } from "./types.js";

type EventHandler = (payload: unknown) => void;

export function createChatClient(url: string): ChatClient {
  let ws: WebSocket | null = null;
  let user: User | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  const handlers = new Map<string, Set<EventHandler>>();

  let isConnecting = false;
  let isDisconnecting = false;

  function connect(token: string): Promise<User> {
    return new Promise((resolve, reject) => {
      if (ws?.readyState === WebSocket.OPEN && user) {
        resolve(user);
        return;
      }

      if (isConnecting) {
        reject(new Error("Connection already in progress"));
        return;
      }

      isConnecting = true;
      isDisconnecting = false;

      ws = new WebSocket(url);

      ws.onopen = (): void => {
        isConnecting = false;
        startHeartbeat();
        ws?.send(JSON.stringify({ type: EventTypes.AUTH, token }));
      };

      ws.onmessage = (event: MessageEvent): void => {
        try {
          const data = JSON.parse(event.data);
          const { type, payload } = data;

          if (type === EventTypes.AUTH_SUCCESS) {
            user = (payload as { user: User }).user;
            resolve(user!);
          } else if (type === EventTypes.AUTH_ERROR) {
            isConnecting = false;
            reject(new Error((payload as { message: string }).message));
            ws?.close();
          } else {
            const eventHandlers = handlers.get(type);
            if (eventHandlers) {
              eventHandlers.forEach((handler) => handler(payload));
            }
          }
        } catch {
          console.error("Failed to parse message:", event.data);
        }
      };

      ws.onclose = (): void => {
        isConnecting = false;
        stopHeartbeat();

        if (!isDisconnecting) {
          scheduleReconnect(token);
        }

        const eventHandlers = handlers.get(EventTypes.DISCONNECT);
        if (eventHandlers) {
          eventHandlers.forEach((handler) => handler(null));
        }
      };

      ws.onerror = (error): void => {
        isConnecting = false;
        reject(error);
      };
    });
  }

  function send(type: string, payload?: unknown): void {
    if (ws?.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    ws.send(JSON.stringify({ type, payload }));
  }

  function on(event: string, handler: EventHandler): void {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)!.add(handler);
  }

  function off(event: string, handler: EventHandler): void {
    handlers.get(event)?.delete(handler);
  }

  function disconnect(): void {
    isDisconnecting = true;
    stopHeartbeat();
    clearReconnectTimeout();

    if (ws) {
      ws.close();
      ws = null;
    }
    user = null;
  }

  function startHeartbeat(): void {
    stopHeartbeat();
    pingInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: EventTypes.PING }));
      }
    }, 30000);
  }

  function stopHeartbeat(): void {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function scheduleReconnect(token: string): void {
    clearReconnectTimeout();
    reconnectTimeout = setTimeout(() => {
      connect(token).catch(() => {});
    }, 3000);
  }

  function clearReconnectTimeout(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  return {
    connect,
    send,
    on,
    off,
    disconnect,
  };
}
