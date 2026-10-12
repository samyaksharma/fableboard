# Fableboard

**Sketch it. Sync it. Ship it.**

A realtime collaborative whiteboard that turns sketches into kanban tasks. Draw, drop a
sticky note, drag it into a column: the handoff from whiteboard to task list is one gesture.

## Features

| | |
|---|---|
| **Shared canvas** | Freehand drawing, lines, arrows, rectangles, circles, triangles, sticky notes, and an eraser. Everything is synced live. |
| **Undo / redo** | Per-user history (Ctrl+Z, Ctrl+Shift+Z) for adding, moving and deleting; changes replay as normal edits so everyone stays in sync. |
| **Sessions menu** | Switch between your boards or go back to the start screen from the Fableboard menu. |
| **Realtime collaboration** | Presence, live cursors, late-join and reconnect replay of the full board. |
| **Drag-to-kanban** | Drag any element into To Do / In Progress / Done. It becomes a card (sticky text becomes the title) and leaves the canvas for everyone. |
| **Conflict resolution** | Sticky text: operational transform. Element positions: last-write-wins. Kanban cards: LWW with the server authoritative. |
| **Roles** | Owner / Editor / Viewer, changeable live. Viewers are read-only in the UI *and* rejected by the server. |
| **Export** | PDF (canvas page + kanban page) and JSON. |
| **Accounts** | Email + password (scrypt-hashed, stored in Convex), optional GitHub/Google, or guest. Returning users keep their role on a board. |
| **Persistence** | Convex. Sessions survive server restarts and expire after 7 days. |

## Architecture

```
 Browser (React + Fabric.js)                Node (Express + Socket.IO)               Convex
┌────────────────────────────┐   WebSocket  ┌───────────────────────────┐  HTTP   ┌──────────────┐
│ canvas ── useCanvasSync ───┼─────────────▶│ canvasHandler  (LWW)      │         │ sessions     │
│ sticky ── useStickyText ───┼─ text_op ───▶│   OTServerDoc (OT)        │ write-  │ participants │
│ kanban ── useKanban ───────┼─────────────▶│ kanbanHandler (authority) │ through │ elements     │
│ zustand stores             │◀─ broadcast ─┤ sessionHandler (replay)   ├────────▶│ cards, users │
└────────────────────────────┘              │ in-memory hot cache       │         └──────────────┘
                                            └───────────────────────────┘
```

- **`packages/shared`**: types, constants, zod validators, and the OT engine (`ot.ts`, `otSession.ts`) used by both sides.
- **`packages/server`**: REST (auth, sessions) + Socket.IO. State lives in memory and is written through to Convex (debounced); a session loads lazily from Convex after a restart.
- **`packages/client`**: React 18, Fabric.js, Tailwind, Zustand.
- **`convex/`**: schema and server-only functions, guarded by a shared secret.

### How sticky-note text stays consistent

Each note is an OT document. A client keeps at most one batch in flight and buffers further
edits; the server transforms an incoming batch against everything that happened since its
base version, applies it, bumps the version, acks the sender, and broadcasts to the rest.
Remote edits are transformed against the local in-flight and buffered ops, and the caret is
shifted through them. Convergence is property-tested with randomized concurrent edits.

## Getting started

Prerequisites: Node 18+ and pnpm 8+.

```bash
pnpm install
cp .env.example .env     # then fill in the values below
pnpm build:shared
pnpm dev                 # client :5173, server :3001
```

Open http://localhost:5173, enter a display name, create a session, and share the session ID
with a second browser window.

### Persistence (optional)

Without Convex the server runs fully in memory, so everything works but nothing survives a restart.
To enable persistence:

```bash
npx convex dev                                         # links a deployment, writes .env.local
npx convex env set CONVEX_SERVER_SECRET "<random string>"
# put the same value in .env as CONVEX_SERVER_SECRET
```

`CONVEX_URL` is picked up from `.env.local`.

### Sign-in

| Method | Setup |
|---|---|
| Email + password | Works out of the box. Passwords are hashed with scrypt; only the hash is stored. Without Convex, accounts live in memory. |
| Guest | Works out of the box. The quickest way in; use an account to keep your boards across devices. |
| GitHub / Google | Set `GITHUB_CLIENT_ID/SECRET` or `GOOGLE_CLIENT_ID/SECRET`. The buttons only appear when configured. The redirect URI is `<SERVER_URL>/api/auth/<provider>/callback`. |

Set a strong random `JWT_SECRET` for any deployed environment.

## Tests

```bash
pnpm test        # unit + integration (shared, client store, server sockets)
pnpm test:e2e    # two real browsers against the real stack (needs Playwright's Chromium)
pnpm demo        # records a local walkthrough video into docs/ (git-ignored)
```

| Layer | What it covers |
|---|---|
| Unit (`packages/shared`) | OT apply/transform/convergence (500 randomized cases), OT client/server sessions, LWW, schemas |
| Unit (`packages/client`) | Kanban card state transitions |
| Integration (`packages/server`) | Multi-client sync, late-join replay, drag-to-kanban broadcast, LWW and card conflicts, OT through real sockets, viewer rejection; auth: hashing, register/login, duplicate and generic errors, lockout, rate limit |
| E2E (`e2e/`) | Draw + sync between two browsers, concurrent sticky editing, drag-to-kanban, live role change, board snapshots, accounts, eraser, undo/redo, lines and arrows, switching sessions, JSON and 2-page PDF export |

First-time E2E setup: `pnpm exec playwright install chromium`. On a minimal Linux/WSL image
you may also need Chromium's system libraries (`libnspr4`, `libnss3`, `libasound2`).
The E2E run starts its own server and client and uses the in-memory store, so it never touches Convex.

## Permissions

| Action | Viewer | Editor | Owner |
|---|:-:|:-:|:-:|
| View board, cursors, kanban | ✓ | ✓ | ✓ |
| Draw, shapes, sticky notes, move, delete | | ✓ | ✓ |
| Create / move / edit cards | | ✓ | ✓ |
| Export | | | ✓ |
| Change roles, delete session | | | ✓ |

New participants join as editors.

## Stack

React 18 · TypeScript · Fabric.js · Tailwind · Zustand · Socket.IO · Express · Convex · zod · html2canvas + jsPDF · Playwright

---

*Implemented Fableboard, a realtime collaborative whiteboard with live sync and sketch-to-task
extraction (React, WebSockets, Convex), enabling multi-user editing, drag-to-kanban conversion,
and export, with OT conflict resolution and integration + E2E tests.*
