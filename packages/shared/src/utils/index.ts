import { nanoid } from 'nanoid';

export function generateId(size = 12): string {
  return nanoid(size);
}

const PARTICIPANT_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
];

export function getParticipantColor(index: number): string {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

export function nowISO(): string {
  return new Date().toISOString();
}
