import type { Card, Rank } from "./cards";

export type PlayerStatus = "active" | "pending_win" | "won" | "left";
export type GamePhase = "in_round" | "finished";

export type PlayerState = {
  playerId: string;
  displayName: string;
  seatIndex: number;
  status: PlayerStatus;
  hand: string[];
};

export type PlayedHand = {
  playerId: string;
  cardIds: string[];
  declaredRank: Rank;
  declaredCount: number;
};

export type RoundState = {
  starterPlayerId: string;
  declaredRank: Rank | null;
  currentActorPlayerId: string;
  shangjiaPlayerId: string | null;
  lastPlayedHand: PlayedHand | null;
  skippedPlayerIdsSinceLastPlay: string[];
};

export type GameState = {
  phase: GamePhase;
  startedPlayerCount: number;
  deckCardIds: string[];
  cardsById: Record<string, Card>;
  playerOrder: string[];
  players: Record<string, PlayerState>;
  tablePile: string[];
  round: RoundState | null;
  nextStarterPlayerId: string | null;
  placements: string[];
  forfeitedPlayerIds: string[];
  latestResult:
    | {
        type: "challenge";
        challengerPlayerId: string;
        challengedPlayerId: string;
        success: boolean;
      }
    | {
        type: "pass";
        playerId: string;
      }
    | {
        type: "forfeit";
        playerId: string;
      }
    | null;
};

export type CreateGameStateInput = {
  playerIds: string[];
  displayNames: Record<string, string>;
  starterPlayerId: string;
  rng?: () => number;
};

export type PlayCardsInput = {
  playerId: string;
  cardIds: string[];
  declaredRank: Rank;
};

export type SkipTurnInput = {
  playerId: string;
};

export type ChallengeInput = {
  playerId: string;
};

export type ForfeitInput = {
  playerId: string;
};
