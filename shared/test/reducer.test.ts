import { describe, expect, it } from "vitest";

import {
  challengeLastPlay,
  createGameState,
  createGameView,
  createShuffledDeck,
  forfeitPlayer,
  playCards,
  seedHands,
  skipTurn
} from "../src";

describe("single and double deck setup", () => {
  it("uses one deck for 2-4 players and two decks for 5-8 players", () => {
    expect(createShuffledDeck(4, () => 0).length).toBe(54);
    expect(createShuffledDeck(5, () => 0).length).toBe(108);
  });
});

describe("play flow", () => {
  it("locks declared rank and advances to the next actor", () => {
    const state = createGameState({
      playerIds: ["A", "B", "C"],
      displayNames: { A: "A", B: "B", C: "C" },
      starterPlayerId: "A",
      rng: () => 0
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
      starterPlayerId: "A",
      rng: () => 0
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

  it("gives the full pile to the challenged player on a successful challenge", () => {
    let state = createGameState({
      playerIds: ["A", "B"],
      displayNames: { A: "A", B: "B" },
      starterPlayerId: "A",
      rng: () => 0
    });

    state = seedHands(state, {
      A: ["d1-hearts-2-0"],
      B: ["d1-clubs-9-0"]
    });

    state = playCards(state, {
      playerId: "A",
      cardIds: ["d1-hearts-2-0"],
      declaredRank: "K"
    });

    const next = challengeLastPlay(state, { playerId: "B" });
    expect(next.players.A.hand).toHaveLength(1);
    expect(next.tablePile).toHaveLength(0);
    expect(next.round?.starterPlayerId).toBe("B");
  });

  it("marks a pending winner as won when another player replaces the shangjia", () => {
    let state = createGameState({
      playerIds: ["A", "B", "C"],
      displayNames: { A: "A", B: "B", C: "C" },
      starterPlayerId: "A",
      rng: () => 0
    });

    state = seedHands(state, {
      A: ["d1-hearts-2-0"],
      B: ["d1-clubs-4-0"],
      C: ["d1-spades-6-0"]
    });

    state = playCards(state, {
      playerId: "A",
      cardIds: ["d1-hearts-2-0"],
      declaredRank: "2"
    });

    const next = playCards(state, {
      playerId: "B",
      cardIds: ["d1-clubs-4-0"],
      declaredRank: "2"
    });

    expect(next.players.A.status).toBe("won");
    expect(next.placements).toContain("A");
  });

  it("forfeits the starter before the first play and restarts the round with the next player", () => {
    const state = createGameState({
      playerIds: ["A", "B", "C"],
      displayNames: { A: "A", B: "B", C: "C" },
      starterPlayerId: "A",
      rng: () => 0
    });

    const next = forfeitPlayer(state, { playerId: "A" });
    expect(next.players.A.status).toBe("left");
    expect(next.round?.starterPlayerId).toBe("B");
    expect(next.forfeitedPlayerIds).toContain("A");
  });

  it("creates a local view with bluff actions", () => {
    let state = createGameState({
      playerIds: ["A", "B"],
      displayNames: { A: "A", B: "B" },
      starterPlayerId: "A",
      rng: () => 0
    });

    state = playCards(state, {
      playerId: "A",
      cardIds: state.players.A.hand.slice(0, 1),
      declaredRank: "Q"
    });

    const view = createGameView(state, "B");
    expect(view.canChallenge).toBe(true);
    expect(view.canSkip).toBe(true);
    expect(view.declaredRank).toBe("Q");
  });
});
