import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

export function createChatServer(server, config) {
  const wss = new WebSocketServer({ server });
  const clients = new Map();

  wss.on("connection", (ws) => {
    let user = null;

    ws.on("message", async (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return sendError(ws, "INVALID_PAYLOAD", "Unable to parse JSON");
      }

      if (!user) {
        if (data.type === "AUTH") {
          await handleAuth(ws, data, config, clients)
            .then((authUser) => {
              user = authUser;
            })
            .catch(() => {
              ws.close();
            });
        } else {
          sendError(ws, "UNAUTHENTICATED", "Please authenticate before sending events.");
        }
        return;
      }

      await handleEvent(ws, user, data, config, clients);
    });

    ws.on("close", () => {
      if (user) {
        clients.delete(user.id);
        config.onEvent?.("DISCONNECT", null, user);
      }
    });

    ws.on("error", (err) => {
      config.onEvent?.("WS_ERROR", { error: err.message }, user);
    });
  });

  return {
    broadcast(payload) {
      const message = JSON.stringify(payload);
      for (const client of clients.values()) {
        if (client.readyState === client.OPEN) {
          client.send(message);
        }
      }
    },
    getActiveUsers() {
      return Array.from(clients.keys());
    }
  };
}

async function handleAuth(ws, data, config, clients) {
  if (!config.authenticate) {
    sendError(ws, "AUTH_NOT_CONFIGURED", "No authenticate handler was provided.");
    throw new Error("Auth disabled");
  }

  if (!data.token) {
    sendError(ws, "AUTH_ERROR", "Missing authentication token.");
    throw new Error("Missing token");
  }

  try {
    const user = await config.authenticate(data.token);
    if (!user || !user.id) {
      sendError(ws, "AUTH_ERROR", "Invalid user object returned by authenticate.");
      throw new Error("Invalid user");
    }

    clients.set(user.id, ws);
    ws.send(JSON.stringify({ type: "AUTH_SUCCESS", payload: { user } }));
    config.onEvent?.("AUTH_SUCCESS", null, user);
    return user;
  } catch (err) {
    sendError(ws, "AUTH_ERROR", err?.message ?? "Invalid Token");
    config.onEvent?.("AUTH_ERROR", { error: err?.message }, null);
    throw err;
  }
}

async function handleEvent(ws, user, data, config, clients) {
  const { type, payload = {} } = data;

  switch (type) {
    case "SEND_MESSAGE": {
      if (!config.saveMessage) {
        sendError(ws, "NOT_IMPLEMENTED", "saveMessage handler is required.");
        return;
      }

      const message = {
        id: uuidv4(),
        senderId: user.id,
        content: payload.content,
        to: payload.to,
        conversationId: payload.conversationId ?? `${user.id}:${payload.to}`,
        metadata: payload.metadata ?? {},
        createdAt: Date.now()
      };

      await config.saveMessage(message);
      config.onEvent?.("SEND_MESSAGE", message, user);

      const target = clients.get(payload.to);
      if (target && target.readyState === target.OPEN) {
        target.send(JSON.stringify({ type: "NEW_MESSAGE", payload: message }));
      }

      ws.send(JSON.stringify({ type: "MESSAGE_SENT", payload: { id: message.id } }));
      break;
    }

    case "GET_MESSAGES": {
      if (!config.getMessages) {
        sendError(ws, "NOT_IMPLEMENTED", "getMessages handler is required.");
        return;
      }

      const messages = await config.getMessages(payload.conversationId, user);
      ws.send(JSON.stringify({ type: "MESSAGES", payload: messages }));
      config.onEvent?.("GET_MESSAGES", { conversationId: payload.conversationId }, user);
      break;
    }

    case "TYPING": {
      const target = clients.get(payload.to);
      if (target && target.readyState === target.OPEN) {
        target.send(JSON.stringify({ type: "TYPING", payload: { from: user.id, conversationId: payload.conversationId, state: payload.state } }));
      }
      config.onEvent?.("TYPING", { to: payload.to, state: payload.state }, user);
      break;
    }

    case "READ": {
      const target = clients.get(payload.to);
      if (target && target.readyState === target.OPEN) {
        target.send(JSON.stringify({ type: "READ", payload: { from: user.id, conversationId: payload.conversationId, messageId: payload.messageId } }));
      }
      config.onEvent?.("READ", { conversationId: payload.conversationId, messageId: payload.messageId }, user);
      break;
    }

    default: {
      config.onEvent?.(type, payload, user);
      break;
    }
  }
}

function sendError(ws, type, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: "ERROR", payload: { code: type, message } }));
  }
}
