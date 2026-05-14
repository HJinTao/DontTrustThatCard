import { type TimerOption } from "@dont-trust-that-card/shared";

import { Room, normalizeRoomCode } from "./room";

export type CreateRoomInput = {
  hostName: string;
  requestedCode?: string;
};

export type RoomStoreOptions = {
  now?: () => number;
  rng?: () => number;
};

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function createRoomStore(options: RoomStoreOptions = {}) {
  const rooms = new Map<string, Room>();
  const now = options.now ?? Date.now;
  const rng = options.rng ?? Math.random;

  function generateRoomCode(): string {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      let code = "";
      for (let index = 0; index < 6; index += 1) {
        const charIndex = Math.floor(rng() * ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[charIndex];
      }
      if (!rooms.has(code)) {
        return code;
      }
    }

    throw new Error("could not generate a unique room code");
  }

  function getRoom(roomCode: string): Room | null {
    return rooms.get(roomCode.trim().toUpperCase()) ?? null;
  }

  function createRoom(input: CreateRoomInput): Room {
    const roomCode = input.requestedCode
      ? normalizeRoomCode(input.requestedCode)
      : generateRoomCode();
    invariant(!rooms.has(roomCode), "room code already exists");

    const room = new Room({
      code: roomCode,
      hostName: input.hostName,
      now,
      rng
    });
    rooms.set(roomCode, room);
    return room;
  }

  function setRoomCode(roomCode: string, playerId: string, nextCode: string): Room {
    const room = getRoom(roomCode);
    invariant(room, "room not found");
    const normalized = normalizeRoomCode(nextCode);
    if (normalized !== room.code) {
      invariant(!rooms.has(normalized), "room code already exists");
      rooms.delete(room.code);
      room.setCode(playerId, normalized);
      rooms.set(normalized, room);
    }
    return room;
  }

  function removePlayer(roomCode: string, playerId: string) {
    const room = getRoom(roomCode);
    if (!room) {
      return;
    }

    room.leave(playerId);
    if (room.players.length === 0) {
      rooms.delete(roomCode.trim().toUpperCase());
    }
  }

  return {
    createRoom,
    getRoom,
    setRoomCode,
    removePlayer
  };
}

export type RoomStore = ReturnType<typeof createRoomStore>;
