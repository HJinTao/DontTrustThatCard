import { useState } from "react";

import type { RoomSnapshot, TimerOption } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";
import { ChatPanel } from "./ChatPanel";

type LobbyViewProps = {
  snapshot: RoomSnapshot;
  localPlayerId: string | null;
  onSetReady: (ready: boolean) => void;
  onStart: () => void;
  onSetTimer: (seconds: TimerOption) => void;
  onSetRoomCode: (roomCode: string) => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
};

const TIMER_OPTIONS: TimerOption[] = [15, 20, 30, 45, 60];

export function LobbyView({
  snapshot,
  localPlayerId,
  onSetReady,
  onStart,
  onSetTimer,
  onSetRoomCode,
  onLeave,
  onSendChat
}: LobbyViewProps) {
  const [roomCodeDraft, setRoomCodeDraft] = useState(snapshot.roomCode);
  const localPlayer = snapshot.players.find((player) => player.playerId === localPlayerId);
  const isHost = localPlayer?.isHost ?? false;
  const allReady = snapshot.players.length >= 2 && snapshot.players.every((player) => player.ready);

  return (
    <div className="table-shell">
      <div className="rotate-hint">请横屏后继续牌局</div>
      <div className="lobby-layout">
        <section className="panel lobby-hero">
          <header className="panel-header">
            <span>唬牌房间</span>
          </header>
          <div className="lobby-grid">
            <div className="lobby-meta">
              <label className="field">
                <span>房间码</span>
                <div className="field-inline">
                  <input
                    aria-label="房间码"
                    value={roomCodeDraft}
                    disabled={!isHost}
                    onChange={(event) => setRoomCodeDraft(event.target.value.toUpperCase())}
                  />
                  <button
                    type="button"
                    className="pixel-button secondary compact"
                    disabled={!isHost}
                    onClick={() => onSetRoomCode(roomCodeDraft)}
                  >
                    更新
                  </button>
                </div>
              </label>
              <label className="field">
                <span>回合倒计时</span>
                <select
                  aria-label="回合倒计时"
                  value={snapshot.timerSeconds}
                  disabled={!isHost}
                  onChange={(event) => onSetTimer(Number(event.target.value) as TimerOption)}
                >
                  {TIMER_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} 秒
                    </option>
                  ))}
                </select>
              </label>
              <div className="summary-rail">
                <div>
                  <span className="label">规则</span>
                  <strong>2-8 人 / 5 人起双牌组</strong>
                </div>
                <div>
                  <span className="label">状态</span>
                  <strong>{snapshot.phase === "game_over" ? "结算中" : "等待开局"}</strong>
                </div>
              </div>
              {snapshot.lastGameSummary ? (
                <section className="last-game panel inset">
                  <header className="panel-header">
                    <span>上一局结算</span>
                  </header>
                  <p>开局人数：{snapshot.lastGameSummary.startedPlayerCount}</p>
                  <p>
                    顺位：
                    {snapshot.lastGameSummary.placements.length > 0
                      ? snapshot.lastGameSummary.placements
                          .map((entry) => entry.displayName)
                          .join(" → ")
                      : "暂无顺位"}
                  </p>
                  <p>
                    判负离场：
                    {snapshot.lastGameSummary.forfeits.length > 0
                      ? snapshot.lastGameSummary.forfeits
                          .map((entry) => entry.displayName)
                          .join("、")
                      : "无"}
                  </p>
                </section>
              ) : null}
            </div>

            <div className="panel lobby-seats inset">
              <header className="panel-header">
                <span>房间成员</span>
              </header>
              <div className="seat-list">
                {snapshot.players.map((player) => (
                  <article
                    key={player.playerId}
                    className={`seat-card ${player.ready ? "is-ready" : ""}`}
                  >
                    <div className="player-row">
                      <strong>{player.displayName}</strong>
                      <span>{player.isHost ? "房主" : `座位 ${player.seatIndex + 1}`}</span>
                    </div>
                    <div className="suspicion-track">
                      <div
                        className="suspicion-fill"
                        style={{ width: player.ready ? "100%" : "22%" }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <div className="lobby-actions">
            <button
              type="button"
              className={`pixel-button secondary ${localPlayer?.ready ? "is-ready" : ""}`}
              onMouseEnter={() => dispatchAudioEvent("button-hover", { id: "toggle-ready" })}
              onClick={() => onSetReady(!(localPlayer?.ready ?? false))}
            >
              {localPlayer?.ready ? "取消准备" : "准备"}
            </button>
            <button
              type="button"
              className="pixel-button primary"
              disabled={!isHost || !allReady}
              onMouseEnter={() => dispatchAudioEvent("button-hover", { id: "start-game" })}
              onClick={onStart}
            >
              开始对局
            </button>
            <button
              type="button"
              className="pixel-button secondary compact"
              onClick={onLeave}
            >
              离开房间
            </button>
          </div>
        </section>

        <ChatPanel messages={snapshot.chat} onSend={onSendChat} />
      </div>
    </div>
  );
}
