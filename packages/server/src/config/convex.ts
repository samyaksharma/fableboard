import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { config } from './env.js';

let client: ConvexHttpClient | null = null;
/** Set when CONVEX_URL is rejected by the Convex client (e.g. the .convex.site URL). */
export let convexConfigError: string | null = null;

if (config.convexUrl && config.convexServerSecret) {
  try {
    client = new ConvexHttpClient(config.convexUrl);
  } catch (err) {
    // A bad URL must not crash the server on boot: run in memory and say why.
    convexConfigError = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.error(`Convex disabled, invalid CONVEX_URL: ${convexConfigError}`);
  }
}

export const convexEnabled = client !== null;

type Args = Record<string, unknown>;

export async function convexQuery<T = any>(name: string, args: Args = {}): Promise<T> {
  if (!client) throw new Error('Convex not configured');
  const ref = makeFunctionReference<'query'>(`store:${name}`);
  return (await client.query(ref, { ...args, secret: config.convexServerSecret } as any)) as T;
}

export async function convexMutation<T = any>(name: string, args: Args = {}): Promise<T> {
  if (!client) throw new Error('Convex not configured');
  const ref = makeFunctionReference<'mutation'>(`store:${name}`);
  return (await client.mutation(ref, { ...args, secret: config.convexServerSecret } as any)) as T;
}

/** Fire-and-forget write: the in-memory copy stays authoritative if Convex is unreachable. */
export function convexWrite(name: string, args: Args = {}): void {
  if (!client) return;
  convexMutation(name, args).catch((err) =>
    console.error(`Convex ${name} failed:`, err instanceof Error ? err.message : err),
  );
}
