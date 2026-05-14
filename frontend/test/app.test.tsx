import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  ClientToServerEvents,
  GameSnapshot,
  RoomSnapshot,
  ServerToClientEvents
} from "@dont-trust-that-card/shared";

import { App } from "../src/App";
import { GameTable } from "../src/game/GameTable";

class MockSocket {
  handlers = new Map<string, Set<(payload: unknown) => void>>();
  emitted: Array<{ event: string; payload: unknown }> = [];

  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: (payload: ServerToClientEvents[K]) => void
  ) {
    const set = this.handlers.get(event) ?? new Set();
    set.add(listener as (payload: unknown) => void);
    this.handlers.set(event, set);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    listener: (payload: ServerToClientEvents[K]) => void
  ) {
    this.handlers.get(event)?.delete(listener as (payload: unknown) => void);
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    payload: ClientToServerEvents[K]
  ) {
    this.emitted.push({ event, payload });
  }

  serverEmit<K extends keyof ServerToClientEvents>(
    event: K,
    payload: ServerToClientEvents[K]
  ) {
    for (const listener of this.handlers.get(event) ?? []) {
      listener(payload);
    }
  }
}

describe("frontend shell", () => {
  it("shows bluff actions and score chrome", () => {
    const snapshot: GameSnapshot = {
      phase: "in_game",
      roomCode: "ROOM01",
      hostPlayerId: "A",
      timerSeconds: 15,
      chat: [],
      timerEndsAtMs: Date.now() + 15000,
      localPlayerId: "A",
      localHand: [],
      players: [
        {
          playerId: "A",
          displayName: "Alpha",
          handCount: 3,
          seatIndex: 0,
          status: "active"
        },
        {
          playerId: "B",
          displayName: "Beta",
          handCount: 3,
          seatIndex: 1,
          status: "active"
        }
      ],
      currentActorPlayerId: "A",
      shangjiaPlayerId: "B",
      declaredRank: "Q",
      lastDeclaredCount: 2,
      pileCount: 5,
      placements: [],
      forfeitedPlayerIds: [],
      canPlay: true,
      canSkip: true,
      canChallenge: true,
      latestResult: null
    };

    render(
      <GameTable
        snapshot={snapshot}
        onPlay={() => undefined}
        onSkip={() => undefined}
        onChallenge={() => undefined}
        onLeave={() => undefined}
        onSendChat={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /质疑/i })).toBeInTheDocument();
    expect(screen.getByText(/CHIPS/i)).toBeInTheDocument();
    expect(screen.getByText(/MULT/i)).toBeInTheDocument();
  });

  it("disables the start button until all players are ready", async () => {
    const socket = new MockSocket();
    render(<App socket={socket} />);

    const snapshot: RoomSnapshot = {
      phase: "lobby",
      roomCode: "ROOM01",
      hostPlayerId: "A",
      localPlayerId: "A",
      timerSeconds: 30,
      chat: [],
      players: [
        {
          playerId: "A",
          displayName: "Alpha",
          ready: false,
          isHost: true,
          seatIndex: 0
        }
      ],
      lastGameSummary: null
    };

    socket.serverEmit("room:snapshot", snapshot);

    expect(await screen.findByDisplayValue("ROOM01")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /开始对局/i })).toBeDisabled();
  });
});
