import { io } from "socket.io-client";

import type { AppSocket } from "../game/types";

export function createSocketClient(): AppSocket {
  const socket = io("/", {
    transports: ["websocket"]
  });

  return {
    on(event, listener) {
      socket.on(event, listener as never);
    },
    off(event, listener) {
      socket.off(event, listener as never);
    },
    emit(event, payload) {
      socket.emit(event, payload as never);
    }
  };
}
