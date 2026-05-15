import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClientToServerEvents,
  GameSnapshot,
  RoomSnapshot,
  ServerToClientEvents
} from "@dont-trust-that-card/shared";

import { App } from "../src/App";
import { GameTable } from "../src/game/GameTable";
import { HandPanel } from "../src/game/HandPanel";
import { LobbyView } from "../src/game/LobbyView";
import { getCardImageOrFallback } from "../src/lib/cardAssets";

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
    expect(screen.getByText("本轮点数")).toBeInTheDocument();
    expect(screen.getByText("张数")).toBeInTheDocument();
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

describe("card asset presentation", () => {
  it("returns the face asset for a known card", () => {
    const src = getCardImageOrFallback({
      id: "d1-spades-Q-0",
      rank: "Q",
      suit: "spades",
      deckIndex: 1
    });

    expect(src).toMatch(/PNG\/Cards \(medium\)\/card_spades_Q\.png$/);
  });

  it("uses the complete medium asset set for jokers", () => {
    const src = getCardImageOrFallback({
      id: "d1-joker-JOKER-black",
      rank: "JOKER",
      suit: "joker",
      deckIndex: 1,
      jokerColor: "black"
    });

    expect(src).toMatch(/PNG\/Cards \(medium\)\/card_joker_black\.png$/);
  });

  it("falls back to the neutral card asset when the face asset is missing", () => {
    const src = getCardImageOrFallback(
      {
        id: "d1-spades-Q-0",
        rank: "Q",
        suit: "spades",
        deckIndex: 1
      },
      {
        "/virtual/card_empty.png": "/virtual/card_empty.png"
      }
    );

    expect(src).toBe("/virtual/card_empty.png");
  });

  it("renders the hand as images instead of raw suit and rank text", () => {
    render(
      <HandPanel
        cards={[
          {
            id: "d1-spades-Q-0",
            rank: "Q",
            suit: "spades",
            deckIndex: 1
          }
        ]}
        selectedCardIds={[]}
        onToggleCard={() => undefined}
      />
    );

    expect(screen.getByRole("img", { name: "黑桃 Q" })).toBeInTheDocument();
    expect(screen.queryByText("spades Q")).not.toBeInTheDocument();
  });
});

describe("localized game table", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Chinese labels for the main table chrome", () => {
    const snapshot = {
      phase: "in_game",
      roomCode: "ROOM01",
      hostPlayerId: "A",
      timerSeconds: 15,
      chat: [],
      timerEndsAtMs: Date.now() + 15000,
      localPlayerId: "A",
      localHand: [],
      players: [
        { playerId: "A", displayName: "甲", handCount: 3, seatIndex: 0, status: "active" },
        { playerId: "B", displayName: "乙", handCount: 3, seatIndex: 1, status: "pending_win" }
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
      latestResult: {
        type: "challenge",
        challengerPlayerId: "A",
        challengedPlayerId: "B",
        success: true
      }
    } as const satisfies GameSnapshot;

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

    expect(screen.getByText("房间")).toBeInTheDocument();
    expect(screen.getByText("本轮点数")).toBeInTheDocument();
    expect(screen.getByText("当前行动")).toBeInTheDocument();
    expect(screen.getByText("倒计时")).toBeInTheDocument();
    expect(screen.getAllByText("宣称点数")).toHaveLength(2);
    expect(screen.getByText("质疑成功")).toBeInTheDocument();
    expect(screen.getByText("出完待判")).toBeInTheDocument();
  });

  it("updates the countdown locally once per second", () => {
    const snapshot = {
      phase: "in_game",
      roomCode: "ROOM01",
      hostPlayerId: "A",
      timerSeconds: 15,
      chat: [],
      timerEndsAtMs: Date.now() + 3000,
      localPlayerId: "A",
      localHand: [],
      players: [
        { playerId: "A", displayName: "甲", handCount: 3, seatIndex: 0, status: "active" },
        { playerId: "B", displayName: "乙", handCount: 3, seatIndex: 1, status: "active" }
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
    } as const satisfies GameSnapshot;

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

    expect(screen.getByText("3 秒")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("2 秒")).toBeInTheDocument();
  });
});

describe("lobby localization polish", () => {
  it("starts the entry form with a Chinese default nickname", () => {
    render(<App socket={new MockSocket()} />);
    expect(screen.getByDisplayValue("玩家01")).toBeInTheDocument();
  });

  it("shows explicit Chinese text for empty last-game lists", () => {
    render(
      <LobbyView
        snapshot={{
          phase: "game_over",
          roomCode: "ROOM01",
          hostPlayerId: "A",
          localPlayerId: "A",
          timerSeconds: 30,
          chat: [],
          players: [
            {
              playerId: "A",
              displayName: "甲",
              ready: false,
              isHost: true,
              seatIndex: 0
            }
          ],
          lastGameSummary: {
            startedPlayerCount: 2,
            placements: [],
            forfeits: []
          }
        }}
        localPlayerId="A"
        onSetReady={() => undefined}
        onStart={() => undefined}
        onSetTimer={() => undefined}
        onSetRoomCode={() => undefined}
        onLeave={() => undefined}
        onSendChat={() => undefined}
      />
    );

    expect(screen.getByText(/暂无顺位/)).toBeInTheDocument();
    expect(screen.getByText(/判负离场：无/)).toBeInTheDocument();
  });
});
