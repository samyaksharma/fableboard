import type { OTOp } from '../utils/ot.js';
export type AuthProvider = 'github' | 'google' | 'guest' | 'password';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  provider: AuthProvider;
  providerId: string;
  createdAt: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  provider: AuthProvider;
}

export interface Session {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  permissionsPolicy: PermissionsPolicy;
}

export type Role = 'owner' | 'editor' | 'viewer';

export interface PermissionsPolicy {
  defaultRole: Role;
}

export interface Participant {
  id: string;
  displayName: string;
  color: string;
  role: Role;
  sessionId: string;
  userId?: string;
}

export type CanvasElementType =
  | 'path'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'sticky_note'
  | 'text';

export interface CanvasElement {
  id: string;
  sessionId: string;
  type: CanvasElementType;
  position: { x: number; y: number };
  size: { w: number; h: number };
  content: string;
  /** OT version of `content` (sticky notes) */
  textVersion?: number;
  style: ElementStyle;
  fabricData: Record<string, unknown>;
  createdBy: string;
  updatedAt: string;
}

export interface ElementStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export type KanbanColumn = 'todo' | 'in_progress' | 'done';

export interface KanbanCard {
  id: string;
  sessionId: string;
  sourceElementId: string | null;
  title: string;
  description: string;
  assignee: string;
  column: KanbanColumn;
  order: number;
  snapshot?: string;
  updatedAt: string;
}

export interface CursorPosition {
  participantId: string;
  x: number;
  y: number;
  displayName: string;
  color: string;
}

export interface DrawStrokePayload {
  elementId: string;
  sessionId: string;
  fabricData: Record<string, unknown>;
  updatedAt: string;
}

export interface AddElementPayload {
  element: CanvasElement;
}

export interface MoveElementPayload {
  elementId: string;
  sessionId: string;
  position: { x: number; y: number };
  fabricData: Record<string, unknown>;
  updatedAt: string;
}

export interface DeleteElementPayload {
  elementId: string;
  sessionId: string;
}

export interface CursorMovePayload {
  sessionId: string;
  cursor: CursorPosition;
}

export interface UpdateElementPayload {
  elementId: string;
  sessionId: string;
  fabricData: Record<string, unknown>;
  updatedAt: string;
}

export interface TextOpPayload {
  elementId: string;
  sessionId: string;
  baseVersion: number;
  ops: OTOp[];
}

/** Server -> clients. `ops` is already transformed and ordered at `version`. */
export interface TextOpBroadcast {
  elementId: string;
  ops: OTOp[];
  version: number;
}

export interface TextAckPayload {
  elementId: string;
  version: number;
}

export interface TextResyncPayload {
  elementId: string;
  text: string;
  version: number;
}

export interface KanbanAddCardPayload {
  card: KanbanCard;
}

export interface KanbanMoveCardPayload {
  cardId: string;
  sessionId: string;
  column: KanbanColumn;
  order: number;
  updatedAt: string;
}

export interface KanbanUpdateCardPayload {
  cardId: string;
  sessionId: string;
  title?: string;
  description?: string;
  assignee?: string;
  updatedAt: string;
}

export interface KanbanDeleteCardPayload {
  cardId: string;
  sessionId: string;
}

export interface JoinSessionPayload {
  sessionId: string;
  participant: Participant;
}

export interface SessionStatePayload {
  session: Session;
  elements: CanvasElement[];
  cards: KanbanCard[];
  participants: Participant[];
}
