import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { config } from './env.js';

const client =
  config.convexUrl && config.convexServerSecret ? new ConvexHttpClient(config.convexUrl) : null;

export const convexEnabled = client !== null;

type Args = Record<string, unknown>;

/** Call a Convex function in convex/store.ts. Throws on failure; callers decide how to degrade. */
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
