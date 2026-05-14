import type { Card } from "@dont-trust-that-card/shared";

const cardImages = import.meta.glob(
  "../../../Assets/PNG/Cards (small)/*.png",
  {
    eager: true,
    import: "default"
  }
) as Record<string, string>;

function toAssetFileName(card: Card): string {
  if (card.rank === "JOKER") {
    return `card_joker_${card.jokerColor ?? "black"}.png`;
  }

  const rank =
    typeof card.rank === "string" && /^[2-9]$/.test(card.rank)
      ? `0${card.rank}`
      : card.rank;

  return `card_${card.suit}_${rank}.png`;
}

export function getCardImage(card: Card): string | null {
  const fileName = toAssetFileName(card);
  const entry = Object.entries(cardImages).find(([path]) => path.endsWith(`/${fileName}`));
  return entry?.[1] ?? null;
}
