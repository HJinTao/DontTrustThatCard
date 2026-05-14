# UI And Timer Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace text card faces with asset-backed PNG rendering, finish Chinese localization for player-facing table UI, make the countdown tick locally, and add a server-side timeout sweep so expired turns always progress.

**Architecture:** Keep the backend authoritative for timeout outcomes and room progression. Keep the frontend responsible for display concerns only: asset-backed card rendering, Chinese display mappings, and a local one-second timer refresh derived from `timerEndsAtMs`. Reuse the existing `Room`, `RoomStore`, and React component boundaries instead of introducing a new animation state machine.

**Tech Stack:** TypeScript, React, Vite, Vitest, Testing Library, Fastify, Socket.IO

---

## File Structure

- `frontend/src/lib/cardAssets.ts`: card face lookup, card back lookup, fallback lookup, and Chinese card accessibility labels
- `frontend/src/game/HandPanel.tsx`: local hand rendering that always shows card art or a neutral fallback image
- `frontend/src/game/copy.ts`: Chinese mappings for player status text and challenge result text
- `frontend/src/game/GameTable.tsx`: localized table chrome and client-side ticking countdown
- `frontend/src/game/ActionBar.tsx`: localized declaration and action controls
- `frontend/src/game/PlayerStrip.tsx`: localized player status display
- `frontend/src/game/LobbyView.tsx`: Chinese summary fallbacks for empty results
- `frontend/src/App.tsx`: Chinese default nickname
- `frontend/test/app.test.tsx`: frontend regression tests for asset rendering, Chinese labels, and timer ticking
- `backend/src/rooms/room.ts`: helper to report whether a turn is overdue and who must be timed out
- `backend/src/rooms/store.ts`: timeout sweep across active rooms using the store clock
- `backend/src/server.ts`: periodic timeout sweep interval and shutdown cleanup
- `backend/test/room.test.ts`: backend regression tests for overdue sweep behavior

### Task 1: Render The Local Hand With Asset PNGs

**Files:**
- Modify: `frontend/src/lib/cardAssets.ts`
- Modify: `frontend/src/game/HandPanel.tsx`
- Test: `frontend/test/app.test.tsx`

- [ ] **Step 1: Write the failing frontend tests for card images and fallback selection**

Add these tests to `frontend/test/app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getCardImageOrFallback } from "../src/lib/cardAssets";
import { HandPanel } from "../src/game/HandPanel";

describe("card asset presentation", () => {
  it("returns the face asset for a known card", () => {
    const src = getCardImageOrFallback({
      id: "d1-spades-Q-0",
      rank: "Q",
      suit: "spades",
      deckIndex: 1
    });

    expect(src).toMatch(/card_spades_Q\.png$/);
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
```

- [ ] **Step 2: Run the frontend test file and verify these tests fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: FAIL because `getCardImageOrFallback` does not exist yet and `HandPanel` still renders a text fallback span.

- [ ] **Step 3: Implement face, back, and fallback asset helpers and switch `HandPanel` to image-only rendering**

Update `frontend/src/lib/cardAssets.ts` to this shape:

```ts
import type { Card } from "@dont-trust-that-card/shared";

const cardImages = import.meta.glob("../../../Assets/PNG/Cards (small)/*.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;

const SUIT_LABELS = {
  clubs: "梅花",
  diamonds: "方块",
  hearts: "红桃",
  spades: "黑桃",
  joker: "鬼牌"
} as const;

function findAsset(
  fileName: string,
  images: Record<string, string> = cardImages
): string | null {
  const entry = Object.entries(images).find(([path]) => path.endsWith(`/${fileName}`));
  return entry?.[1] ?? null;
}

function toAssetFileName(card: Card): string {
  if (card.rank === "JOKER") {
    return `card_joker_${card.jokerColor ?? "black"}.png`;
  }

  const rank =
    typeof card.rank === "string" && /^[2-9]$/.test(card.rank) ? `0${card.rank}` : card.rank;

  return `card_${card.suit}_${rank}.png`;
}

export function getCardFaceImage(
  card: Card,
  images: Record<string, string> = cardImages
): string | null {
  return findAsset(toAssetFileName(card), images);
}

export function getCardBackImage(images: Record<string, string> = cardImages): string | null {
  return findAsset("card_back.png", images);
}

export function getCardFallbackImage(
  images: Record<string, string> = cardImages
): string | null {
  return findAsset("card_empty.png", images) ?? getCardBackImage(images);
}

export function getCardImageOrFallback(
  card: Card,
  images: Record<string, string> = cardImages
): string | null {
  return getCardFaceImage(card, images) ?? getCardFallbackImage(images);
}

export function getCardAltText(card: Card): string {
  if (card.rank === "JOKER") {
    return card.jokerColor === "red" ? "红色鬼牌" : "黑色鬼牌";
  }

  return `${SUIT_LABELS[card.suit]} ${card.rank}`;
}
```

Update `frontend/src/game/HandPanel.tsx` to stop rendering text card faces:

```tsx
import type { Card } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";
import { getCardAltText, getCardFallbackImage, getCardImageOrFallback } from "../lib/cardAssets";

type HandPanelProps = {
  cards: Card[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
};

export function HandPanel({
  cards,
  selectedCardIds,
  onToggleCard
}: HandPanelProps) {
  return (
    <section className="hand-panel panel">
      <header className="panel-header">
        <span>你的手牌</span>
      </header>
      <div className="hand-grid">
        {cards.map((card) => {
          const selected = selectedCardIds.includes(card.id);
          const image = getCardImageOrFallback(card) ?? getCardFallbackImage();
          const alt = getCardAltText(card);

          return (
            <button
              key={card.id}
              type="button"
              className={`hand-card ${selected ? "is-selected" : ""}`}
              aria-label={`${alt}${selected ? "，已选中" : ""}`}
              onMouseEnter={() => dispatchAudioEvent("button-hover", { id: card.id })}
              onClick={() => {
                dispatchAudioEvent("card-flip", { cardId: card.id });
                onToggleCard(card.id);
              }}
            >
              {image ? <img src={image} alt={alt} /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the same frontend test file and verify the new tests pass**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: PASS for the new card asset tests and the pre-existing frontend smoke tests.

- [ ] **Step 5: Commit the hand asset work**

Run:

```bash
git add frontend/src/lib/cardAssets.ts frontend/src/game/HandPanel.tsx frontend/test/app.test.tsx
git commit -m "feat: render hand cards with asset fallbacks"
```

### Task 2: Localize The Game Table And Make The Countdown Tick Locally

**Files:**
- Create: `frontend/src/game/copy.ts`
- Modify: `frontend/src/game/GameTable.tsx`
- Modify: `frontend/src/game/ActionBar.tsx`
- Modify: `frontend/src/game/PlayerStrip.tsx`
- Test: `frontend/test/app.test.tsx`

- [ ] **Step 1: Add failing tests for Chinese table copy and a ticking countdown**

Append these tests to `frontend/test/app.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { GameTable } from "../src/game/GameTable";

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
    } as const;

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
    expect(screen.getByText("宣称点数")).toBeInTheDocument();
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
    } as const;

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
```

- [ ] **Step 2: Run the frontend test file and confirm the localization and timer tests fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: FAIL because the table still contains English labels, raw status values, and a non-ticking countdown.

- [ ] **Step 3: Add Chinese mappings and a client-driven timer loop**

Create `frontend/src/game/copy.ts`:

```ts
import type { PlayerStatus } from "@dont-trust-that-card/shared";

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "进行中",
  pending_win: "出完待判",
  won: "已出完",
  left: "已离场"
};

export function getPlayerStatusLabel(status: PlayerStatus): string {
  return PLAYER_STATUS_LABELS[status];
}

export function getChallengeStampText(success: boolean): string {
  return success ? "质疑成功" : "质疑失败";
}
```

Update `frontend/src/game/GameTable.tsx` around the timer and labels:

```tsx
import { useEffect, useState } from "react";

import type { GameSnapshot, Rank } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";
import { getPlayerStatusLabel, getChallengeStampText } from "./copy";
import { ActionBar } from "./ActionBar";
import { ChatPanel } from "./ChatPanel";
import { HandPanel } from "./HandPanel";
import { PlayerStrip } from "./PlayerStrip";

function formatTimer(timerEndsAtMs: number | null, nowMs: number) {
  if (timerEndsAtMs === null) {
    return "无";
  }

  const remaining = Math.max(0, Math.ceil((timerEndsAtMs - nowMs) / 1000));
  return `${remaining} 秒`;
}

export function GameTable({
  snapshot,
  onPlay,
  onSkip,
  onChallenge,
  onLeave,
  onSendChat
}: GameTableProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [declaredRank, setDeclaredRank] = useState<Rank>(snapshot.declaredRank ?? "A");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (snapshot.timerEndsAtMs === null) {
      return;
    }

    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [snapshot.timerEndsAtMs]);

  const localPlayer = snapshot.players.find(
    (player) => player.playerId === snapshot.localPlayerId
  );

  return (
    <div className={`table-shell ${reduceMotion ? "reduce-motion" : ""}`}>
      <div className="rotate-hint">请横屏后继续牌局</div>
      <div className="table-layout">
        <header className="panel top-bar">
          <div>
            <span className="label">房间</span>
            <strong>{snapshot.roomCode}</strong>
          </div>
          <div>
            <span className="label">本轮点数</span>
            <strong>{snapshot.declaredRank ?? "待首发"}</strong>
          </div>
          <div>
            <span className="label">当前行动</span>
            <strong>{snapshot.players.find((player) => player.playerId === snapshot.currentActorPlayerId)?.displayName ?? "无"}</strong>
          </div>
          <div>
            <span className="label">倒计时</span>
            <strong>{formatTimer(snapshot.timerEndsAtMs, nowMs)}</strong>
          </div>
        </header>

        <main className="table-main">
          <section className="table-center">
            <div className="score-panel panel" aria-live="polite">
              <div className="score-block">
                <span>牌堆</span>
                <strong>{snapshot.pileCount.toString().padStart(2, "0")}</strong>
              </div>
              <div className="score-block">
                <span>张数</span>
                <strong>{(snapshot.lastDeclaredCount ?? 0).toString().padStart(2, "0")}</strong>
              </div>
              <div className="round-callout">
                <span className="label">宣称点数</span>
                <strong>{snapshot.declaredRank ? `${snapshot.lastDeclaredCount ?? 0} 张 ${snapshot.declaredRank}` : "等待首发"}</strong>
                {snapshot.latestResult?.type === "challenge" ? (
                  <span className={`bluff-stamp ${snapshot.latestResult.success ? "bluff-fail" : "bluff-pass"}`}>
                    {getChallengeStampText(snapshot.latestResult.success)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="table-cloth panel">
              <div className="cloth-column">
                <span className="label">上家</span>
                <strong>{snapshot.players.find((player) => player.playerId === snapshot.shangjiaPlayerId)?.displayName ?? "无"}</strong>
              </div>
              <div className="cloth-column">
                <span className="label">牌堆</span>
                <strong>{snapshot.pileCount} 张</strong>
              </div>
              <div className="cloth-column">
                <span className="label">你的状态</span>
                <strong>{localPlayer ? getPlayerStatusLabel(localPlayer.status) : "无"}</strong>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
```

Update `frontend/src/game/ActionBar.tsx`:

```tsx
<section className="action-bar panel">
  <div className="declare-panel">
    <span className="label">宣称点数</span>
    <select
      aria-label="宣称点数"
      value={declaredRank}
      onChange={(event) => onDeclaredRankChange(event.target.value as Rank)}
    >
      {RANK_OPTIONS.map((rank) => (
        <option key={rank} value={rank}>
          {rank}
        </option>
      ))}
    </select>
    <span className="selected-count">已选 {selectedCount} 张</span>
  </div>
  <div className="action-buttons">
    <button type="button" className={`pixel-button bluff ${canChallenge ? "is-armed" : ""}`} disabled={!canChallenge} onClick={onChallenge}>
      质疑
    </button>
    <button type="button" className="pixel-button secondary" disabled={!canSkip} onClick={onSkip}>
      跳过
    </button>
    <button type="button" className="pixel-button primary" disabled={!canPlay || selectedCount === 0 || selectedCount > 4} onClick={onPlay}>
      出牌
    </button>
  </div>
</section>
```

Update `frontend/src/game/PlayerStrip.tsx` to map statuses through `getPlayerStatusLabel`:

```tsx
import type { GameSnapshot } from "@dont-trust-that-card/shared";

import { getPlayerStatusLabel } from "./copy";

// inside render
<div className="player-row muted">
  <span>{getPlayerStatusLabel(player.status)}</span>
  {player.playerId === shangjiaPlayerId ? <span>上家</span> : null}
</div>
```

- [ ] **Step 4: Run the frontend tests again and verify the localized table and ticking timer pass**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: PASS for the new Chinese label assertions and the one-second countdown update assertion.

- [ ] **Step 5: Commit the localized table and timer work**

Run:

```bash
git add frontend/src/game/copy.ts frontend/src/game/GameTable.tsx frontend/src/game/ActionBar.tsx frontend/src/game/PlayerStrip.tsx frontend/test/app.test.tsx
git commit -m "feat: localize table UI and tick countdown locally"
```

### Task 3: Sweep Expired Turns On The Server

**Files:**
- Modify: `backend/src/rooms/room.ts`
- Modify: `backend/src/rooms/store.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/test/room.test.ts`

- [ ] **Step 1: Add failing backend tests for overdue-turn sweeping**

Add these tests to `backend/test/room.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createRoomStore } from "../src/rooms/store";

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
    expect(afterSweep.shangjiaPlayerId).toBe(openerId);
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
```

- [ ] **Step 2: Run the backend room tests and verify the new sweep tests fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace backend -- room.test.ts
```

Expected: FAIL because `RoomStore` does not expose `sweepExpiredTurns()` and `Room` does not expose an overdue actor query yet.

- [ ] **Step 3: Implement overdue actor lookup, store sweeping, and the server interval**

Add this method to `backend/src/rooms/room.ts`:

```ts
  getExpiredActorPlayerId(nowMs: number): string | null {
    if (this.phase !== "in_game" || !this.gameState || this.turnEndsAtMs === null) {
      return null;
    }

    if (nowMs < this.turnEndsAtMs) {
      return null;
    }

    return this.gameState.round?.currentActorPlayerId ?? null;
  }
```

Add this method to `backend/src/rooms/store.ts`:

```ts
  function sweepExpiredTurns(onSweep: (room: Room) => void) {
    const currentNow = now();

    for (const room of rooms.values()) {
      const actorId = room.getExpiredActorPlayerId(currentNow);
      if (!actorId) {
        continue;
      }

      room.handleTurnTimeout(actorId);
      onSweep(room);
    }
  }

  return {
    createRoom,
    getRoom,
    setRoomCode,
    removePlayer,
    sweepExpiredTurns
  };
```

Wire the interval in `backend/src/server.ts`:

```ts
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
```

- [ ] **Step 4: Run the backend room tests again and verify timeout sweeping passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace backend -- room.test.ts
```

Expected: PASS for the existing room lifecycle tests and the new timeout sweep tests.

- [ ] **Step 5: Commit the server timeout sweep**

Run:

```bash
git add backend/src/rooms/room.ts backend/src/rooms/store.ts backend/src/server.ts backend/test/room.test.ts
git commit -m "fix: sweep expired turns on the server"
```

### Task 4: Finish Lobby Copy And Run Full Verification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/game/LobbyView.tsx`
- Modify: `frontend/test/app.test.tsx`

- [ ] **Step 1: Add failing tests for Chinese defaults and empty summary fallbacks**

Append these tests to `frontend/test/app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";
import { LobbyView } from "../src/game/LobbyView";

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

    expect(screen.getByText("暂无顺位")).toBeInTheDocument();
    expect(screen.getByText("无")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the frontend tests and confirm the new lobby tests fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: FAIL because the entry form still defaults to `Player01` before Task 2 is applied and `LobbyView` still prints an empty join result for placements.

- [ ] **Step 3: Add the Chinese fallback strings in the lobby summary**

Update the entry default nickname in `frontend/src/App.tsx`:

```tsx
const [playerName, setPlayerName] = useState("玩家01");
```

Update the last-game summary block in `frontend/src/game/LobbyView.tsx`:

```tsx
{snapshot.lastGameSummary ? (
  <section className="last-game panel inset">
    <header className="panel-header">
      <span>上一局结算</span>
    </header>
    <p>开局人数：{snapshot.lastGameSummary.startedPlayerCount}</p>
    <p>
      顺位：
      {snapshot.lastGameSummary.placements.length > 0
        ? snapshot.lastGameSummary.placements.map((entry) => entry.displayName).join(" → ")
        : "暂无顺位"}
    </p>
    <p>
      判负离场：
      {snapshot.lastGameSummary.forfeits.length > 0
        ? snapshot.lastGameSummary.forfeits.map((entry) => entry.displayName).join("、")
        : "无"}
    </p>
  </section>
) : null}
```

- [ ] **Step 4: Run the focused tests, then the full workspace verification suite**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace backend -- room.test.ts
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run build
```

Expected:

- first command: PASS for all frontend regression tests
- second command: PASS for backend room tests
- third command: PASS for the full workspace test suite
- fourth command: PASS for frontend, backend, and shared builds

- [ ] **Step 5: Commit the lobby polish and final verification state**

Run:

```bash
git add frontend/src/App.tsx frontend/src/game/LobbyView.tsx frontend/test/app.test.tsx
git commit -m "fix: polish Chinese lobby fallbacks"
```
