import { describe, expect, it } from "vitest";

import type { ClientToServerEvents, ServerToClientEvents } from "@dont-trust-that-card/shared";

import { createRoomStore } from "../src/rooms/store";
import { registerSocketHandlers } from "../src/socket/register";

type Emitted = {
  target: string;
  event: keyof ServerToClientEvents;
  payload: unknown;
};

function createFakeIo(events: Emitted[]) {
  return {
    to(target: string) {
      return {
        emit(event: keyof ServerToClientEvents, payload: unknown) {
          events.push({ target, event, payload });
        }
      };
    }
  };
}

function createFakeSocket(socketId: string) {
  const handlers = new Map<keyof ClientToServerEvents | "disconnect", (payload?: unknown) => void>();
  return {
    id: socketId,
    on(event: keyof ClientToServerEvents | "disconnect", handler: (payload?: unknown) => void) {
      handlers.set(event, handler);
    },
    emit() {
      return undefined;
    },
    trigger(event: keyof ClientToServerEvents | "disconnect", payload?: unknown) {
      const handler = handlers.get(event);
      if (!handler) {
        throw new Error(`missing handler for ${event}`);
      }
      handler(payload);
    }
  };
}

describe("socket room orchestration", () => {
  it("broadcasts room and game snapshots through the registered socket handlers", () => {
    const events: Emitted[] = [];
    const io = createFakeIo(events);
    const store = createRoomStore({ rng: () => 0, now: () => 1000 });
    const sessions = new Map();
    const socketA = createFakeSocket("socket-a");
    const socketB = createFakeSocket("socket-b");

    registerSocketHandlers(io as never, socketA as never, store, sessions);
    registerSocketHandlers(io as never, socketB as never, store, sessions);

    socketA.trigger("room:create", { playerName: "Host", requestedCode: "ROOM01" });
    socketB.trigger("room:join", { playerName: "Beta", roomCode: "ROOM01" });
    socketA.trigger("room:setReady", { ready: true });
    socketB.trigger("room:setReady", { ready: true });
    socketA.trigger("room:start");

    expect(events.some((event) => event.event === "room:snapshot")).toBe(true);
    expect(events.some((event) => event.event === "game:snapshot")).toBe(true);
  });
});
