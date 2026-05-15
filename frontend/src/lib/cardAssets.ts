import type { Card } from "@dont-trust-that-card/shared";

type AssetImageEntry =
  | string
  | {
      default?: AssetImageEntry;
      src?: string;
      href?: string;
    };
type AssetImageMap = Record<string, AssetImageEntry>;
const CARD_ASSET_BASE = `${import.meta.env.BASE_URL}PNG/Cards (medium)`;

const SUIT_LABELS = {
  clubs: "梅花",
  diamonds: "方块",
  hearts: "红桃",
  spades: "黑桃",
  joker: "鬼牌"
} as const;

function findAsset(
  fileName: string,
  images?: AssetImageMap
): string | null {
  if (!images) {
    return `${CARD_ASSET_BASE}/${fileName}`;
  }

  const entry = Object.entries(images).find(([path]) => path.endsWith(`/${fileName}`));
  if (!entry) {
    return null;
  }

  return resolveAssetEntry(entry[1]);
}

function resolveAssetEntry(asset: AssetImageEntry): string | null {
  if (typeof asset === "string") {
    return asset;
  }

  if (typeof asset.src === "string") {
    return asset.src;
  }

  if (typeof asset.href === "string") {
    return asset.href;
  }

  if (asset.default) {
    return resolveAssetEntry(asset.default);
  }

  return null;
}

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

export function getCardFaceImage(
  card: Card,
  images?: AssetImageMap
): string | null {
  return findAsset(toAssetFileName(card), images);
}

export function getCardBackImage(images?: AssetImageMap): string | null {
  return findAsset("card_back.png", images);
}

export function getCardFallbackImage(
  images?: AssetImageMap
): string | null {
  return findAsset("card_empty.png", images) ?? getCardBackImage(images);
}

export function getCardImageOrFallback(
  card: Card,
  images?: AssetImageMap
): string | null {
  return getCardFaceImage(card, images) ?? getCardFallbackImage(images);
}

export function getCardAltText(card: Card): string {
  if (card.rank === "JOKER") {
    return card.jokerColor === "red" ? "红色鬼牌" : "黑色鬼牌";
  }

  return `${SUIT_LABELS[card.suit]} ${card.rank}`;
}

export function getCardImage(card: Card): string | null {
  return getCardFaceImage(card);
}
