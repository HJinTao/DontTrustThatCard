import { useEffect, useState } from "react";

import type { GameSnapshot, Rank } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";
import { ActionBar } from "./ActionBar";
import { ChatPanel } from "./ChatPanel";
import { HandPanel } from "./HandPanel";
import { PlayerStrip } from "./PlayerStrip";

type GameTableProps = {
  snapshot: GameSnapshot;
  onPlay: (cardIds: string[], declaredRank: Rank) => void;
  onSkip: () => void;
  onChallenge: () => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
};

function formatTimer(timerEndsAtMs: number | null) {
  if (!timerEndsAtMs) {
    return "--";
  }

  const remaining = Math.max(0, Math.ceil((timerEndsAtMs - Date.now()) / 1000));
  return `${remaining}s`;
}

export function GameTable({
  snapshot,
  onPlay,
  onSkip,
  onChallenge,
  onLeave,
  onSendChat
}: GameTableProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [declaredRank, setDeclaredRank] = useState<Rank>(snapshot.declaredRank ?? "A");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    dispatchAudioEvent("score-tick", {
      chips: snapshot.pileCount,
      mult: snapshot.lastDeclaredCount ?? 0
    });

    if ((snapshot.lastDeclaredCount ?? 0) >= 10) {
      dispatchAudioEvent("mult-fire", {
        mult: snapshot.lastDeclaredCount
      });
    }
  }, [snapshot.lastDeclaredCount, snapshot.pileCount]);

  useEffect(() => {
    if (snapshot.declaredRank) {
      setDeclaredRank(snapshot.declaredRank);
    }
  }, [snapshot.declaredRank]);

  const localPlayer = snapshot.players.find(
    (player) => player.playerId === snapshot.localPlayerId
  );
  const chipsValue = snapshot.pileCount.toString().padStart(2, "0");
  const multValue = (snapshot.lastDeclaredCount ?? 0).toString().padStart(2, "0");

  return (
    <div className={`table-shell ${reduceMotion ? "reduce-motion" : ""}`}>
      <div className="rotate-hint">请横屏后继续牌局</div>
      <div className="table-layout">
        <header className="panel top-bar">
          <div>
            <span className="label">ROOM</span>
            <strong>{snapshot.roomCode}</strong>
          </div>
          <div>
            <span className="label">ROUND</span>
            <strong>{snapshot.declaredRank ?? "待首发"}</strong>
          </div>
          <div>
            <span className="label">ACTOR</span>
            <strong>{snapshot.players.find((player) => player.playerId === snapshot.currentActorPlayerId)?.displayName ?? "--"}</strong>
          </div>
          <div>
            <span className="label">TIMER</span>
            <strong>{formatTimer(snapshot.timerEndsAtMs)}</strong>
          </div>
          <button
            type="button"
            className="pixel-button secondary compact"
            onClick={() => setReduceMotion((value) => !value)}
          >
            {reduceMotion ? "动态关闭" : "动态开启"}
          </button>
        </header>

        <main className="table-main">
          <section className="table-center">
            <div className="score-panel panel" aria-live="polite">
              <div className="score-block">
                <span>CHIPS</span>
                <strong>{chipsValue}</strong>
              </div>
              <div className={`score-block ${Number(multValue) >= 10 ? "is-on-fire" : ""}`}>
                <span>MULT</span>
                <strong>{multValue}</strong>
              </div>
              <div className="round-callout">
                <span className="label">DECLARE</span>
                <strong>{snapshot.declaredRank ? `${snapshot.lastDeclaredCount ?? 0} 张 ${snapshot.declaredRank}` : "等待首发"}</strong>
                {snapshot.latestResult?.type === "challenge" ? (
                  <span className={`bluff-stamp ${snapshot.latestResult.success ? "bluff-fail" : "bluff-pass"}`}>
                    {snapshot.latestResult.success ? "BLUFF!" : "LEGIT!"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="table-cloth panel">
              <div className="cloth-column">
                <span className="label">上家</span>
                <strong>{snapshot.players.find((player) => player.playerId === snapshot.shangjiaPlayerId)?.displayName ?? "--"}</strong>
              </div>
              <div className="cloth-column">
                <span className="label">牌堆</span>
                <strong>{snapshot.pileCount} 张</strong>
              </div>
              <div className="cloth-column">
                <span className="label">你的状态</span>
                <strong>{localPlayer?.status ?? "--"}</strong>
              </div>
            </div>

            <HandPanel
              cards={snapshot.localHand}
              selectedCardIds={selectedCardIds}
              onToggleCard={(cardId) =>
                setSelectedCardIds((current) =>
                  current.includes(cardId)
                    ? current.filter((value) => value !== cardId)
                    : [...current, cardId]
                )
              }
            />

            <ActionBar
              declaredRank={declaredRank}
              selectedCount={selectedCardIds.length}
              canPlay={snapshot.canPlay}
              canSkip={snapshot.canSkip}
              canChallenge={snapshot.canChallenge}
              onDeclaredRankChange={setDeclaredRank}
              onPlay={() => {
                onPlay(selectedCardIds, declaredRank);
                setSelectedCardIds([]);
              }}
              onSkip={onSkip}
              onChallenge={onChallenge}
            />
          </section>

          <div className="table-side">
            <PlayerStrip
              players={snapshot.players}
              currentActorPlayerId={snapshot.currentActorPlayerId}
              shangjiaPlayerId={snapshot.shangjiaPlayerId}
            />
            <ChatPanel messages={snapshot.chat} onSend={onSendChat} />
          </div>
        </main>

        <footer className="table-footer panel">
          <span>{snapshot.placements.length > 0 ? `已出局顺位：${snapshot.placements.join(" → ")}` : "暂无结算顺位"}</span>
          <button
            type="button"
            className="pixel-button secondary compact"
            onClick={onLeave}
          >
            离开房间
          </button>
        </footer>
      </div>
    </div>
  );
}
