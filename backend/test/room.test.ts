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

describe("room timeout sweep", () => {
  it("forfeits an overdue opening actor exactly once", () => {
    let nowMs = 1000;
    const store = createRoomStore({ rng: () => 0, now: () => nowMs });
    const room = store.createRoom({ hostName: "房主01", requestedCode: "ROOM01" });
    const joined = room.join({ playerName: "玩家02" });

    room.setReady(room.hostPlayerId, true);
    room.setReady(joined.playerId, true);
    const snapshot = room.startGame(room.hostPlayerId);

    nowMs += room.timerSeconds * 1000 + 1;

    const swept: string[] = [];
    store.sweepExpiredTurns((sweptRoom) => swept.push(sweptRoom.code));

    expect(swept).toEqual([room.code]);
    expect(room.phase).toBe("game_over");

    store.sweepExpiredTurns((sweptRoom) => swept.push(sweptRoom.code));
    expect(swept).toEqual([room.code]);
    expect(room.getRoomSnapshot(joined.playerId).lastGameSummary?.forfeits).toHaveLength(1);
    expect(snapshot.currentActorPlayerId).not.toBeNull();
  });

  it("auto-skips an overdue non-opening actor and advances the turn", () => {
    let nowMs = 1000;
    const store = createRoomStore({ rng: () => 0, now: () => nowMs });
    const room = store.createRoom({ hostName: "房主01", requestedCode: "ROOM01" });
    const joined = room.join({ playerName: "玩家02" });

    room.setReady(room.hostPlayerId, true);
    room.setReady(joined.playerId, true);
    const started = room.startGame(room.hostPlayerId);
    const openerId = started.currentActorPlayerId!;
    const openerCardId = room.gameState!.players[openerId].hand[0];

    room.playCards(openerId, [openerCardId], "A");
    const beforeSweep = room.getGameSnapshot(openerId);
    const timedOutActor = beforeSweep.currentActorPlayerId!;

    nowMs += room.timerSeconds * 1000 + 1;

    store.sweepExpiredTurns(() => undefined);

    const afterSweep = room.getGameSnapshot(openerId);
    expect(afterSweep.currentActorPlayerId).not.toBe(timedOutActor);
    expect(afterSweep.currentActorPlayerId).toBe(openerId);
    expect(afterSweep.shangjiaPlayerId).toBeNull();
    expect(room.phase).toBe("in_game");
  });

  it("ignores rooms that are not overdue", () => {
    let nowMs = 1000;
    const store = createRoomStore({ rng: () => 0, now: () => nowMs });
    const room = store.createRoom({ hostName: "房主01", requestedCode: "ROOM01" });
    const joined = room.join({ playerName: "玩家02" });

    room.setReady(room.hostPlayerId, true);
    room.setReady(joined.playerId, true);
    room.startGame(room.hostPlayerId);

    const swept: string[] = [];
    store.sweepExpiredTurns((sweptRoom) => swept.push(sweptRoom.code));

    expect(swept).toEqual([]);
    expect(room.phase).toBe("in_game");
  });
});
