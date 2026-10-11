/**
 * Last-Write-Wins conflict resolution.
 * Compares timestamps to determine which update should prevail.
 */
export interface Timestamped {
  updatedAt: string;
}

export function isNewer(incoming: Timestamped, existing: Timestamped): boolean {
  return incoming.updatedAt > existing.updatedAt;
}

export function lwwResolve<T extends Timestamped>(incoming: T, existing: T): T {
  return isNewer(incoming, existing) ? incoming : existing;
}
