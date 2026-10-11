# FABLEBOARD — PRODUCT REQUIREMENTS DOCUMENT
Version: 1.0 MVP | March 2026

## OVERVIEW
Realtime collaborative whiteboard that converts sketches/notes into kanban tasks.
Tagline: Sketch it. Sync it. Ship it.

## PROBLEM
Whiteboards (Miro) and task managers (Jira) are siloed. The handoff is manual and lossy.
Fableboard eliminates the gap: draw → drag → task. No context switching.

## TECH STACK
- Frontend: React 18, TypeScript, Fabric.js, Tailwind CSS
- Realtime: Socket.IO (WebSocket)
- Backend: Node.js (Express) or Go (Gin)
- State/PubSub: Redis
- Persistence: PostgreSQL (optional for MVP)
- Export: html2canvas + jsPDF, JSON.stringify
- Deploy: Docker Compose local, Railway/Fly.io for demo

## MVP FEATURES
1. Shared canvas — freehand drawing, shapes, sticky notes
2. Realtime sync — WebSocket events, cursor presence, reconnect replay
3. Drag-to-kanban — drag any canvas element into kanban columns (To Do / In Progress / Done)
4. Permissions — Owner / Editor / Viewer roles
5. Export — PDF (canvas + board) and JSON

## DATA MODELS
Session: id, title, owner_id, created_at, permissions_policy
CanvasElement: id, session_id, type, position {x,y}, size {w,h}, content, style, created_by, updated_at
KanbanCard: id, session_id, source_element_id, title, description, assignee, column, order, updated_at
Participant: id, display_name, color, role, session_id

## WEBSOCKET EVENTS
draw_stroke | add_element | move_element | delete_element | cursor_move

## CONFLICT RESOLUTION
- Element positions: Last-Write-Wins (LWW)
- Sticky note text: Operational Transform (OT), character-level diff/patch
- Kanban cards: LWW with optimistic UI, server authoritative on conflict

## PERMISSIONS
Viewer: view only
Editor: draw, add notes, move elements, create cards
Owner: all editor actions + export, manage users, delete session

## TESTING REQUIREMENTS
- Unit: OT merge/patch logic, LWW resolution, card state transitions, JSON schema
- Integration: multi-client sync, reconnect/replay, drag-to-kanban broadcast
- E2E: two browser sessions draw+sync, export flow

## OUT OF SCOPE (POST-MVP)
AI sketch detection, Jira/Asana integrations, voice/video, mobile apps,
OAuth, version history, per-element permissions

## RESUME BULLET
Implemented Fableboard, a realtime collaborative whiteboard with live sync and
sketch-to-task extraction (React, WebSockets, Redis) enabling multi-user editing,
drag-to-kanban conversion, and export — with OT conflict resolution and integration tests.