import { type OTOp, applyOperations, computeOps, transformOps } from './ot.js';

/**
 * Server side of a single text document. Every accepted edit gets the next
 * version number; edits made against an older version are transformed over
 * everything that has happened since.
 */
export class OTServerDoc {
  private history: OTOp[][] = [];

  constructor(
    public text: string,
    public version = 0,
  ) {}

  /** Returns the transformed ops and new version, or null if baseVersion is unknown (client must resync). */
  receive(baseVersion: number, ops: OTOp[]): { ops: OTOp[]; version: number } | null {
    const firstKnown = this.version - this.history.length;
    if (baseVersion < firstKnown || baseVersion > this.version) return null;

    let incoming = ops;
    for (const past of this.history.slice(baseVersion - firstKnown)) {
      [, incoming] = transformOps(past, incoming, true); // earlier server edits win ties
    }
    this.text = applyOperations(this.text, incoming);
    this.history.push(incoming);
    this.version++;
    return { ops: incoming, version: this.version };
  }
}

/**
 * Client side: at most one batch of ops is in flight; further local edits wait
 * in a buffer. Remote ops are transformed over both before being applied locally.
 */
export class OTClient {
  private inflight: OTOp[] | null = null;
  private buffer: OTOp[] = [];

  constructor(
    public text: string,
    public version = 0,
  ) {}

  /** Record a local edit. Returns a batch to send if nothing is in flight. */
  localEdit(newText: string): { baseVersion: number; ops: OTOp[] } | null {
    const ops = computeOps(this.text, newText);
    this.text = newText;
    if (ops.length === 0) return null;
    if (this.inflight) {
      this.buffer = this.buffer.concat(ops);
      return null;
    }
    this.inflight = ops;
    return { baseVersion: this.version, ops };
  }

  /** Server accepted our in-flight batch. Returns the next batch to send, if any. */
  ack(version: number): { baseVersion: number; ops: OTOp[] } | null {
    this.version = version;
    this.inflight = null;
    if (this.buffer.length === 0) return null;
    this.inflight = this.buffer;
    this.buffer = [];
    return { baseVersion: this.version, ops: this.inflight };
  }

  /** Apply a remote batch (already ordered by the server). Returns the new local text. */
  remote(ops: OTOp[], version: number): string {
    let incoming = ops;
    if (this.inflight) [incoming, this.inflight] = transformOps(incoming, this.inflight, true);
    if (this.buffer.length) [incoming, this.buffer] = transformOps(incoming, this.buffer, true);
    this.text = applyOperations(this.text, incoming);
    this.version = version;
    return this.text;
  }
}
