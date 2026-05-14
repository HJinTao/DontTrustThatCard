import type { Card, Rank } from "./cards";
import type { GameState, PlayerStatus } from "./state";

export type PublicPlayerView = {
  playerId: string;
  displayName: string;
  seatIndex: number;
  status: PlayerStatus;
  handCount: number;
};

export type GameView = {
  phase: "in_game" | "game_over";
  localPlayerId: string;
  localHand: Card[];
  players: PublicPlayerView[];
  currentActorPlayerId: string | null;
  shangjiaPlayerId: string | null;
  declaredRank: Rank | null;
  lastDeclaredCount: number | null;
  pileCount: number;
  placements: string[];
  forfeitedPlayerIds: string[];
  canPlay: boolean;
  canSkip: boolean;
  canChallenge: boolean;
  latestResult: GameState["latestResult"];
};

export function createGameView(state: GameState, localPlayerId: string): GameView {
  const localPlayer = state.players[localPlayerId];
  if (!localPlayer) {
    throw new Error(`unknown local player: ${localPlayerId}`);
  }

  const round = state.round;
  const isCurrentActor = round?.currentActorPlayerId === localPlayerId;

  return {
    phase: state.phase === "finished" ? "game_over" : "in_game",
    localPlayerId,
    localHand: localPlayer.hand.map((cardId) => state.cardsById[cardId]),
    players: state.playerOrder.map((playerId) => ({
      playerId,
      displayName: state.players[playerId].displayName,
      seatIndex: state.players[playerId].seatIndex,
      status: state.players[playerId].status,
      handCount: state.players[playerId].hand.length
    })),
    currentActorPlayerId: round?.currentActorPlayerId ?? null,
    shangjiaPlayerId: round?.shangjiaPlayerId ?? null,
    declaredRank: round?.declaredRank ?? null,
    lastDeclaredCount: round?.lastPlayedHand?.declaredCount ?? null,
    pileCount: state.tablePile.length,
    placements: [...state.placements],
    forfeitedPlayerIds: [...state.forfeitedPlayerIds],
    canPlay: Boolean(isCurrentActor && state.phase === "in_round"),
    canSkip: Boolean(isCurrentActor && round?.lastPlayedHand),
    canChallenge: Boolean(isCurrentActor && round?.lastPlayedHand && round.shangjiaPlayerId),
    latestResult: state.latestResult
  };
}
