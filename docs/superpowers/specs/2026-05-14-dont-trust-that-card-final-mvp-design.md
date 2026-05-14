# Dont Trust That Card Final MVP Technical Design

Date: 2026-05-14
Status: ready for review

## Goal

Build the final and only planned release of the online bluff card game for a small private player base:

- at most `20` concurrent online players
- multiple private rooms running in parallel
- each room supports `2-8` players
- desktop browser and mobile browser support
- single-server deployment on the current Ubuntu host

This document supersedes the earlier bootstrap design for actual implementation scope.

## Final Product Constraints

- no future expansion is assumed
- no account system
- no persistent database
- no reconnect flow
- no public matchmaking
- no spectator mode
- no bots
- no long-term match history

The server may restart and clear all rooms without recovery.

## Approaches Considered

### Approach A: React + Vite frontend, Fastify + Socket.IO backend, shared TypeScript rules

Pros:

- smallest moving parts for a realtime turn-based game
- easy to keep a server-authoritative reducer in one place
- low runtime overhead for a `2 vCPU / 2 GB RAM` machine
- clean fit for monorepo `frontend / backend / shared`

Cons:

- requires explicit event/schema discipline because there is no heavier backend framework doing it for us

### Approach B: Same frontend, NestJS + Socket.IO backend

Pros:

- stronger framework structure out of the box
- more built-in dependency injection and module conventions

Cons:

- more boilerplate than this project needs
- higher memory overhead for no practical MVP benefit

### Approach C: Full-stack SSR app such as Next.js with custom realtime layer

Pros:

- unified app shell and routing
- convenient when the product has lots of page-level server rendering needs

Cons:

- the game does not benefit enough from SSR
- heavier deployment and runtime model than necessary
- pushes gameplay concerns into a less focused app structure

## Chosen Architecture

Choose Approach A.

Final stack:

- frontend: `React + Vite + TypeScript`
- backend: `Node.js 22 LTS + Fastify + Socket.IO`
- shared: pure `TypeScript` package for rules, state, views, and event contracts
- reverse proxy: `Nginx`
- process manager: `PM2`

The current machine is suitable for a single-process backend with in-memory rooms at the target scale.

## Rule Baseline

The canonical rule document for implementation is now `docs/rules/game-rules-v0.8.md`.

Compared with the earlier `v0.7` baseline, the authoritative rule changes are:

- player count changes from `3-6` to `2-8`
- `2-4` players use one `54`-card deck
- `5-8` players use two complete `54`-card decks
- duplicate face cards may exist in the same game and must be tracked as different physical cards

All other core round logic remains the same.

## Runtime Model

The backend is the only source of truth for:

- room membership
- seat order
- player readiness
- current host
- chosen timer setting
- deck composition and shuffle order
- private hands
- table pile contents
- latest played hand and challenge target
- timeout resolution
- disconnect and voluntary-exit handling
- chat history

Clients receive:

- their own hand
- the public room snapshot
- recent chat messages
- recent system/game events rendered into chat
- legal actions for the current player

## Room Model

Each active room has the following properties:

- private room identified by a unique `6`-character uppercase alphanumeric room code
- code may be auto-generated or manually customized by the host before game start
- hard cap of `8` players
- no spectators
- no joining after a game has started
- room is destroyed immediately when the last player leaves

Multiple rooms may exist at once, but the entire service only needs to support about `20` concurrent online players.

## Player Identity And Naming

- users join as guests
- nickname rule: `2-12` characters, Chinese characters plus English letters and digits only
- room-local duplicate names are allowed, but the server auto-suffixes them, for example `Alex#2`
- each joined player receives a server-generated ephemeral `playerId`
- no identity is persisted across refreshes or reconnects

## Lobby Rules

- seats are assigned automatically by join order
- host is the room creator
- if the host leaves, host ownership transfers to the earliest still-online player by join order
- all current room players must be in `ready` state before the host can start the game
- start is host-manual only; there is no auto-start rule

## Lobby Settings

The room exposes one gameplay setting in MVP:

- turn timer options: `15 / 20 / 30 / 45 / 60` seconds

Setting rules:

- only the host can edit the timer
- the timer can be changed only before the game starts
- changing the timer does not clear ready states
- joining or leaving also does not clear the ready state of remaining players
- newly joined players always start as `not_ready`

This keeps the lobby simple and matches the requested "do not reset ready" behavior.

## Match Lifecycle

Room phase flow:

1. `lobby`
2. `starting`
3. `in_game`
4. `game_over`
5. back to `lobby`

Detailed rules:

- a game starts with the exact set of players currently in the room
- since all room players must be ready, there is no bench population inside a room at game start
- after `game_over`, the room remains open
- new players may join only after the room returns to `lobby`
- the next game again requires all current room players to ready up

## Deck And Card Identity

For `2-4` players:

- use one `54`-card deck

For `5-8` players:

- use two full `54`-card decks
- represent each physical card with a stable unique id such as `d1-hearts-A-0` or `d2-joker-red-0`

Frontend display rule:

- identical face cards are rendered as separate cards without special grouping or deck markers

Backend requirement:

- all reducer actions must address cards by unique physical card id, never by face value alone

## Turn Timer And Timeout Rules

The timer is per-player turn.

Default timeout handling:

- if a non-starter times out on their turn, the backend auto-applies `skip`
- if the round starter times out before making the mandatory opening play, that player immediately forfeits and leaves the game

This preserves the requested "timeout auto-skip" flow while handling the special case where the starter is not allowed to skip.

## Disconnect And Voluntary Exit Rules

There is no reconnect path in MVP.

Lobby behavior:

- a player may leave freely
- leaving removes them from the room immediately

In-game behavior:

- closing the page, losing the socket, or actively pressing leave all count as a forfeit
- forfeiting players are removed from the active game immediately
- forfeited players are shown as `left` rather than as normal winners
- if only one non-forfeited player remains, the game ends immediately
- if two or more active players remain, the game continues

Reducer-specific handling for an in-game forfeit:

- the player is removed from turn rotation
- all cards still in that player's hand are removed from play
- if the player was the current actor, turn advances to the next active player
- if the player was the current `shangjia`, the current round is canceled, the table pile is cleared, and the next round starter becomes the next active player in seat order

This rule is intentionally operational rather than simulation-perfect; it keeps the game consistent under the chosen no-reconnect constraint.

## Chat And Event Feed

Each room has one text chat stream used for both player messages and system/game events.

Chat rules:

- plain text only
- keep the most recent `100` messages in memory
- no images, emoji packs, or file attachments

System messages written into the same feed include:

- player join/leave
- host transfer
- ready/unready
- game start/end
- timeout auto-skip
- timeout forfeit
- challenge results
- round-end summaries

There is no separate match log panel in MVP.

## Public And Private Game Views

### Private To The Acting Player

- their own hand card ids and card faces
- whether a selected set of cards forms a legal play count

### Public To Everyone In The Room

- room code
- host
- seat order
- ready state in lobby
- room phase
- configured timer
- current actor
- current `shangjia`
- current declared rank
- latest declared count
- table pile size
- active players
- `pending_win` players
- winners in order
- players who left by forfeit

## Frontend Scope

The client is a single-page app with these views:

- entry screen for create room / join room
- lobby screen
- in-game table screen
- game-over summary inside the room

### Lobby Screen

- nickname input
- room code display and edit affordance for host
- player list in join order
- ready button for non-host players
- ready toggle for host as a normal player
- timer selector for host
- start button for host, enabled only when all current players are ready and player count is `2-8`
- chat panel

### In-Game Screen

- current declared rank
- current actor highlight
- current `shangjia`
- latest declared count
- table pile size
- visible player states
- local hand panel
- actions: `challenge`, `play`, `skip`
- countdown clock
- shared chat/event feed

### Responsive Requirement

- support desktop and mobile browsers
- mobile support is horizontal-landscape only
- portrait mode may show a rotate-device prompt instead of the full table UI

### Language And Assets

- language: Simplified Chinese only
- use the existing card art under `Assets/`

## Backend Modules

Recommended backend module split:

- `server/`: Fastify bootstrap, health route, static hosting hook or reverse-proxy integration
- `rooms/`: room registry and room lifecycle
- `game/`: authoritative orchestration layer around the reducer
- `socket/`: Socket.IO event binding and per-socket session handling
- `chat/`: chat append, trimming, and broadcast formatting

## Shared Package Modules

Recommended shared package split:

- `cards.ts`: rank/suit/joker types and deck builders
- `state.ts`: full authoritative game state types
- `reducer.ts`: pure transition functions
- `view.ts`: public snapshot and player-private snapshot builders
- `events.ts`: socket payload contracts
- `errors.ts`: structured rule and action errors

## Socket Event Contract

The MVP can use a single Socket.IO connection per browser tab.

Client-to-server events:

- `room:create`
- `room:join`
- `room:leave`
- `room:setCode`
- `room:setTimer`
- `room:setReady`
- `room:start`
- `game:play`
- `game:skip`
- `game:challenge`
- `chat:send`

Server-to-client events:

- `room:snapshot`
- `game:snapshot`
- `chat:message`
- `system:message`
- `action:error`

Implementation note:

- `room:snapshot` is used in lobby and after game-over
- `game:snapshot` is used during active gameplay
- both should contain monotonically increasing version numbers so the client can discard stale updates

## Validation Rules

The backend rejects:

- malformed nickname or room code input
- room join when phase is not `lobby`
- room join when room is full
- room code edits by non-hosts
- timer edits after game start
- start attempts when not all players are ready
- start attempts with player count outside `2-8`
- actions from non-current actors
- illegal play counts
- plays whose declared count does not match actual selected cards
- challenges when there is no valid `shangjia`

Errors are non-fatal and followed by a fresh authoritative snapshot.

## Testing Scope

The required MVP test coverage is:

1. shared reducer tests for round logic
2. backend room/game service tests for lobby, timeout, disconnect, and host transfer flows
3. one frontend smoke test covering the main table actions being rendered

Priority scenarios:

- `2`-player single-deck game start
- `8`-player double-deck game start
- duplicate face cards remain distinct by id
- all-ready gate before host start
- timer change before start only
- starter timeout causes forfeit
- non-starter timeout causes auto-skip
- in-game leave behaves like disconnect forfeit
- `shangjia` disconnect cancels the current round cleanly
- room destroyed when empty

## Deployment

Deployment target:

- one Ubuntu server
- one Node.js backend process managed by `PM2`
- `Nginx` serving the frontend build and reverse-proxying Socket.IO plus backend routes
- domain and `HTTPS` required

Operational notes:

- standardize on `Node.js 22 LTS`
- use one environment file for runtime values such as port and public base URL
- no database migrations are needed
- service restart clears all rooms and matches

## Non-Goals

These are explicitly out of scope:

- matchmaking lobby across public users
- persistent rankings or stats
- replay system
- observer mode
- moderation tooling
- audio chat
- animation-heavy polish
- recovery after server restart

## Implementation Summary

The system should be built as a small, strict, server-authoritative realtime web app:

- multiple private `2-8` player rooms
- single or double deck based on actual starting player count
- no reconnect and no persistence
- chat merged with system/game events
- single-server deployment with `Nginx + PM2`

This is the smallest architecture that still cleanly supports the requested final feature set.
