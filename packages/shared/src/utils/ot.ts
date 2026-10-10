/**
 * Operational Transform primitives for text editing (sticky notes).
 * Character-level insert/delete operations.
 */

export type OTOp =
  | { type: 'insert'; pos: number; chars: string }
  | { type: 'delete'; pos: number; count: number };

/**
 * Apply an operation to a string.
 */
export function applyOperation(text: string, op: OTOp): string {
  switch (op.type) {
    case 'insert':
      return text.slice(0, op.pos) + op.chars + text.slice(op.pos);
    case 'delete':
      return text.slice(0, op.pos) + text.slice(op.pos + op.count);
  }
}

/**
 * Transform `op` so it can be applied after `base`, where both were made against
 * the same document. Returns a list because a delete that straddles an insert
 * must be split in two. `opWins` breaks insert/insert ties at the same position
 * (the winner's text ends up first); both sides must agree on who wins.
 */
export function transformOperation(base: OTOp, op: OTOp, opWins: boolean): OTOp[] {
  if (base.type === 'insert' && op.type === 'insert') {
    if (op.pos < base.pos || (op.pos === base.pos && opWins)) return [op];
    return [{ ...op, pos: op.pos + base.chars.length }];
  }

  if (base.type === 'insert' && op.type === 'delete') {
    const len = base.chars.length;
    if (base.pos <= op.pos) return [{ ...op, pos: op.pos + len }];
    if (base.pos >= op.pos + op.count) return [op];
    // Insert lands inside the deleted range: delete around it, keep the inserted text.
    const head = base.pos - op.pos;
    return [
      { type: 'delete', pos: op.pos, count: head },
      { type: 'delete', pos: op.pos + len, count: op.count - head },
    ];
  }

  if (base.type === 'delete' && op.type === 'insert') {
    if (op.pos <= base.pos) return [op];
    if (op.pos >= base.pos + base.count) return [{ ...op, pos: op.pos - base.count }];
    return [{ ...op, pos: base.pos }]; // insert inside deleted range
  }

  // delete vs delete
  if (base.type !== 'delete' || op.type !== 'delete') return [op];
  if (op.pos >= base.pos + base.count) return [{ ...op, pos: op.pos - base.count }];
  if (op.pos + op.count <= base.pos) return [op];
  const overlap =
    Math.min(op.pos + op.count, base.pos + base.count) - Math.max(op.pos, base.pos);
  const count = op.count - overlap;
  if (count === 0) return [];
  return [{ type: 'delete', pos: Math.min(op.pos, base.pos), count }];
}

/**
 * Transform two concurrent op sequences against each other.
 * Returns [a', b'] where a' applies after b and b' applies after a.
 * `aWins` decides insert/insert ties in favour of `a`.
 */
export function transformOps(a: OTOp[], b: OTOp[], aWins: boolean): [OTOp[], OTOp[]] {
  if (a.length === 0 || b.length === 0) return [a, b];
  if (a.length === 1 && b.length === 1) {
    return [
      transformOperation(b[0], a[0], aWins),
      transformOperation(a[0], b[0], !aWins),
    ];
  }
  if (a.length > 1) {
    const [a1, b1] = transformOps([a[0]], b, aWins);
    const [aRest, b2] = transformOps(a.slice(1), b1, aWins);
    return [a1.concat(aRest), b2];
  }
  const [a1, b1] = transformOps(a, [b[0]], aWins);
  const [a2, bRest] = transformOps(a1, b.slice(1), aWins);
  return [a2, b1.concat(bRest)];
}

export function applyOperations(text: string, ops: OTOp[]): string {
  return ops.reduce(applyOperation, text);
}

/**
 * Compute diff between two strings as a sequence of OT operations.
 * Simple implementation for short texts (sticky notes).
 */
export function computeOps(oldText: string, newText: string): OTOp[] {
  const ops: OTOp[] = [];

  // Find common prefix
  let prefixLen = 0;
  while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (after prefix)
  let suffixLen = 0;
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deletedCount = oldText.length - prefixLen - suffixLen;
  const insertedChars = newText.slice(prefixLen, newText.length - suffixLen);

  if (deletedCount > 0) {
    ops.push({ type: 'delete', pos: prefixLen, count: deletedCount });
  }
  if (insertedChars.length > 0) {
    ops.push({ type: 'insert', pos: prefixLen, chars: insertedChars });
  }

  return ops;
}
