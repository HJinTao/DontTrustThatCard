import type { Rank } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";

type ActionBarProps = {
  declaredRank: string;
  selectedCount: number;
  canPlay: boolean;
  canSkip: boolean;
  canChallenge: boolean;
  onDeclaredRankChange: (rank: Rank) => void;
  onPlay: () => void;
  onSkip: () => void;
  onChallenge: () => void;
};

const RANK_OPTIONS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function ActionBar({
  declaredRank,
  selectedCount,
  canPlay,
  canSkip,
  canChallenge,
  onDeclaredRankChange,
  onPlay,
  onSkip,
  onChallenge
}: ActionBarProps) {
  return (
    <section className="action-bar panel">
      <div className="declare-panel">
        <span className="label">Declare / Bluff</span>
        <select
          aria-label="声明点数"
          value={declaredRank}
          onChange={(event) => onDeclaredRankChange(event.target.value as Rank)}
        >
          {RANK_OPTIONS.map((rank) => (
            <option key={rank} value={rank}>
              {rank}
            </option>
          ))}
        </select>
        <span className="selected-count">{selectedCount} 张已选</span>
      </div>
      <div className="action-buttons">
        <button
          type="button"
          className={`pixel-button bluff ${canChallenge ? "is-armed" : ""}`}
          disabled={!canChallenge}
          onMouseEnter={() => dispatchAudioEvent("button-hover", { id: "call-bluff" })}
          onClick={() => {
            dispatchAudioEvent("bluff-called", { declaredHand: declaredRank });
            onChallenge();
          }}
        >
          质疑 / CALL BLUFF
        </button>
        <button
          type="button"
          className="pixel-button secondary"
          disabled={!canSkip}
          onMouseEnter={() => dispatchAudioEvent("button-hover", { id: "skip-turn" })}
          onClick={onSkip}
        >
          跳过
        </button>
        <button
          type="button"
          className="pixel-button primary"
          disabled={!canPlay || selectedCount === 0 || selectedCount > 4}
          onMouseEnter={() => dispatchAudioEvent("button-hover", { id: "play-hand" })}
          onClick={onPlay}
        >
          出牌
        </button>
      </div>
    </section>
  );
}
