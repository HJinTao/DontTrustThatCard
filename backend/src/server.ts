import Fastify from "fastify";
import { Server } from "socket.io";

import { createRoomStore } from "./rooms/store";
import { broadcastRoomSnapshots, registerSocketHandlers } from "./socket/register";

export function createApp() {
  const app = Fastify({ logger: false });
  const io = new Server(app.server, {
    cors: {
      origin: "*"
    }
  });
  const store = createRoomStore();
  const sessions = new Map();
  const timeoutSweepId = globalThis.setInterval(() => {
    store.sweepExpiredTurns((room) => {
      broadcastRoomSnapshots(io, store, sessions, room.code);
    });
  }, 250);

  app.addHook("onClose", async () => {
    globalThis.clearInterval(timeoutSweepId);
  });

  app.get("/health", async () => ({ ok: true }));

  io.on("connection", (socket) => {
    registerSocketHandlers(io, socket, store, sessions);
  });

  return { app, io, store, sessions };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { app } = createApp();
  const port = Number(process.env.PORT ?? 3000);

  app.listen({ host: "0.0.0.0", port }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
