import {
  TIMER_OPTIONS,
  createGameView,
  isDeclaredRank,
  type ChatMessage,
  type GameSnapshot,
  type GameState,
  type RoomSnapshot,
  type TimerOption
} from "@dont-trust-that-card/shared";

import { applyChallenge, applyPlay, applyTurnTimeout, createEngineGame } from "../game/engine";
import { applyForfeit, applySkip } from "../game/engine";

export type RoomPhase = "lobby" | "in_game" | "game_over";

export type RoomPlayer = {
  playerId: string;
  displayName: string;
  ready: boolean;
  joinedOrder: number;
};

export type CreateRoomOptions = {
  code: string;
  hostName: string;
  now?: () => number;
  rng?: () => number;
};

const PLAYER_NAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9]{2,12}$/u;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function normalizePlayerName(playerName: string): string {
  const trimmed = playerName.trim();
  invariant(PLAYER_NAME_PATTERN.test(trimmed), "player name must be 2-12 Chinese/letter/digit characters");
  return trimmed;
}

export function normalizeRoomCode(roomCode: string): string {
  const normalized = roomCode.trim().toUpperCase();
  invariant(ROOM_CODE_PATTERN.test(normalized), "room code must be 6 uppercase letters or digits");
  return normalized;
}

export class Room {
  code: string;
  hostPlayerId: string;
  timerSeconds: TimerOption;
  phase: RoomPhase;
  players: RoomPlayer[];
  chat: ChatMessage[];
  gameState: GameState | null;
  lastGameSummary: RoomSnapshot["lastGameSummary"];

  private readonly now: () => number;
  private readonly rng: () => number;
  private playerSequence: number;
  private messageSequence: number;
  turnEndsAtMs: number | null;

  constructor(options: CreateRoomOptions) {
    this.code = normalizeRoomCode(options.code);
    this.now = options.now ?? Date.now;
    this.rng = options.rng ?? Math.random;
    this.timerSeconds = 30;
    this.phase = "lobby";
    this.players = [];
    this.chat = [];
    this.gameState = null;
    this.lastGameSummary = null;
    this.playerSequence = 0;
    this.messageSequence = 0;
    this.turnEndsAtMs = null;

    const host = this.join({ playerName: options.hostName });
    this.hostPlayerId = host.playerId;
    this.appendSystemMessage(`${host.displayName} 创建了房间`);
  }

  private createPlayerId(): string {
    this.playerSequence += 1;
    return `player-${this.playerSequence}`;
  }

  private createMessage(
    kind: "chat" | "system",
    text: string,
    playerId: string | null = null,
    displayName: string | null = null
  ): ChatMessage {
    this.messageSequence += 1;
    return {
      id: `msg-${this.messageSequence}`,
      kind,
      playerId,
      displayName,
      text,
      createdAt: this.now()
    };
  }

  private trimChat() {
    if (this.chat.length > 100) {
      this.chat = this.chat.slice(-100);
    }
  }

  private appendSystemMessage(text: string) {
    this.chat.push(this.createMessage("system", text));
    this.trimChat();
  }

  private findPlayer(playerId: string): RoomPlayer {
    const player = this.players.find((entry) => entry.playerId === playerId);
    invariant(player, "unknown room player");
    return player;
  }

  private assertHost(playerId: string) {
    invariant(this.hostPlayerId === playerId, "only the host can perform this action");
  }

  private setNextTurnDeadline() {
    this.turnEndsAtMs = this.phase === "in_game" ? this.now() + this.timerSeconds * 1000 : null;
  }

  private ensureUniqueDisplayName(baseName: string): string {
    const existing = new Set(this.players.map((player) => player.displayName));
    if (!existing.has(baseName)) {
      return baseName;
    }

    let suffix = 2;
    while (existing.has(`${baseName}#${suffix}`)) {
      suffix += 1;
    }
    return `${baseName}#${suffix}`;
  }

  private finishGame() {
    invariant(this.gameState, "missing game state");

    const state = this.gameState;
    this.lastGameSummary = {
      placements: state.placements.map((playerId) => ({
        playerId,
        displayName: state.players[playerId]?.displayName ?? playerId
      })),
      forfeits: state.forfeitedPlayerIds.map((playerId) => ({
        playerId,
        displayName: state.players[playerId]?.displayName ?? playerId
      })),
      startedPlayerCount: state.startedPlayerCount
    };

    this.phase = "game_over";
    this.gameState = null;
    this.turnEndsAtMs = null;
    this.players = this.players.map((player) => ({
      ...player,
      ready: false
    }));
    this.appendSystemMessage("本局结束，房间已回到准备阶段");
  }

  private syncGameState(nextState: GameState) {
    this.gameState = nextState;
    if (nextState.phase === "finished") {
      this.finishGame();
      return;
    }

    this.phase = "in_game";
    this.setNextTurnDeadline();
  }

  join(input: { playerName: string }) {
    invariant(this.phase !== "in_game", "cannot join a room after the game has started");
    invariant(this.players.length < 8, "room is full");

    const baseName = normalizePlayerName(input.playerName);
    const displayName = this.ensureUniqueDisplayName(baseName);
    const player = {
      playerId: this.createPlayerId(),
      displayName,
      ready: false,
      joinedOrder: this.players.length
    };
    this.players.push(player);
    this.appendSystemMessage(`${displayName} 加入了房间`);
    return player;
  }

  leave(playerId: string) {
    const index = this.players.findIndex((entry) => entry.playerId === playerId);
    if (index === -1) {
      return;
    }

    const [departing] = this.players.splice(index, 1);
    this.appendSystemMessage(`${departing.displayName} 离开了房间`);

    if (this.phase === "in_game" && this.gameState) {
      this.syncGameState(applyForfeit(this.gameState, playerId));
    }

    if (this.players.length === 0) {
      this.hostPlayerId = "";
      return;
    }

    if (this.hostPlayerId === playerId) {
      this.hostPlayerId = this.players[0].playerId;
      this.appendSystemMessage(`${this.players[0].displayName} 成为了新房主`);
    }
  }

  forfeit(playerId: string) {
    invariant(this.phase === "in_game" && this.gameState, "game is not active");
    this.appendSystemMessage(`${this.findPlayer(playerId).displayName} 超时或退出，判负离场`);
    this.syncGameState(applyForfeit(this.gameState, playerId));
    this.players = this.players.filter((player) => player.playerId !== playerId);

    if (this.players.length === 0) {
      this.hostPlayerId = "";
      return;
    }

    if (this.hostPlayerId === playerId) {
      this.hostPlayerId = this.players[0].playerId;
    }
  }

  setReady(playerId: string, ready: boolean) {
    invariant(this.phase !== "in_game", "cannot change ready state during a game");
    const player = this.findPlayer(playerId);
    player.ready = ready;
  }

  setTimer(playerId: string, seconds: TimerOption) {
    this.assertHost(playerId);
    invariant(this.phase !== "in_game", "cannot change the timer during a game");
    invariant(TIMER_OPTIONS.includes(seconds), "invalid timer option");
    this.timerSeconds = seconds;
  }

  setCode(playerId: string, roomCode: string) {
    this.assertHost(playerId);
    invariant(this.phase !== "in_game", "cannot change room code during a game");
    this.code = normalizeRoomCode(roomCode);
  }

  sendChat(playerId: string, text: string) {
    const trimmed = text.trim();
    invariant(trimmed.length > 0, "chat message cannot be empty");
    const player = this.findPlayer(playerId);
    this.chat.push(this.createMessage("chat", trimmed, player.playerId, player.displayName));
    this.trimChat();
  }

  startGame(playerId: string) {
    this.assertHost(playerId);
    invariant(this.phase !== "in_game", "game is already active");
    invariant(this.players.length >= 2 && this.players.length <= 8, "room must have 2-8 players");
    invariant(this.players.every((player) => player.ready), "all players must be ready");

    const starterIndex = Math.floor(this.rng() * this.players.length);
    const starterPlayerId = this.players[starterIndex].playerId;
    this.gameState = createEngineGame({
      playerIds: this.players.map((player) => player.playerId),
      displayNames: Object.fromEntries(
        this.players.map((player) => [player.playerId, player.displayName])
      ),
      starterPlayerId,
      rng: this.rng
    });
    this.lastGameSummary = null;
    this.phase = "in_game";
    this.setNextTurnDeadline();
    this.appendSystemMessage("对局开始");
    return this.getGameSnapshot(playerId);
  }

  playCards(playerId: string, cardIds: string[], declaredRank: string) {
    invariant(this.phase === "in_game" && this.gameState, "game is not active");
    invariant(isDeclaredRank(declaredRank), "declared rank must be A-K");
    const nextState = applyPlay(this.gameState, {
      playerId,
      cardIds,
      declaredRank
    });
    this.syncGameState(nextState);
  }

  skip(playerId: string) {
    invariant(this.phase === "in_game" && this.gameState, "game is not active");
    const nextState = applySkip(this.gameState, playerId);
    this.syncGameState(nextState);
  }

  challenge(playerId: string) {
    invariant(this.phase === "in_game" && this.gameState, "game is not active");
    const nextState = applyChallenge(this.gameState, playerId);
    this.syncGameState(nextState);
  }

  handleTurnTimeout(playerId: string) {
    invariant(this.phase === "in_game" && this.gameState, "game is not active");
    const openingTurn = this.gameState.round?.lastPlayedHand === null;
    this.appendSystemMessage(
      openingTurn ? `${this.findPlayer(playerId).displayName} 开局超时，判负离场` : `${this.findPlayer(playerId).displayName} 超时，系统自动跳过`
    );
    const nextState = applyTurnTimeout(this.gameState, playerId);
    this.syncGameState(nextState);
  }

  getRoomSnapshot(localPlayerId: string): RoomSnapshot {
    return {
      phase: this.phase === "game_over" ? "game_over" : "lobby",
      roomCode: this.code,
      hostPlayerId: this.hostPlayerId,
      localPlayerId,
      timerSeconds: this.timerSeconds,
      players: this.players.map((player, seatIndex) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        ready: player.ready,
        isHost: player.playerId === this.hostPlayerId,
        seatIndex
      })),
      chat: [...this.chat],
      lastGameSummary: this.lastGameSummary ?? null
    };
  }

  getGameSnapshot(localPlayerId: string): GameSnapshot {
    invariant(this.gameState, "game state is not available");
    const view = createGameView(this.gameState, localPlayerId);

    return {
      ...view,
      phase: "in_game",
      roomCode: this.code,
      hostPlayerId: this.hostPlayerId,
      timerSeconds: this.timerSeconds,
      chat: [...this.chat],
      timerEndsAtMs: this.turnEndsAtMs
    };
  }

  getSnapshotForPlayer(localPlayerId: string) {
    return this.phase === "in_game" && this.gameState
      ? this.getGameSnapshot(localPlayerId)
      : this.getRoomSnapshot(localPlayerId);
  }
}
