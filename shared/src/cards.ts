export const STANDARD_RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K"
] as const;

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export const TIMER_OPTIONS = [15, 20, 30, 45, 60] as const;

export type Rank = (typeof STANDARD_RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type TimerOption = (typeof TIMER_OPTIONS)[number];

export type Card = {
  id: string;
  rank: Rank | "JOKER";
  suit: Suit | "joker";
  deckIndex: 1 | 2;
  jokerColor?: "black" | "red";
};

export function createCardId(
  deckIndex: 1 | 2,
  suit: Suit | "joker",
  rank: Rank | "JOKER",
  variant: string
): string {
  return `d${deckIndex}-${suit}-${rank}-${variant}`;
}

export function createDeck(deckIndex: 1 | 2): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of STANDARD_RANKS) {
      cards.push({
        id: createCardId(deckIndex, suit, rank, "0"),
        rank,
        suit,
        deckIndex
      });
    }
  }

  cards.push({
    id: createCardId(deckIndex, "joker", "JOKER", "black"),
    rank: "JOKER",
    suit: "joker",
    deckIndex,
    jokerColor: "black"
  });

  cards.push({
    id: createCardId(deckIndex, "joker", "JOKER", "red"),
    rank: "JOKER",
    suit: "joker",
    deckIndex,
    jokerColor: "red"
  });

  return cards;
}

export function getDeckCountForPlayers(playerCount: number): 1 | 2 {
  if (playerCount < 2 || playerCount > 8) {
    throw new Error("player count must be between 2 and 8");
  }

  return playerCount <= 4 ? 1 : 2;
}

export function createShuffledDeck(
  playerCount: number,
  rng: () => number = Math.random
): Card[] {
  const deckCount = getDeckCountForPlayers(playerCount);
  const cards =
    deckCount === 1 ? createDeck(1) : [...createDeck(1), ...createDeck(2)];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = cards[index];
    cards[index] = cards[swapIndex];
    cards[swapIndex] = current;
  }

  return cards;
}

export function isDeclaredRank(value: string): value is Rank {
  return STANDARD_RANKS.includes(value as Rank);
}
