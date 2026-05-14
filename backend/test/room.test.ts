import { describe, expect, it } from "vitest";

import { createRoomStore } from "../src/rooms/store";

describe("room lifecycle", () => {
  it("requires all current players to be ready before the host can start", () => {
    const store = createRoomStore({ rng: () => 0, now: () => 1000 });
    const room = store.createRoom({ hostName: "Host", requestedCode: "ROOM01" });

    const joined = room.join({ playerName: "Player2" });

    expect(() => room.startGame(room.hostPlayerId)).toThrow(/ready/i);

    room.setReady(room.hostPlayerId, true);
    room.setReady(joined.playerId, true);

    const snapshot = room.startGame(room.hostPlayerId);
    expect(snapshot.phase).toBe("in_game");
  });

  it("transfers host to the earliest remaining player when the host leaves", () => {
    const store = createRoomStore({ rng: () => 0, now: () => 1000 });
    const room = store.createRoom({ hostName: "Host", requestedCode: "ROOM01" });
    const joined = room.join({ playerName: "Player2" });

    room.leave(room.hostPlayerId);
    expect(room.hostPlayerId).toBe(joined.playerId);
  });

  it("forfeits the starter when the opening turn times out", () => {
    const store = createRoomStore({ rng: () => 0, now: () => 1000 });
    const room = store.createRoom({ hostName: "Host", requestedCode: "ROOM01" });
    const joined = room.join({ playerName: "Player2" });
    room.setReady(room.hostPlayerId, true);
    room.setReady(joined.playerId, true);
    const snapshot = room.startGame(room.hostPlayerId);
    expect(snapshot.currentActorPlayerId).not.toBeNull();

    room.handleTurnTimeout(snapshot.currentActorPlayerId!);

    expect(room.phase).toBe("game_over");
    expect(room.getRoomSnapshot(joined.playerId).lastGameSummary?.forfeits).toHaveLength(1);
  });

  it("destroys the room when the last player leaves", () => {
    const store = createRoomStore({ rng: () => 0, now: () => 1000 });
    const room = store.createRoom({ hostName: "Host", requestedCode: "ROOM01" });

    store.removePlayer(room.code, room.hostPlayerId);

    expect(store.getRoom(room.code)).toBeNull();
  });
});
