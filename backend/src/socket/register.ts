import type {
  ClientToServerEvents,
  LocalRoomSession,
  ServerToClientEvents
} from "@dont-trust-that-card/shared";

import type { RoomStore } from "../rooms/store";

type SessionMap = Map<string, LocalRoomSession>;
type TypedSocket = {
  id: string;
  on(event: string, handler: (payload?: unknown) => void): void;
  emit(event: keyof ServerToClientEvents, payload: ServerToClientEvents[keyof ServerToClientEvents]): void;
};
type TypedServer = {
  to(target: string): {
    emit(
      event: keyof ServerToClientEvents,
      payload: ServerToClientEvents[keyof ServerToClientEvents]
    ): void;
  };
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown action error";
}

export function broadcastRoomSnapshots(
  io: TypedServer,
  store: RoomStore,
  sessions: SessionMap,
  roomCode: string
) {
  const room = store.getRoom(roomCode);
  if (!room) {
    return;
  }

  for (const [socketId, session] of sessions.entries()) {
    if (session.roomCode !== roomCode) {
      continue;
    }

    const snapshot = room.getSnapshotForPlayer(session.playerId);
    if ("localHand" in snapshot) {
      io.to(socketId).emit("game:snapshot", snapshot);
    } else {
      io.to(socketId).emit("room:snapshot", snapshot);
    }
  }
}

export function registerSocketHandlers(
  io: TypedServer,
  socket: TypedSocket,
  store: RoomStore,
  sessions: SessionMap
) {
  const sendError = (error: unknown) => {
    socket.emit("action:error", { message: getErrorMessage(error) });
  };

  const getSession = () => {
    const session = sessions.get(socket.id);
    if (!session) {
      throw new Error("socket is not in a room");
    }
    return session;
  };

  socket.on("room:create", (payload) => {
    try {
      const data = payload as ClientToServerEvents["room:create"];
      const room = store.createRoom({
        hostName: data.playerName,
        requestedCode: data.requestedCode
      });
      sessions.set(socket.id, {
        playerId: room.hostPlayerId,
        roomCode: room.code
      });
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("room:join", (payload) => {
    try {
      const data = payload as ClientToServerEvents["room:join"];
      const room = store.getRoom(data.roomCode);
      if (!room) {
        throw new Error("room not found");
      }

      const joined = room.join({ playerName: data.playerName });
      sessions.set(socket.id, {
        playerId: joined.playerId,
        roomCode: room.code
      });
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("room:leave", () => {
    try {
      const session = getSession();
      sessions.delete(socket.id);
      store.removePlayer(session.roomCode, session.playerId);
      broadcastRoomSnapshots(io, store, sessions, session.roomCode);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("room:setCode", (payload) => {
    try {
      const session = getSession();
      const data = payload as ClientToServerEvents["room:setCode"];
      const room = store.setRoomCode(session.roomCode, session.playerId, data.roomCode);
      for (const activeSession of sessions.values()) {
        if (activeSession.roomCode === session.roomCode) {
          activeSession.roomCode = room.code;
        }
      }
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("room:setTimer", (payload) => {
    try {
      const session = getSession();
      const data = payload as ClientToServerEvents["room:setTimer"];
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.setTimer(session.playerId, data.seconds);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("room:setReady", (payload) => {
    try {
      const session = getSession();
      const data = payload as ClientToServerEvents["room:setReady"];
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.setReady(session.playerId, data.ready);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("room:start", () => {
    try {
      const session = getSession();
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.startGame(session.playerId);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("game:play", (payload) => {
    try {
      const session = getSession();
      const data = payload as ClientToServerEvents["game:play"];
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.playCards(session.playerId, data.cardIds, data.declaredRank);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("game:skip", () => {
    try {
      const session = getSession();
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.skip(session.playerId);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("game:challenge", () => {
    try {
      const session = getSession();
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.challenge(session.playerId);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("chat:send", (payload) => {
    try {
      const session = getSession();
      const data = payload as ClientToServerEvents["chat:send"];
      const room = store.getRoom(session.roomCode);
      if (!room) {
        throw new Error("room not found");
      }
      room.sendChat(session.playerId, data.text);
      broadcastRoomSnapshots(io, store, sessions, room.code);
    } catch (error) {
      sendError(error);
    }
  });

  socket.on("disconnect", () => {
    const session = sessions.get(socket.id);
    if (!session) {
      return;
    }

    sessions.delete(socket.id);
    store.removePlayer(session.roomCode, session.playerId);
    broadcastRoomSnapshots(io, store, sessions, session.roomCode);
  });
}
