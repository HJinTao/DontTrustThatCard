import type {
  ClientToServerEvents,
  GameSnapshot,
  RoomSnapshot,
  ServerToClientEvents
} from "@dont-trust-that-card/shared";

export type AppSocket = {
  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: (payload: ServerToClientEvents[K]) => void
  ): void;
  off<K extends keyof ServerToClientEvents>(
    event: K,
    listener: (payload: ServerToClientEvents[K]) => void
  ): void;
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    payload: ClientToServerEvents[K]
  ): void;
};

export type AppViewState =
  | {
      kind: "entry";
    }
  | {
      kind: "room";
      snapshot: RoomSnapshot;
    }
  | {
      kind: "game";
      snapshot: GameSnapshot;
    };
