# Dont Trust That Card Multiplayer Game Design

Date: 2026-05-14
Status: approved for repository bootstrap

## Goal

Build an online multiplayer bluff card game that preserves the approved round structure:

- one declared rank per round
- latest real player is the current challenge target
- a player can challenge, play, or skip on their turn
- a player who empties their hand enters pending victory and only wins after their play survives
- winners leave the table and the remaining players continue for placement

## Scope

This design covers the MVP foundation only:

- repository bootstrap
- formal game rules
- recommended architecture
- state-model boundaries
- implementation plan handoff

Out of scope for this bootstrap:

- authentication
- bots
- voice chat
- cosmetics
- ranked matchmaking
- production deployment automation

## Rules Reference

The canonical rule document lives at `docs/rules/game-rules-v0.7.md`.

Important behavior that the backend state machine must treat as authoritative:

1. The declared card count must equal the number of cards actually played.
2. Only the declared rank may be false.
3. `Shangjia` means the latest player who actually played cards.
4. A skip does not replace the current `shangjia`.
5. A challenge only checks the latest played hand, but the challenge loser takes the full table pile.
6. A round can continue across multiple seat loops until a challenge occurs or a played hand survives a full orbit of skips.
7. A player who reaches zero cards becomes `pending_win`, not `won`, until the rules say the hand has survived.

## Recommended Architecture

The repository bootstrap stays framework-light, but the recommended MVP stack is:

- frontend: React + Vite + TypeScript
- backend: Node.js + TypeScript + Fastify + Socket.IO
- shared: TypeScript package for card models, event types, and pure state transitions

Reasoning:

- the game is turn-based but realtime, so a WebSocket channel is simpler than polling
- the rule set is strict and stateful, so a server-authoritative reducer is safer than duplicating logic across clients
- a shared TypeScript package keeps the wire protocol and the backend reducer aligned

## Server Authority Model

The backend should be the only source of truth for:

- full deck order
- player hands
- table pile contents
- the latest played hand
- pending-victory transitions
- legal actions for the current actor
- placement order

Clients should only receive:

- their own hand
- public seat order and player statuses
- current actor
- current round rank
- current `shangjia`
- last declared count
- total table pile size
- event log entries needed for UX

## Core State Model

The MVP should split state into a few focused units.

### Card Model

Represent cards with stable ids and enough metadata to support validation:

- `id`
- `rank`
- `suit`
- `isJoker`

### Player State

Each player record should contain:

- `playerId`
- `displayName`
- `seatIndex`
- `status`: `active`, `pending_win`, or `won`
- `hand`: server-only array of card ids

### Round State

Each round needs:

- `starterPlayerId`
- `declaredRank`
- `currentActorPlayerId`
- `shangjiaPlayerId`
- `lastPlayedHand`
- `skippedPlayerIdsSinceLastPlay`

### Table Pile

Track:

- full list of face-down cards currently on the table
- enough metadata to identify which subset belongs to the latest played hand

### Game State

Track:

- room id
- deck state
- player order
- active round state
- placement list
- game phase: lobby, in_round, resolving, finished

## Turn Flow

The reducer should model the following transitions:

1. `start_game`
2. `start_round`
3. `play_cards`
4. `skip_turn`
5. `challenge_last_play`
6. `resolve_challenge`
7. `resolve_uncontested_pass`
8. `mark_player_won`
9. `advance_to_next_round`
10. `finish_game`

The important rule nuance is that `skip_turn` does not advance the challenge target. Only `play_cards` changes `shangjia`.

## Frontend MVP

The first playable client should include:

- lobby view
- room player list
- table center with current declared rank and pile size
- visible turn indicator
- hand view for the local player
- three explicit actions on turn: challenge, play, skip
- reveal panel for challenge resolution
- placement panel for players who have already won

The UI does not need rich animation in the first implementation, but it must make the current actor, current `shangjia`, and legal actions impossible to misread.

## Error Handling

The backend should reject:

- actions from non-current actors
- challenge attempts when there is no valid current `shangjia`
- challenge attempts against older hands
- plays with a declared count that does not match actual cards
- plays with zero cards or more than four cards
- plays from players already marked `won`

The frontend should surface these rejections as non-fatal room errors and then resync from the latest authoritative state snapshot.

## Testing Strategy

The first implementation should emphasize reducer-level tests over UI tests.

Priority test areas:

1. first play locks round rank
2. skip does not change `shangjia`
3. new play replaces `shangjia`
4. challenge only validates the latest played hand
5. challenge loser takes the whole table pile
6. no-challenge orbit ends the round and clears the pile
7. `pending_win` converts to `won` only on a safe transition
8. next starter selection respects win-and-leave ordering

## Bootstrap Repository Layout

The initialized repository uses:

- `frontend/`
- `backend/`
- `shared/`
- `docs/rules/`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `Assets/`

This keeps the project ready for a client/server split without forcing dependency installation yet.

