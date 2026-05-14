import type { Card, Rank, TimerOption } from "./cards";
import type { GameView } from "./view";

export type ChatMessage = {
  id: string;
  kind: "chat" | "system";
  playerId: string | null;
  displayName: string | null;
  text: string;
  createdAt: number;
};

export type LobbyPlayerView = {
  playerId: string;
  displayName: string;
  ready: boolean;
  isHost: boolean;
  seatIndex: number;
};

export type FinishedPlayerSummary = {
  playerId: string;
  displayName: string;
};

export type RoomSnapshot = {
  phase: "lobby" | "game_over";
  roomCode: string;
  hostPlayerId: string;
  localPlayerId: string;
  timerSeconds: TimerOption;
  players: LobbyPlayerView[];
  chat: ChatMessage[];
  lastGameSummary?: {
    placements: FinishedPlayerSummary[];
    forfeits: FinishedPlayerSummary[];
    startedPlayerCount: number;
  } | null;
};

export type GameSnapshot = GameView & {
  phase: "in_game" | "game_over";
  roomCode: string;
  hostPlayerId: string;
  timerSeconds: TimerOption;
  chat: ChatMessage[];
  timerEndsAtMs: number | null;
};

export type ClientToServerEvents = {
  "room:create": { playerName: string; requestedCode?: string };
  "room:join": { playerName: string; roomCode: string };
  "room:leave": undefined;
  "room:setCode": { roomCode: string };
  "room:setTimer": { seconds: TimerOption };
  "room:setReady": { ready: boolean };
  "room:start": undefined;
  "game:play": { cardIds: string[]; declaredRank: Rank };
  "game:skip": undefined;
  "game:challenge": undefined;
  "chat:send": { text: string };
};

export type ServerToClientEvents = {
  "room:snapshot": RoomSnapshot;
  "game:snapshot": GameSnapshot;
  "chat:message": ChatMessage;
  "system:message": ChatMessage;
  "action:error": { message: string };
};

export type LocalRoomSession = {
  playerId: string;
  roomCode: string;
};

export type LocalCardSelection = {
  selectedCards: Card[];
};
