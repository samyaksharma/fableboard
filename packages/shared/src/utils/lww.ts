/**
 * Last-Write-Wins conflict resolution.
 * Compares timestamps to determine which update should prevail.
 */
export interface Timestamped {
  updatedAt: string;
}

/**
 * Returns true if `incoming` is newer than `existing`.
 */
export function isNewer(incoming: Timestamped, existing: Timestamped): boolean {
  return incoming.updatedAt > existing.updatedAt;
}

/**
 * Resolves conflict between two versions of the same entity.
 * Returns the version with the later timestamp.
 */
export function lwwResolve<T extends Timestamped>(incoming: T, existing: T): T {
  return isNewer(incoming, existing) ? incoming : existing;
}
