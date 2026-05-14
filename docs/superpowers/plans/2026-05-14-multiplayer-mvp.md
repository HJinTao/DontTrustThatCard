# Multiplayer Bluff Game MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable online multiplayer MVP for the approved bluff card rules on top of the initialized repository.

**Architecture:** Use a server-authoritative reducer for all game transitions, a WebSocket room server for realtime sync, and a thin frontend client that renders public state plus the local hand. Keep the canonical rule logic in `shared/` so backend tests and frontend types stay aligned.

**Tech Stack:** TypeScript, React, Vite, Node.js, Fastify, Socket.IO, Vitest

---

### Task 1: Bootstrap Shared Rule Package

**Files:**
- Create: `shared/tsconfig.json`
- Create: `shared/src/cards.ts`
- Create: `shared/src/state.ts`
- Create: `shared/src/reducer.ts`
- Create: `shared/src/index.ts`
- Create: `shared/test/reducer.test.ts`
- Modify: `shared/package.json`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createGameState, playCards } from "../src";

describe("playCards", () => {
  it("locks the round rank and makes the player the current shangjia", () => {
    const state = createGameState({
      playerIds: ["A", "B", "C"],
      starterPlayerId: "A"
    });

    const next = playCards(state, {
      playerId: "A",
      declaredRank: "4",
      cardIds: ["c1", "c2", "c3"]
    });

    expect(next.round.declaredRank).toBe("4");
    expect(next.round.shangjiaPlayerId).toBe("A");
    expect(next.round.currentActorPlayerId).toBe("B");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace shared -- reducer.test.ts`
Expected: FAIL because `src/index.ts` and the reducer functions do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type GameState = {
  players: string[];
  round: {
    starterPlayerId: string;
    declaredRank: Rank | null;
    shangjiaPlayerId: string | null;
    currentActorPlayerId: string;
  };
};

export function createGameState(input: {
  playerIds: string[];
  starterPlayerId: string;
}): GameState {
  return {
    players: input.playerIds,
    round: {
      starterPlayerId: input.starterPlayerId,
      declaredRank: null,
      shangjiaPlayerId: null,
      currentActorPlayerId: input.starterPlayerId
    }
  };
}

export function playCards(
  state: GameState,
  input: { playerId: string; declaredRank: Rank; cardIds: string[] }
): GameState {
  const currentIndex = state.players.indexOf(input.playerId);
  const nextIndex = (currentIndex + 1) % state.players.length;

  return {
    ...state,
    round: {
      ...state.round,
      declaredRank: state.round.declaredRank ?? input.declaredRank,
      shangjiaPlayerId: input.playerId,
      currentActorPlayerId: state.players[nextIndex]
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace shared -- reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/package.json shared/tsconfig.json shared/src shared/test
git commit -m "feat: bootstrap shared rule package"
```

### Task 2: Build and Test the Backend Game Reducer

**Files:**
- Create: `backend/tsconfig.json`
- Create: `backend/src/game/engine.ts`
- Create: `backend/src/game/turns.ts`
- Create: `backend/src/game/challenge.ts`
- Create: `backend/test/game-engine.test.ts`
- Modify: `backend/package.json`
- Modify: `shared/src/state.ts`
- Modify: `shared/src/reducer.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createSeededGame, skipTurn, playCards, resolveUncontestedPass } from "../src/game/engine";

describe("uncontested pass", () => {
  it("ends the round when the latest played hand survives a full orbit of skips", () => {
    let state = createSeededGame(["A", "B", "C"]);
    state = playCards(state, { playerId: "A", declaredRank: "7", cardIds: ["a1"] });
    state = skipTurn(state, { playerId: "B" });
    state = skipTurn(state, { playerId: "C" });
    state = resolveUncontestedPass(state);

    expect(state.round).toBeNull();
    expect(state.nextStarterPlayerId).toBe("A");
    expect(state.tablePile.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- game-engine.test.ts`
Expected: FAIL because the backend reducer and round-ending logic do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function skipTurn(state: EngineState, input: { playerId: string }): EngineState {
  return {
    ...state,
    skippedPlayerIdsSinceLastPlay: [...state.skippedPlayerIdsSinceLastPlay, input.playerId],
    currentActorPlayerId: nextActivePlayerId(state, input.playerId)
  };
}

export function resolveUncontestedPass(state: EngineState): EngineState {
  const shangjiaPlayerId = state.round.shangjiaPlayerId;

  return {
    ...state,
    round: null,
    nextStarterPlayerId: shangjiaPlayerId,
    tablePile: []
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- game-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/src backend/test shared/src
git commit -m "feat: implement backend game reducer"
```

### Task 3: Add Realtime Room Server

**Files:**
- Create: `backend/src/server.ts`
- Create: `backend/src/rooms/store.ts`
- Create: `backend/src/socket/events.ts`
- Create: `backend/test/socket-room.test.ts`
- Modify: `backend/package.json`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createRoomStore } from "../src/rooms/store";

describe("room store", () => {
  it("broadcasts the next public game state after a valid play", () => {
    const store = createRoomStore();
    const room = store.createRoom({ roomId: "R1", hostId: "A" });

    room.join({ playerId: "B", displayName: "B" });
    room.join({ playerId: "C", displayName: "C" });

    const snapshot = room.startGame();

    expect(snapshot.phase).toBe("in_round");
    expect(snapshot.currentActorPlayerId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace backend -- socket-room.test.ts`
Expected: FAIL because the room orchestration layer does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function createRoomStore() {
  const rooms = new Map<string, Room>();

  return {
    createRoom(input: { roomId: string; hostId: string }) {
      const room = createRoom(input);
      rooms.set(input.roomId, room);
      return room;
    },
    getRoom(roomId: string) {
      return rooms.get(roomId) ?? null;
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace backend -- socket-room.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/server.ts backend/src/rooms backend/src/socket backend/test backend/package.json shared/src/index.ts
git commit -m "feat: add realtime room server"
```

### Task 4: Build the First Playable Frontend

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/game/GameTable.tsx`
- Create: `frontend/src/game/HandPanel.tsx`
- Create: `frontend/src/game/ActionPanel.tsx`
- Create: `frontend/src/game/useRoomSocket.ts`
- Create: `frontend/src/styles.css`
- Create: `frontend/test/game-table.test.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { GameTable } from "../src/game/GameTable";

it("shows the three legal turn actions", () => {
  render(
    <GameTable
      state={{
        currentActorPlayerId: "A",
        localPlayerId: "A",
        declaredRank: "9",
        shangjiaPlayerId: "C",
        pileCount: 6
      }}
    />
  );

  expect(screen.getByRole("button", { name: "质疑上家" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "出牌" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "跳过" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace frontend -- game-table.test.tsx`
Expected: FAIL because the frontend game table has not been created yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function GameTable({ state }: { state: GameTableState }) {
  const isMyTurn = state.currentActorPlayerId === state.localPlayerId;

  return (
    <main>
      <h1>Dont Trust That Card</h1>
      <p>本回合点数：{state.declaredRank ?? "-"}</p>
      <p>当前上家：{state.shangjiaPlayerId ?? "-"}</p>
      <p>桌面牌数：{state.pileCount}</p>
      {isMyTurn ? (
        <section>
          <button type="button">质疑上家</button>
          <button type="button">出牌</button>
          <button type="button">跳过</button>
        </section>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace frontend -- game-table.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/src frontend/test
git commit -m "feat: add playable frontend shell"
```

### Task 5: Add Deployment Baseline and Smoke Checks

**Files:**
- Create: `backend/.env.example`
- Create: `docs/deployment/local-server.md`
- Create: `docs/deployment/production-checklist.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing smoke checklist**

```md
1. Start backend server
2. Start frontend dev server
3. Open two browser sessions
4. Join the same room
5. Play one full uncontested round
6. Play one successful challenge
7. Verify pending-win and winner-leaves behavior
```

- [ ] **Step 2: Run the documented smoke flow**

Run: `npm run dev --workspace backend` and `npm run dev --workspace frontend`
Expected: the commands should boot both services without runtime errors.

- [ ] **Step 3: Write minimal deployment docs**

```md
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 4: Re-run the smoke flow**

Run: `npm run dev --workspace backend` and `npm run dev --workspace frontend`
Expected: both services boot, and the checklist can be completed manually.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example docs/deployment README.md
git commit -m "docs: add deployment baseline"
```

