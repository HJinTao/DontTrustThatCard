import { startTransition, useEffect, useState } from "react";

import type {
  ClientToServerEvents,
  GameSnapshot,
  RoomSnapshot,
  ServerToClientEvents
} from "@dont-trust-that-card/shared";

import { createSocketClient } from "./lib/socket";
import { GameTable } from "./game/GameTable";
import { LobbyView } from "./game/LobbyView";
import type { AppSocket, AppViewState } from "./game/types";

type AppProps = {
  socket?: AppSocket;
};

function EntryScreen({
  onCreate,
  onJoin,
  error
}: {
  onCreate: (playerName: string, requestedCode?: string) => void;
  onJoin: (playerName: string, roomCode: string) => void;
  error: string | null;
}) {
  const [playerName, setPlayerName] = useState("Player01");
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="entry-shell">
      <section className="panel entry-panel">
        <header className="panel-header">
          <span>唬牌</span>
        </header>
        <p className="entry-copy">
          复古牌桌、即时质疑、多人房间。输入昵称后直接建房或加入。
        </p>
        <label className="field">
          <span>昵称</span>
          <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
        </label>
        <label className="field">
          <span>房间码</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="可留空建房"
          />
        </label>
        {error ? <p className="error-banner">{error}</p> : null}
        <div className="entry-actions">
          <button
            type="button"
            className="pixel-button primary"
            onClick={() => onCreate(playerName, roomCode || undefined)}
          >
            创建房间
          </button>
          <button
            type="button"
            className="pixel-button secondary"
            onClick={() => onJoin(playerName, roomCode)}
          >
            加入房间
          </button>
        </div>
      </section>
    </div>
  );
}

export function App({ socket }: AppProps) {
  const [client] = useState<AppSocket>(() => socket ?? createSocketClient());
  const [viewState, setViewState] = useState<AppViewState>({ kind: "entry" });
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const roomHandler = (snapshot: RoomSnapshot) => {
      startTransition(() => {
        setLocalPlayerId(snapshot.localPlayerId);
        setViewState({ kind: "room", snapshot });
        setError(null);
      });
    };

    const gameHandler = (snapshot: GameSnapshot) => {
      startTransition(() => {
        setLocalPlayerId(snapshot.localPlayerId);
        setViewState({ kind: "game", snapshot });
        setError(null);
      });
    };

    const errorHandler = ({ message }: ServerToClientEvents["action:error"]) => {
      setError(message);
    };

    client.on("room:snapshot", roomHandler);
    client.on("game:snapshot", gameHandler);
    client.on("action:error", errorHandler);

    return () => {
      client.off("room:snapshot", roomHandler);
      client.off("game:snapshot", gameHandler);
      client.off("action:error", errorHandler);
    };
  }, [client]);

  const emit = <K extends keyof ClientToServerEvents>(
    event: K,
    payload: ClientToServerEvents[K]
  ) => {
    client.emit(event, payload);
  };

  if (viewState.kind === "entry") {
    return (
      <EntryScreen
        error={error}
        onCreate={(playerName, requestedCode) =>
          emit("room:create", { playerName, requestedCode })
        }
        onJoin={(playerName, roomCode) =>
          emit("room:join", { playerName, roomCode })
        }
      />
    );
  }

  if (viewState.kind === "room") {
    return (
      <>
        {error ? <p className="error-banner floating">{error}</p> : null}
        <LobbyView
          snapshot={viewState.snapshot}
          localPlayerId={localPlayerId}
          onSetReady={(ready) => emit("room:setReady", { ready })}
          onStart={() => emit("room:start", undefined)}
          onSetTimer={(seconds) => emit("room:setTimer", { seconds })}
          onSetRoomCode={(roomCode) => emit("room:setCode", { roomCode })}
          onLeave={() => emit("room:leave", undefined)}
          onSendChat={(text) => emit("chat:send", { text })}
        />
      </>
    );
  }

  return (
    <>
      {error ? <p className="error-banner floating">{error}</p> : null}
      <GameTable
        snapshot={viewState.snapshot}
        onPlay={(cardIds, declaredRank) => emit("game:play", { cardIds, declaredRank })}
        onSkip={() => emit("game:skip", undefined)}
        onChallenge={() => emit("game:challenge", undefined)}
        onLeave={() => emit("room:leave", undefined)}
        onSendChat={(text) => emit("chat:send", { text })}
      />
    </>
  );
}
