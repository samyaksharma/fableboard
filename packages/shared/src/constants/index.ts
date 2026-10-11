export const SocketEvents = {
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  SESSION_STATE: 'session_state',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  PARTICIPANT_UPDATED: 'participant_updated',
  SESSION_DELETED: 'session_deleted',

  DRAW_STROKE: 'draw_stroke',
  ADD_ELEMENT: 'add_element',
  MOVE_ELEMENT: 'move_element',
  UPDATE_ELEMENT: 'update_element',
  DELETE_ELEMENT: 'delete_element',
  TEXT_OP: 'text_op',
  TEXT_ACK: 'text_ack',
  TEXT_RESYNC: 'text_resync',

  CURSOR_MOVE: 'cursor_move',

  KANBAN_ADD_CARD: 'kanban_add_card',
  KANBAN_MOVE_CARD: 'kanban_move_card',
  KANBAN_UPDATE_CARD: 'kanban_update_card',
  KANBAN_DELETE_CARD: 'kanban_delete_card',

  ERROR: 'error',
} as const;

export const Roles = {
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export const KanbanColumns = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
} as const;

export const KANBAN_COLUMN_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export const KANBAN_COLUMN_ORDER = ['todo', 'in_progress', 'done'] as const;

export const DEFAULT_COLORS = {
  STICKY_BG: '#fef08a',
  STICKY_TEXT: '#1e293b',
  STROKE: '#1e293b',
  FILL: 'transparent',
} as const;

export const CANVAS_DEFAULTS = {
  BRUSH_WIDTH: 3,
  STROKE_WIDTH: 2,
  STICKY_WIDTH: 200,
  STICKY_HEIGHT: 150,
  STICKY_FONT_SIZE: 16,
  SHAPE_SIZE: 80,
} as const;

export const AUTH_PROVIDERS = {
  GITHUB: 'github',
  GOOGLE: 'google',
} as const;
