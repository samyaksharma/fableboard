import { convexConfigError, convexEnabled, convexQuery } from '../config/convex.js';

export type ConvexStatus =
  | 'disabled'
  | 'ok'
  | 'invalid-url'
  | 'unauthorized'
  | 'missing-functions'
  | 'unreachable';

const HINTS: Record<Exclude<ConvexStatus, 'disabled' | 'ok'>, string> = {
  'invalid-url':
    'CONVEX_URL must be the https://<name>.convex.cloud deployment URL, not the .convex.site HTTP-actions URL.',
  unauthorized:
    'CONVEX_SERVER_SECRET does not match the secret set on the Convex deployment (npx convex env get CONVEX_SERVER_SECRET).',
  'missing-functions':
    'CONVEX_URL points at a deployment without the Fableboard functions (run `npx convex deploy`, or use the URL of the deployment you ran `convex dev` against).',
  unreachable:
    'Could not reach Convex. Check CONVEX_URL for a typo in the deployment name (compare convexHost on /api/health with your deployment).',
};

let cached: { at: number; status: ConvexStatus } | null = null;

/** Cheap read-only probe, cached for 30s so the health endpoint cannot be used to hammer Convex. */
export async function checkConvex(): Promise<ConvexStatus> {
  if (!convexEnabled) return convexConfigError ? 'invalid-url' : 'disabled';
  if (cached && Date.now() - cached.at < 30_000) return cached.status;

  let status: ConvexStatus = 'ok';
  try {
    await convexQuery('loadSession', { sessionId: '__health__' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status = /Unauthorized/i.test(message)
      ? 'unauthorized'
      : /could not find (public )?function|no such function/i.test(message)
        ? 'missing-functions'
        : 'unreachable';
    console.error(`Convex check failed (${status}): ${HINTS[status]}\n  cause: ${message.split('\n')[0]}`);
  }
  cached = { at: Date.now(), status };
  return status;
}
