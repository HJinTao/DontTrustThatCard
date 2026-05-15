import type { Card } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";
import {
  getCardAltText,
  getCardFallbackImage,
  getCardImageOrFallback
} from "../lib/cardAssets";

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
          const image = getCardImageOrFallback(card) ?? getCardFallbackImage();
          const alt = getCardAltText(card);

          return (
            <button
              key={card.id}
              type="button"
              className={`hand-card ${selected ? "is-selected" : ""}`}
              aria-label={`${alt}${selected ? "，已选中" : ""}`}
              onMouseEnter={() => dispatchAudioEvent("button-hover", { id: card.id })}
              onClick={() => {
                dispatchAudioEvent("card-flip", { cardId: card.id });
                onToggleCard(card.id);
              }}
            >
              {image ? <img src={image} alt={alt} /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
