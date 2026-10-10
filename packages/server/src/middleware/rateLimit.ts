import type { Request, Response, NextFunction } from 'express';

/**
 * Tiny in-memory sliding-window limiter, keyed by client IP. Enough for a single instance;
 * behind a reverse proxy, set `app.set('trust proxy', ...)` so req.ip is the real client.
 */
export function rateLimit(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  setInterval(() => {
    const cutoff = Date.now() - opts.windowMs;
    for (const [key, times] of hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) hits.set(key, recent);
      else hits.delete(key);
    }
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => t > now - opts.windowMs);
    if (recent.length >= opts.max) {
      const retry = Math.ceil((recent[0] + opts.windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      res.status(429).json({ error: `Too many attempts. Try again in ${retry}s.` });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
