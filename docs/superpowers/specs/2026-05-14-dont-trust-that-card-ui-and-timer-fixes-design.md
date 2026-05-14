# Dont Trust That Card UI And Timer Fixes Design

Date: 2026-05-14
Status: proposed

## Goal

Fix the current playable build so that:

- visible playing cards use the repository PNG assets instead of text card labels
- player-facing UI text is fully Chinese
- the turn countdown display updates continuously instead of freezing
- turn timeout handling progresses the game reliably after the countdown expires
- additional functional and UI usability issues found in this pass are addressed when they are in scope for the same changes

## Confirmed Scope

This design covers the following areas only:

- functional issues that affect the flow of a round or match
- Chinese localization and UI readability issues in the existing frontend
- asset-backed card rendering for all visible card representations in the current UI
- targeted tests for the affected frontend and backend behaviors

Out of scope:

- a new dealing animation system
- broad visual redesign unrelated to the reported issues
- architecture cleanup that does not directly support these fixes
- changing the art on the card assets themselves

## Current Problems

The current codebase shows four confirmed issues and two smaller usability gaps.

### Confirmed Issues

1. `frontend/src/game/HandPanel.tsx` still falls back to text labels such as suit and rank values when image lookup fails, so the UI can show internal card strings instead of card art.
2. `frontend/src/game/GameTable.tsx`, `frontend/src/game/ActionBar.tsx`, `frontend/src/game/PlayerStrip.tsx`, and `frontend/src/App.tsx` still contain English labels or raw internal state values.
3. The countdown in `GameTable` is derived from `Date.now()` during render only. Because the component has no local ticking state, the number can appear frozen until another snapshot arrives.
4. The backend stores `turnEndsAtMs`, but there is no confirmed server-side scheduler that automatically calls timeout handling when a room deadline passes. This creates a risk that gameplay stops progressing after time expires.

### Additional Usability Gaps In Scope

1. The default nickname is still `Player01`, which breaks the all-Chinese interface expectation.
2. Some summary and status displays can surface blank or raw internal values instead of explicit Chinese labels.

## Design Summary

The recommended implementation is a focused repair pass with five parts:

1. add a single card presentation layer that resolves asset paths and standard fallback behavior
2. localize player-facing table, lobby, action, result, and status text through explicit Chinese mappings
3. make the countdown display client-driven with a one-second local refresh loop
4. make timeout resolution server-driven with periodic room deadline checks
5. add regression tests for timer refresh, timeout progression, and image-backed card rendering

This is intentionally narrower than a full table redesign and broader than a minimal text-only patch. It fixes the reported problems without introducing a separate animation state machine.

## Card Asset Presentation

### Requirement

Any UI element that represents a playing card in the current interface must use PNG assets from `Assets/`.

This includes:

- cards in the local hand
- card backs or placeholder card representations where a face should not be shown
- any existing table card representation that is currently rendered as a textual card label

### Asset Strategy

The frontend already has `frontend/src/lib/cardAssets.ts`, which maps shared `Card` values to PNG filenames under `Assets/PNG/Cards (small)/`.

This layer should be expanded or wrapped so that the UI can request:

- face image for a known card
- shared card back image
- neutral fallback image when a face image cannot be resolved

The fallback must never expose internal strings like `spades Q` to the player. If resolution fails, the UI should render a generic card back or neutral placeholder asset instead.

### UI Component Direction

The current hand rendering should move from inline conditional image logic toward a small reusable presentation component or helper contract. The design goal is not abstraction for its own sake. The goal is one place that defines:

- how a `Card` becomes an image path
- what alt text is used for accessibility
- what fallback image is shown
- whether the card is face-up or face-down

This keeps all visible card representations consistent and testable.

## Chinese Localization

### Requirement

All player-facing UI copy in the current app should be Chinese, except for text embedded in the shipped card art itself.

### Areas To Localize

- top table labels such as room, round, actor, and timer
- score and declaration labels
- action bar labels and buttons
- challenge result stamps
- player status labels
- default nickname
- any remaining mixed Chinese-English lobby copy

### Status Mapping

Internal enum values should stay in English in shared and backend logic, but the frontend should map them to readable Chinese strings. The UI must not render raw values such as:

- `active`
- `pending_win`
- `won`
- `left`

Instead it should render stable Chinese labels chosen for game readability.

## Countdown Display

### Root Cause

The current timer display computes remaining seconds from `timerEndsAtMs` but does not trigger rerenders every second, so the number can remain static between server snapshots.

### Design

`GameTable` should maintain lightweight local time state that updates once per second while a valid `timerEndsAtMs` is present.

Behavior rules:

- if `timerEndsAtMs` is `null`, display a Chinese equivalent of no timer
- if time remains, display whole remaining seconds in Chinese
- if the deadline has passed, clamp the display to `0` instead of negative values
- when a new snapshot arrives with a new deadline, the display should recompute from the new value without needing a hard refresh

The frontend remains display-only. It does not decide the legal timeout outcome.

## Timeout Progression

### Authority

Timeout outcomes must be decided on the server, not the client.

### Design

The backend should run a periodic deadline check over active rooms. When a room is in game phase and its `turnEndsAtMs` has passed:

- determine the current actor from authoritative room state
- call existing timeout resolution for that actor
- resync deadline state for the next turn if the game continues
- broadcast fresh snapshots

### Rules

Existing rules remain unchanged:

- opening turn timeout causes forfeit
- later turn timeout causes automatic skip

### Safety Requirements

The scheduler must avoid duplicate timeout handling for the same turn. The simplest acceptable design is to rely on the room state change itself: after timeout handling, the current actor or phase changes and a fresh deadline is set or cleared, so the same overdue state does not remain eligible on the next tick.

The scheduler must also ignore:

- rooms not in game phase
- rooms with `turnEndsAtMs === null`
- rooms that finish during timeout handling

## Additional In-Scope Fixes

These smaller issues should be fixed during the same pass because they directly affect the current user experience and are adjacent to the targeted files:

- replace the default nickname with a Chinese-friendly default
- ensure summary panels render explicit Chinese fallback text when placement or result lists are empty
- remove remaining mixed-language labels in action and results panels

## Testing Strategy

The implementation should follow test-first changes for the affected behavior.

### Frontend Tests

Add or update tests to cover:

1. the countdown display updates when local time advances
2. the key table and action labels render in Chinese
3. the hand prefers image rendering over textual card labels
4. card image fallback does not expose raw internal card strings

### Backend Tests

Add or update tests to cover:

1. opening turn timeout still forfeits the current actor
2. non-opening timeout skips the current actor and advances play
3. periodic timeout checking triggers handling when a room deadline has passed
4. finished or inactive rooms are ignored by timeout checking

## File Impact

Expected primary changes:

- `frontend/src/lib/cardAssets.ts`
- `frontend/src/game/HandPanel.tsx`
- `frontend/src/game/GameTable.tsx`
- `frontend/src/game/ActionBar.tsx`
- `frontend/src/game/PlayerStrip.tsx`
- `frontend/src/game/LobbyView.tsx`
- `frontend/src/App.tsx`
- `frontend/test/app.test.tsx`
- `backend/src/rooms/room.ts`
- `backend/src/rooms/store.ts`
- `backend/src/server.ts`
- `backend/test/room.test.ts`

If the timeout scheduler is placed in a new backend helper module, that is acceptable as long as the responsibility boundary stays clear.

## Risks And Tradeoffs

- Using asset-backed fallback images instead of text improves consistency but makes failures less obvious during manual QA. This is acceptable because test coverage should validate the mapping behavior.
- A client-driven display timer can still briefly differ from the backend by normal clock skew. This is acceptable because the backend remains authoritative for actual timeout resolution.
- Adding periodic timeout checks introduces background server work, but room counts and state size in this project are small enough that a simple interval-based approach is appropriate.

## Recommended Outcome

Implement the focused repair pass described above. It directly addresses the reported problems, fixes one additional gameplay risk already present in the code, and keeps the work bounded to functional correctness plus Chinese UI usability.
