import type { GameSnapshot } from "@dont-trust-that-card/shared";

type PlayerStripProps = {
  players: GameSnapshot["players"];
  currentActorPlayerId: string | null;
  shangjiaPlayerId: string | null;
};

function getSuspicionValue(
  playerId: string,
  currentActorPlayerId: string | null,
  shangjiaPlayerId: string | null,
  status: string
) {
  if (status === "pending_win") {
    return 92;
  }
  if (playerId === shangjiaPlayerId) {
    return 76;
  }
  if (playerId === currentActorPlayerId) {
    return 48;
  }
  if (status === "left") {
    return 8;
  }
  return 24;
}

export function PlayerStrip({
  players,
  currentActorPlayerId,
  shangjiaPlayerId
}: PlayerStripProps) {
  return (
    <aside className="player-strip panel">
      <header className="panel-header">
        <span>牌桌视线</span>
      </header>
      <div className="player-strip-list">
        {players.map((player) => {
          const suspicion = getSuspicionValue(
            player.playerId,
            currentActorPlayerId,
            shangjiaPlayerId,
            player.status
          );

          return (
            <article
              key={player.playerId}
              className={`player-card ${player.playerId === currentActorPlayerId ? "is-current" : ""}`}
            >
              <div className="player-row">
                <strong>{player.displayName}</strong>
                <span>{player.handCount} 张</span>
              </div>
              <div className="player-row muted">
                <span>{player.status}</span>
                {player.playerId === shangjiaPlayerId ? <span>上家</span> : null}
              </div>
              <div className="suspicion-track" aria-label={`玩家 ${player.displayName} 的怀疑值`}>
                <div className="suspicion-fill" style={{ width: `${suspicion}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
