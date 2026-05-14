import {
  createGameState,
  forfeitPlayer,
  playCards,
  skipTurn,
  challengeLastPlay,
  type CreateGameStateInput,
  type GameState,
  type PlayCardsInput
} from "@dont-trust-that-card/shared";

export function createEngineGame(input: CreateGameStateInput): GameState {
  return createGameState(input);
}

export function applyPlay(state: GameState, input: PlayCardsInput): GameState {
  return playCards(state, input);
}

export function applyChallenge(state: GameState, playerId: string): GameState {
  return challengeLastPlay(state, { playerId });
}

export function applySkip(state: GameState, playerId: string): GameState {
  return skipTurn(state, { playerId });
}

export function applyForfeit(state: GameState, playerId: string): GameState {
  return forfeitPlayer(state, { playerId });
}

export function applyTurnTimeout(state: GameState, playerId: string): GameState {
  if (state.phase !== "in_round" || !state.round) {
    return state;
  }

  if (state.round.currentActorPlayerId !== playerId) {
    throw new Error("timeout player is not the current actor");
  }

  return state.round.lastPlayedHand === null
    ? forfeitPlayer(state, { playerId })
    : skipTurn(state, { playerId });
}
