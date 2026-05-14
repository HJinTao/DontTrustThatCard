import type { Card } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";
import { getCardImage } from "../lib/cardAssets";

type HandPanelProps = {
  cards: Card[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
};

export function HandPanel({
  cards,
  selectedCardIds,
  onToggleCard
}: HandPanelProps) {
  return (
    <section className="hand-panel panel">
      <header className="panel-header">
        <span>你的手牌</span>
      </header>
      <div className="hand-grid">
        {cards.map((card) => {
          const selected = selectedCardIds.includes(card.id);
          const image = getCardImage(card);
          const label =
            card.rank === "JOKER"
              ? `${card.jokerColor === "red" ? "红" : "黑"}王`
              : `${card.suit} ${card.rank}`;

          return (
            <button
              key={card.id}
              type="button"
              className={`hand-card ${selected ? "is-selected" : ""}`}
              aria-label={`${label}${selected ? "，已选中" : ""}`}
              onMouseEnter={() => dispatchAudioEvent("button-hover", { id: card.id })}
              onClick={() => {
                dispatchAudioEvent("card-flip", { cardId: card.id });
                onToggleCard(card.id);
              }}
            >
              {image ? <img src={image} alt={label} /> : <span>{label}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
