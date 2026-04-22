import http from "http";
import { createChatServer } from "./index.js";

const server = http.createServer();

createChatServer(server, {
  authenticate: async (token) => {
    // Replace this with your own auth system.
    if (token === "secret-token") {
      return { id: "user_01", name: "Alex" };
    }
    throw new Error("Invalid token");
  },

  saveMessage: async (message) => {
    console.log("Saving message:", message);
    return message;
  },

  getMessages: async (conversationId) => {
    console.log("Fetching messages for:", conversationId);
    return [];
  },

  onEvent: (type, payload, user) => {
    console.log(`Event: ${type}`, { payload, user: user?.id });
  }
});

server.listen(3000, () => {
  console.log("Chat server running on port 3000");
});
