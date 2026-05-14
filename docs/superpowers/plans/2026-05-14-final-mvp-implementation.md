# Final Bluff MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the finalized playable web MVP for the approved `2-8` player bluff card rules with realtime rooms, chat, timeout handling, and a tactile game-table UI.

**Architecture:** Keep the rules server-authoritative. Put deterministic card/rule logic in `shared/`, room lifecycle and sockets in `backend/`, and a single-page React client in `frontend/`. Favor one Node server process with in-memory rooms and a thin client that renders authoritative snapshots plus local interaction state.

**Tech Stack:** TypeScript, Vitest, React, Vite, Fastify, Socket.IO, Testing Library

---

## File Structure

- Root
  - `package.json`: workspace scripts
  - `.nvmrc`: runtime version target
  - `tsconfig.base.json`: shared compiler baseline
- `shared/`
  - `src/cards.ts`: deck building, ranks, suits, card ids
  - `src/state.ts`: game and room-facing state types
  - `src/reducer.ts`: pure game transitions
  - `src/view.ts`: public/private snapshot builders
  - `src/events.ts`: socket payload types
  - `src/index.ts`: exports
  - `test/reducer.test.ts`: rule engine tests
- `backend/`
  - `src/game/engine.ts`: authoritative game wrapper around shared reducer
  - `src/rooms/store.ts`: room registry
  - `src/rooms/room.ts`: room state and lifecycle
  - `src/socket/register.ts`: socket event bindings
  - `src/server.ts`: Fastify + Socket.IO bootstrap
  - `test/room.test.ts`: lobby and room tests
  - `test/socket-room.test.ts`: server orchestration tests
- `frontend/`
  - `src/main.tsx`: app bootstrap
  - `src/App.tsx`: top-level state machine
  - `src/styles.css`: bluff-game-ui driven design system and layout
  - `src/lib/audioEvents.ts`: `CustomEvent` dispatch helpers
  - `src/lib/socket.ts`: Socket.IO client wrapper
  - `src/game/`: room/game UI components
  - `test/app.test.tsx`: smoke test

### Task 1: Bootstrap The Workspace And Tooling

**Files:**
- Create: `.nvmrc`
- Create: `tsconfig.base.json`
- Modify: `package.json`
- Modify: `frontend/package.json`
- Modify: `backend/package.json`
- Modify: `shared/package.json`

- [ ] **Step 1: Write the failing workspace test command**

Run:

```bash
npm run test
```

Expected: FAIL because no root scripts or project tests exist yet.

- [ ] **Step 2: Add minimal workspace configuration**

```json
{
  "name": "dont-trust-that-card",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["frontend", "backend", "shared"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  }
}
```

```text
22.22.2
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
cd shared && source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm install --no-audit --ignore-scripts --workspaces=false
cd backend && source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm install --no-audit --ignore-scripts --workspaces=false
cd frontend && source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm install --no-audit --ignore-scripts --workspaces=false
```

Expected: PASS with lockfiles generated and package manifests resolved.

- [ ] **Step 4: Verify the workspace commands now execute**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test
```

Expected: PASS or no-op exit `0`, proving the root workspace wiring is valid.

- [ ] **Step 5: Commit**

```bash
git add .nvmrc tsconfig.base.json package.json frontend/package.json backend/package.json shared/package.json package-lock.json frontend/package-lock.json backend/package-lock.json shared/package-lock.json
git commit -m "chore: bootstrap final MVP workspace"
```

### Task 2: Build The Shared Rule Engine With TDD

**Files:**
- Create: `shared/tsconfig.json`
- Create: `shared/src/cards.ts`
- Create: `shared/src/state.ts`
- Create: `shared/src/reducer.ts`
- Create: `shared/src/view.ts`
- Create: `shared/src/events.ts`
- Create: `shared/src/index.ts`
- Create: `shared/test/reducer.test.ts`
- Modify: `shared/package.json`

- [ ] **Step 1: Write the first failing reducer tests**

```ts
import { describe, expect, it } from "vitest";
import { createGameState, createShuffledDeck, playCards, skipTurn } from "../src";

describe("single and double deck setup", () => {
  it("uses one deck for 2-4 players and two decks for 5-8 players", () => {
    expect(createShuffledDeck(4).length).toBe(54);
    expect(createShuffledDeck(5).length).toBe(108);
  });
});

describe("play flow", () => {
  it("locks declared rank and advances to the next actor", () => {
    const state = createGameState({
      playerIds: ["A", "B", "C"],
      displayNames: { A: "A", B: "B", C: "C" },
      starterPlayerId: "A"
    });

    const hand = state.players.A.hand.slice(0, 2);
    const next = playCards(state, {
      playerId: "A",
      cardIds: hand,
      declaredRank: "7"
    });

    expect(next.round?.declaredRank).toBe("7");
    expect(next.round?.shangjiaPlayerId).toBe("A");
    expect(next.round?.currentActorPlayerId).toBe("B");
  });

  it("does not change shangjia on skip", () => {
    let state = createGameState({
      playerIds: ["A", "B", "C"],
      displayNames: { A: "A", B: "B", C: "C" },
      starterPlayerId: "A"
    });
    state = playCards(state, {
      playerId: "A",
      cardIds: state.players.A.hand.slice(0, 1),
      declaredRank: "4"
    });

    const next = skipTurn(state, { playerId: "B" });
    expect(next.round?.shangjiaPlayerId).toBe("A");
    expect(next.round?.currentActorPlayerId).toBe("C");
  });
});
```

- [ ] **Step 2: Run the shared tests and confirm they fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace shared -- reducer.test.ts
```

Expected: FAIL because `shared/src` and exported helpers do not exist yet.

- [ ] **Step 3: Implement the minimal shared engine**

Key implementation shape:

```ts
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type Card = {
  id: string;
  rank: Rank | "JOKER";
  suit: "clubs" | "diamonds" | "hearts" | "spades" | "joker";
  jokerColor?: "black" | "red";
  deckIndex: 1 | 2;
};

export function createShuffledDeck(playerCount: number): Card[] {
  return buildDeck(playerCount <= 4 ? 1 : 2);
}

export function playCards(state: GameState, input: PlayCardsInput): GameState {
  // validate turn ownership, count, declared rank lock, hand ownership
  // move cards from player hand to pile
  // update round currentActor/shangjia/lastPlayedHand
}
```

- [ ] **Step 4: Add the next failing tests for challenge and pending-win**

```ts
it("gives the full pile to the challenged player on a successful challenge", () => {
  let state = createGameState({
    playerIds: ["A", "B"],
    displayNames: { A: "A", B: "B" },
    starterPlayerId: "A"
  });

  state = seedHands(state, {
    A: ["d1-hearts-2-0"],
    B: ["d1-clubs-9-0"]
  });
  state = playCards(state, { playerId: "A", cardIds: ["d1-hearts-2-0"], declaredRank: "K" });

  const next = challengeLastPlay(state, { playerId: "B" });
  expect(next.players.A.hand).toHaveLength(1);
  expect(next.tablePile).toHaveLength(0);
});
```

- [ ] **Step 5: Run tests, implement, rerun green**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace shared -- reducer.test.ts
```

Expected: first FAIL, then PASS after minimal implementation.

- [ ] **Step 6: Commit**

```bash
git add shared/package.json shared/tsconfig.json shared/src shared/test
git commit -m "feat: implement shared bluff rule engine"
```

### Task 3: Build Room Lifecycle And Backend Realtime Server

**Files:**
- Create: `backend/tsconfig.json`
- Create: `backend/src/game/engine.ts`
- Create: `backend/src/rooms/room.ts`
- Create: `backend/src/rooms/store.ts`
- Create: `backend/src/socket/register.ts`
- Create: `backend/src/server.ts`
- Create: `backend/test/room.test.ts`
- Create: `backend/test/socket-room.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Write failing room lifecycle tests**

```ts
import { describe, expect, it } from "vitest";
import { createRoomStore } from "../src/rooms/store";

describe("room lifecycle", () => {
  it("requires all current players to be ready before the host can start", () => {
    const store = createRoomStore();
    const room = store.createRoom({ hostName: "Host", requestedCode: "ROOM01" });

    room.join({ playerName: "B" });
    expect(() => room.startGame(room.hostPlayerId)).toThrow(/ready/i);

    room.setReady(room.hostPlayerId, true);
    room.setReady(room.players[1].playerId, true);

    const snapshot = room.startGame(room.hostPlayerId);
    expect(snapshot.phase).toBe("in_game");
  });

  it("transfers host to the earliest remaining player when the host leaves", () => {
    const store = createRoomStore();
    const room = store.createRoom({ hostName: "Host", requestedCode: "ROOM01" });
    const joined = room.join({ playerName: "B" });

    room.leave(room.hostPlayerId);
    expect(room.hostPlayerId).toBe(joined.playerId);
  });
});
```

- [ ] **Step 2: Run backend tests and confirm failure**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace backend -- room.test.ts
```

Expected: FAIL because room/store/server modules do not exist yet.

- [ ] **Step 3: Implement minimal room/store behavior**

Key backend responsibilities:

```ts
export type RoomPhase = "lobby" | "in_game" | "game_over";

export function createRoomStore() {
  const rooms = new Map<string, Room>();
  return {
    createRoom(input: CreateRoomInput) { /* ... */ },
    getRoom(code: string) { /* ... */ },
    removeRoom(code: string) { /* ... */ }
  };
}

class Room {
  setReady(playerId: string, ready: boolean) { /* ... */ }
  setTimer(playerId: string, seconds: TurnTimerSeconds) { /* ... */ }
  startGame(playerId: string) { /* ... */ }
  leave(playerId: string) { /* ... */ }
}
```

- [ ] **Step 4: Add failing tests for timeout and in-game leave**

```ts
it("forfeits the starter when the opening turn times out", () => {
  const room = createStartedRoom(["A", "B"]);
  const before = room.getGameSnapshot();

  room.handleTurnTimeout(before.currentActorPlayerId);

  expect(room.getGameSnapshot().forfeitedPlayerIds).toContain(before.currentActorPlayerId);
});

it("destroys the room when the last player leaves", () => {
  const store = createRoomStore();
  const room = store.createRoom({ hostName: "Host" });
  store.removePlayer(room.code, room.hostPlayerId);
  expect(store.getRoom(room.code)).toBeNull();
});
```

- [ ] **Step 5: Implement Socket.IO bindings and rerun backend tests**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace backend
```

Expected: first FAIL, then PASS with room lifecycle, timeout, and socket snapshot orchestration covered.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/src backend/test
git commit -m "feat: implement realtime room backend"
```

### Task 4: Build The Playable Frontend Shell And Game Table UI

**Files:**
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/lib/audioEvents.ts`
- Create: `frontend/src/lib/socket.ts`
- Create: `frontend/src/game/types.ts`
- Create: `frontend/src/game/LobbyView.tsx`
- Create: `frontend/src/game/GameTable.tsx`
- Create: `frontend/src/game/HandPanel.tsx`
- Create: `frontend/src/game/PlayerStrip.tsx`
- Create: `frontend/src/game/ActionBar.tsx`
- Create: `frontend/src/game/ChatPanel.tsx`
- Create: `frontend/test/app.test.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write the failing frontend smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { GameTable } from "../src/game/GameTable";

it("shows bluff actions and score chrome", () => {
  render(
    <GameTable
      state={{
        declaredRank: "Q",
        lastDeclaredCount: 2,
        currentActorPlayerId: "A",
        shangjiaPlayerId: "B",
        pileCount: 5,
        players: [],
        localPlayerId: "A",
        canChallenge: true,
        canSkip: true,
        canPlay: true,
        timerRemainingMs: 15000
      }}
      onPlay={() => {}}
      onSkip={() => {}}
      onChallenge={() => {}}
    />
  );

  expect(screen.getByRole("button", { name: /质疑/i })).toBeInTheDocument();
  expect(screen.getByText(/chips/i)).toBeInTheDocument();
  expect(screen.getByText(/mult/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the frontend test and confirm failure**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: FAIL because Vite, React, and the UI components do not exist yet.

- [ ] **Step 3: Implement the bluff-game-ui design system**

Required implementation points:

```css
:root {
  --bg-primary: #1a1a1a;
  --ui-panel: #3a3226;
  --ui-border: #5a5240;
  --highlight: #ffc830;
  --bluff-accent: #9b59b6;
  --ease-elastic: cubic-bezier(0.34, 1.56, 0.64, 1);
  --card-w: 100px;
  --card-h: 140px;
}

.bluff-stamp {
  animation: elastic-pop 0.5s var(--ease-elastic) both;
}
```

```ts
export function dispatchAudioEvent(name: AudioEventName, detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
```

UI requirements:

- tactile pixel-table layout
- top round bar, center play surface, right-side player/suspicion area, bottom action bar
- landscape-mobile friendly layout
- `aria-live` score region
- `CustomEvent` hooks for `card-flip`, `score-tick`, `bluff-called`, `mult-fire`, `button-hover`

- [ ] **Step 4: Add failing test for lobby flow**

```tsx
it("disables the start button until all players are ready", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /开始对局/i })).toBeDisabled();
});
```

- [ ] **Step 5: Implement app state and rerun frontend tests**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend
```

Expected: first FAIL, then PASS with bluff controls, lobby state, and chat shell rendered.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/src frontend/test
git commit -m "feat: implement bluff game frontend shell"
```

### Task 5: Wire The Frontend To The Backend And Verify End-To-End

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/socket.ts`
- Modify: `frontend/src/game/*.tsx`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/socket/register.ts`
- Modify: `shared/src/events.ts`

- [ ] **Step 1: Write a failing integration-style frontend test**

```tsx
it("shows the lobby after a room snapshot arrives", async () => {
  const socket = createMockSocket();
  render(<App socket={socket} />);

  socket.emit("room:snapshot", {
    phase: "lobby",
    roomCode: "ROOM01",
    players: [{ playerId: "A", displayName: "A", ready: false, isHost: true }]
  });

  expect(await screen.findByText(/ROOM01/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test --workspace frontend -- app.test.tsx
```

Expected: FAIL because socket-driven state hydration is not implemented yet.

- [ ] **Step 3: Implement socket snapshot hydration and action dispatch**

Client events to support:

```ts
"room:create"
"room:join"
"room:leave"
"room:setCode"
"room:setTimer"
"room:setReady"
"room:start"
"game:play"
"game:skip"
"game:challenge"
"chat:send"
```

- [ ] **Step 4: Run full verification**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run build
source ~/.nvm/nvm.sh && nvm use 22.22.2 >/dev/null && npm run test
```

Expected: PASS for all workspace builds and tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src backend/src shared/src
git commit -m "feat: wire bluff frontend to realtime backend"
```
