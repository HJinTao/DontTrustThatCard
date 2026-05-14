import {
  createShuffledDeck,
  isDeclaredRank,
  type Card,
  type Rank
} from "./cards";
import type {
  ChallengeInput,
  CreateGameStateInput,
  ForfeitInput,
  GameState,
  PlayCardsInput,
  PlayerState,
  RoundState,
  SkipTurnInput
} from "./state";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function cloneRound(round: RoundState | null): RoundState | null {
  if (!round) {
    return null;
  }

  return {
    ...round,
    skippedPlayerIdsSinceLastPlay: [...round.skippedPlayerIdsSinceLastPlay],
    lastPlayedHand: round.lastPlayedHand
      ? {
          ...round.lastPlayedHand,
          cardIds: [...round.lastPlayedHand.cardIds]
        }
      : null
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    deckCardIds: [...state.deckCardIds],
    playerOrder: [...state.playerOrder],
    players: Object.fromEntries(
      Object.entries(state.players).map(([playerId, player]) => [
        playerId,
        {
          ...player,
          hand: [...player.hand]
        }
      ])
    ),
    tablePile: [...state.tablePile],
    round: cloneRound(state.round),
    placements: [...state.placements],
    forfeitedPlayerIds: [...state.forfeitedPlayerIds],
    latestResult: state.latestResult ? { ...state.latestResult } : null
  };
}

function getCompetingPlayerIds(state: GameState): string[] {
  return state.playerOrder.filter((playerId) => {
    const status = state.players[playerId]?.status;
    return status === "active" || status === "pending_win";
  });
}

function getNextCompetingPlayerId(
  state: GameState,
  fromPlayerId: string
): string | null {
  const competingIds = getCompetingPlayerIds(state);

  if (competingIds.length === 0) {
    return null;
  }

  if (competingIds.length === 1) {
    return competingIds[0] ?? null;
  }

  const startIndex = state.playerOrder.indexOf(fromPlayerId);
  invariant(startIndex >= 0, `unknown player: ${fromPlayerId}`);

  for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
    const candidate =
      state.playerOrder[(startIndex + offset) % state.playerOrder.length];
    if (competingIds.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

function createRound(starterPlayerId: string): RoundState {
  return {
    starterPlayerId,
    declaredRank: null,
    currentActorPlayerId: starterPlayerId,
    shangjiaPlayerId: null,
    lastPlayedHand: null,
    skippedPlayerIdsSinceLastPlay: []
  };
}

function removeCardsFromHand(player: PlayerState, cardIds: string[]) {
  for (const cardId of cardIds) {
    const cardIndex = player.hand.indexOf(cardId);
    invariant(cardIndex >= 0, `card ${cardId} not in player hand`);
    player.hand.splice(cardIndex, 1);
  }
}

function validateOwnedCards(state: GameState, input: PlayCardsInput) {
  const player = state.players[input.playerId];
  invariant(player, `unknown player: ${input.playerId}`);
  invariant(input.cardIds.length >= 1 && input.cardIds.length <= 4, "must play 1-4 cards");
  invariant(new Set(input.cardIds).size === input.cardIds.length, "duplicate card ids are not allowed");
  for (const cardId of input.cardIds) {
    invariant(player.hand.includes(cardId), `card ${cardId} not in player hand`);
  }
}

function getCards(state: GameState, cardIds: string[]): Card[] {
  return cardIds.map((cardId) => {
    const card = state.cardsById[cardId];
    invariant(card, `unknown card: ${cardId}`);
    return card;
  });
}

function markPlayerWon(state: GameState, playerId: string) {
  const player = state.players[playerId];
  if (!player || player.status === "won" || player.status === "left") {
    return;
  }

  player.status = "won";
  if (!state.placements.includes(playerId)) {
    state.placements.push(playerId);
  }
}

function finishGameIfNeeded(state: GameState) {
  const competingIds = getCompetingPlayerIds(state);
  if (competingIds.length > 1) {
    return;
  }

  if (competingIds.length === 1) {
    markPlayerWon(state, competingIds[0]);
  }

  state.phase = "finished";
  state.round = null;
  state.nextStarterPlayerId = null;
}

function startNextRound(state: GameState, starterPlayerId: string | null) {
  finishGameIfNeeded(state);
  if (state.phase === "finished") {
    state.tablePile = [];
    return;
  }

  invariant(starterPlayerId, "missing next starter");
  state.tablePile = [];
  state.nextStarterPlayerId = starterPlayerId;
  state.round = createRound(starterPlayerId);
}

function resolvePendingWinBeforeNewPlay(state: GameState, nextPlayerId: string) {
  const shangjiaPlayerId = state.round?.shangjiaPlayerId;
  if (!shangjiaPlayerId || shangjiaPlayerId === nextPlayerId) {
    return;
  }

  const shangjia = state.players[shangjiaPlayerId];
  if (shangjia?.status === "pending_win") {
    markPlayerWon(state, shangjiaPlayerId);
  }
}

function getResolvedNextStarter(
  state: GameState,
  preferredPlayerId: string | null
): string | null {
  if (!preferredPlayerId) {
    return null;
  }

  const preferred = state.players[preferredPlayerId];
  if (preferred && (preferred.status === "active" || preferred.status === "pending_win")) {
    return preferredPlayerId;
  }

  return getNextCompetingPlayerId(state, preferredPlayerId);
}

export function createGameState(input: CreateGameStateInput): GameState {
  invariant(
    input.playerIds.length >= 2 && input.playerIds.length <= 8,
    "player count must be between 2 and 8"
  );
  invariant(
    input.playerIds.includes(input.starterPlayerId),
    "starter must be one of the players"
  );

  const cards = createShuffledDeck(input.playerIds.length, input.rng);
  const cardsById = Object.fromEntries(cards.map((card) => [card.id, card]));
  const players: Record<string, PlayerState> = Object.fromEntries(
    input.playerIds.map((playerId, seatIndex) => [
      playerId,
      {
        playerId,
        displayName: input.displayNames[playerId] ?? playerId,
        seatIndex,
        status: "active" as const,
        hand: []
      }
    ])
  );

  for (let index = 0; index < cards.length; index += 1) {
    const ownerId = input.playerIds[index % input.playerIds.length];
    players[ownerId].hand.push(cards[index].id);
  }

  return {
    phase: "in_round",
    startedPlayerCount: input.playerIds.length,
    deckCardIds: cards.map((card) => card.id),
    cardsById,
    playerOrder: [...input.playerIds],
    players,
    tablePile: [],
    round: createRound(input.starterPlayerId),
    nextStarterPlayerId: input.starterPlayerId,
    placements: [],
    forfeitedPlayerIds: [],
    latestResult: null
  };
}

export function seedHands(
  state: GameState,
  handsByPlayerId: Record<string, string[]>
): GameState {
  const next = cloneState(state);
  const assignedCardIds = new Set<string>();

  for (const playerId of next.playerOrder) {
    const hand = handsByPlayerId[playerId] ?? [];
    for (const cardId of hand) {
      invariant(next.cardsById[cardId], `unknown card: ${cardId}`);
      invariant(!assignedCardIds.has(cardId), `card ${cardId} assigned twice`);
      assignedCardIds.add(cardId);
    }
    next.players[playerId].hand = [...hand];
    if (next.players[playerId].status === "pending_win") {
      next.players[playerId].status = "active";
    }
  }

  next.tablePile = [];
  next.round = next.nextStarterPlayerId ? createRound(next.nextStarterPlayerId) : null;
  next.phase = "in_round";
  next.placements = [];
  next.forfeitedPlayerIds = [];
  next.latestResult = null;

  return next;
}

export function playCards(state: GameState, input: PlayCardsInput): GameState {
  const next = cloneState(state);
  invariant(next.phase === "in_round", "game is already finished");
  invariant(next.round, "round is not active");
  invariant(next.round.currentActorPlayerId === input.playerId, "not this player's turn");
  invariant(isDeclaredRank(input.declaredRank), "declared rank must be A-K");

  validateOwnedCards(next, input);

  const player = next.players[input.playerId];
  invariant(player.status !== "won" && player.status !== "left", "player is not active");

  resolvePendingWinBeforeNewPlay(next, input.playerId);
  if (next.round === null) {
    return next;
  }

  const round = next.round;
  invariant(round, "round is not active");

  if (round.declaredRank === null) {
    round.declaredRank = input.declaredRank;
  } else {
    invariant(round.declaredRank === input.declaredRank, "declared rank is locked for this round");
  }

  removeCardsFromHand(player, input.cardIds);
  next.tablePile.push(...input.cardIds);
  round.shangjiaPlayerId = input.playerId;
  round.lastPlayedHand = {
    playerId: input.playerId,
    cardIds: [...input.cardIds],
    declaredRank: round.declaredRank,
    declaredCount: input.cardIds.length
  };
  round.skippedPlayerIdsSinceLastPlay = [];

  if (player.hand.length === 0) {
    player.status = "pending_win";
  }

  const nextActor = getNextCompetingPlayerId(next, input.playerId);
  invariant(nextActor, "could not find next actor");
  round.currentActorPlayerId = nextActor;
  next.latestResult = null;

  finishGameIfNeeded(next);
  return next;
}

export function skipTurn(state: GameState, input: SkipTurnInput): GameState {
  const next = cloneState(state);
  invariant(next.phase === "in_round", "game is already finished");
  invariant(next.round, "round is not active");
  invariant(next.round.currentActorPlayerId === input.playerId, "not this player's turn");
  invariant(next.round.lastPlayedHand, "the round starter cannot skip before a play");

  if (!next.round.skippedPlayerIdsSinceLastPlay.includes(input.playerId)) {
    next.round.skippedPlayerIdsSinceLastPlay.push(input.playerId);
  }

  const shangjiaPlayerId = next.round.shangjiaPlayerId;
  invariant(shangjiaPlayerId, "missing shangjia");

  const requiredSkips = getCompetingPlayerIds(next).filter(
    (playerId) => playerId !== shangjiaPlayerId
  );

  const allSkipped = requiredSkips.every((playerId) =>
    next.round?.skippedPlayerIdsSinceLastPlay.includes(playerId)
  );

  if (allSkipped) {
    const shangjia = next.players[shangjiaPlayerId];
    if (shangjia?.status === "pending_win") {
      markPlayerWon(next, shangjiaPlayerId);
    }

    next.latestResult = {
      type: "pass",
      playerId: shangjiaPlayerId
    };

    const starter = getResolvedNextStarter(next, shangjiaPlayerId);
    startNextRound(next, starter);
    return next;
  }

  const nextActor = getNextCompetingPlayerId(next, input.playerId);
  invariant(nextActor, "could not find next actor");
  next.round.currentActorPlayerId = nextActor;
  next.latestResult = null;

  return next;
}

export function challengeLastPlay(
  state: GameState,
  input: ChallengeInput
): GameState {
  const next = cloneState(state);
  invariant(next.phase === "in_round", "game is already finished");
  invariant(next.round, "round is not active");
  invariant(next.round.currentActorPlayerId === input.playerId, "not this player's turn");
  invariant(next.round.lastPlayedHand, "no played hand to challenge");
  invariant(next.round.shangjiaPlayerId, "missing shangjia");

  const challengedPlayerId = next.round.shangjiaPlayerId;
  const challengedCards = getCards(next, next.round.lastPlayedHand.cardIds);
  const declaredRank = next.round.declaredRank;
  invariant(declaredRank, "declared rank is missing");

  const truthful = challengedCards.every(
    (card) => card.rank === "JOKER" || card.rank === declaredRank
  );

  const pile = [...next.tablePile];
  const loserId = truthful ? input.playerId : challengedPlayerId;
  next.players[loserId].hand.push(...pile);
  if (next.players[loserId].status === "pending_win") {
    next.players[loserId].status = "active";
  }
  next.tablePile = [];

  if (truthful && next.players[challengedPlayerId].status === "pending_win") {
    markPlayerWon(next, challengedPlayerId);
  } else if (!truthful && next.players[challengedPlayerId].status === "pending_win") {
    next.players[challengedPlayerId].status = "active";
  }

  next.latestResult = {
    type: "challenge",
    challengerPlayerId: input.playerId,
    challengedPlayerId,
    success: !truthful
  };

  const preferredStarter = truthful ? challengedPlayerId : input.playerId;
  const nextStarter = getResolvedNextStarter(next, preferredStarter);
  startNextRound(next, nextStarter);
  return next;
}

export function forfeitPlayer(
  state: GameState,
  input: ForfeitInput
): GameState {
  const next = cloneState(state);
  const player = next.players[input.playerId];
  invariant(player, `unknown player: ${input.playerId}`);

  if (player.status === "won" || player.status === "left") {
    return next;
  }

  player.status = "left";
  player.hand = [];
  if (!next.forfeitedPlayerIds.includes(input.playerId)) {
    next.forfeitedPlayerIds.push(input.playerId);
  }

  next.latestResult = {
    type: "forfeit",
    playerId: input.playerId
  };

  if (!next.round) {
    finishGameIfNeeded(next);
    return next;
  }

  const noPlayYet = next.round.lastPlayedHand === null;
  const wasCurrentActor = next.round.currentActorPlayerId === input.playerId;
  const wasShangjia = next.round.shangjiaPlayerId === input.playerId;

  if (noPlayYet || wasShangjia) {
    next.tablePile = [];
    const starter = getNextCompetingPlayerId(next, input.playerId);
    startNextRound(next, starter);
    return next;
  }

  next.round.skippedPlayerIdsSinceLastPlay =
    next.round.skippedPlayerIdsSinceLastPlay.filter(
      (playerId) => playerId !== input.playerId
    );

  if (wasCurrentActor) {
    const nextActor = getNextCompetingPlayerId(next, input.playerId);
    if (nextActor) {
      next.round.currentActorPlayerId = nextActor;
    }
  }

  finishGameIfNeeded(next);
  return next;
}
