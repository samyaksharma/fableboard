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
 * Transform op2 against op1 (both applied to the same base).
 * Returns transformed op2 that can be applied after op1.
 */
export function transformOperation(op1: OTOp, op2: OTOp): OTOp {
  // insert vs insert
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op2.pos <= op1.pos) {
      return op2; // op2 inserts before op1, no adjustment
    }
    return { ...op2, pos: op2.pos + op1.chars.length };
  }

  // delete vs delete
  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op2.pos >= op1.pos + op1.count) {
      return { ...op2, pos: op2.pos - op1.count };
    }
    if (op2.pos + op2.count <= op1.pos) {
      return op2;
    }
    // Overlapping deletes
    const start = Math.max(op2.pos, op1.pos);
    const end = Math.min(op2.pos + op2.count, op1.pos + op1.count);
    const overlap = Math.max(0, end - start);
    return {
      type: 'delete',
      pos: Math.min(op2.pos, op1.pos),
      count: op2.count - overlap,
    };
  }

  // insert vs delete
  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op2.pos >= op1.pos) {
      return { ...op2, pos: op2.pos + op1.chars.length };
    }
    if (op2.pos + op2.count <= op1.pos) {
      return op2;
    }
    // Delete spans across insert point
    return op2;
  }

  // delete vs insert
  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op2.pos <= op1.pos) {
      return op2;
    }
    if (op2.pos >= op1.pos + op1.count) {
      return { ...op2, pos: op2.pos - op1.count };
    }
    // Insert inside deleted range — place at delete position
    return { ...op2, pos: op1.pos };
  }

  return op2;
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
