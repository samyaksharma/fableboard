import { z } from 'zod';

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const sizeSchema = z.object({
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
});

export const elementStyleSchema = z.object({
  fill: z.string(),
  stroke: z.string(),
  strokeWidth: z.number().nonnegative(),
  opacity: z.number().min(0).max(1),
});

export const canvasElementTypeSchema = z.enum([
  'path',
  'rect',
  'circle',
  'triangle',
  'sticky_note',
  'line',
  'arrow',
  'text',
]);

export const roleSchema = z.enum(['owner', 'editor', 'viewer']);

export const kanbanColumnSchema = z.enum(['todo', 'in_progress', 'done']);

export const canvasElementSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: canvasElementTypeSchema,
  position: positionSchema,
  size: sizeSchema,
  content: z.string(),
  textVersion: z.number().int().nonnegative().optional(),
  style: elementStyleSchema,
  fabricData: z.record(z.unknown()),
  createdBy: z.string(),
  updatedAt: z.string(),
});

export const kanbanCardSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sourceElementId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  assignee: z.string(),
  column: kanbanColumnSchema,
  order: z.number(),
  snapshot: z.string().startsWith('data:image/').optional(),
  updatedAt: z.string(),
});

export const authProviderSchema = z.enum(['github', 'google', 'guest', 'password']);

export const userSchema = z.object({
  id: z.string(),
  email: z.union([z.string().email(), z.literal('')]), // guests have no email
  displayName: z.string().min(1).max(100),
  avatarUrl: z.string(),
  provider: authProviderSchema,
  providerId: z.string(),
  createdAt: z.string(),
});

export const participantSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1).max(50),
  color: z.string(),
  role: roleSchema,
  sessionId: z.string(),
  userId: z.string().optional(),
});

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  ownerId: z.string(),
  createdAt: z.string(),
  permissionsPolicy: z.object({
    defaultRole: roleSchema,
  }),
});

export const drawStrokeSchema = z.object({
  elementId: z.string(),
  sessionId: z.string(),
  fabricData: z.record(z.unknown()),
  updatedAt: z.string(),
});

export const addElementSchema = z.object({
  element: canvasElementSchema,
});

export const moveElementSchema = z.object({
  elementId: z.string(),
  sessionId: z.string(),
  position: positionSchema,
  fabricData: z.record(z.unknown()),
  updatedAt: z.string(),
});

export const deleteElementSchema = z.object({
  elementId: z.string(),
  sessionId: z.string(),
});

export const cursorMoveSchema = z.object({
  sessionId: z.string(),
  cursor: z.object({
    participantId: z.string(),
    x: z.number(),
    y: z.number(),
    displayName: z.string(),
    color: z.string(),
  }),
});

export const updateElementSchema = z.object({
  elementId: z.string(),
  sessionId: z.string(),
  fabricData: z.record(z.unknown()),
  updatedAt: z.string(),
});

export const createSessionSchema = z.object({
  title: z.string().min(1).max(100),
  ownerName: z.string().min(1).max(50),
});

export const joinSessionSchema = z.object({
  sessionId: z.string(),
  participant: participantSchema,
});

// Email + password sign-in. Bounds on password length also cap hashing work.
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z.string().trim().min(1, 'Enter a display name').max(40),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});
