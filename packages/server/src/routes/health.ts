import { Router, type Router as ExpressRouter } from 'express';
import { config } from '../config/env.js';
import { checkConvex } from '../services/convexHealth.js';

const router: ExpressRouter = Router();

router.get('/health', async (_req, res) => {
  const convex = await checkConvex();
  // The deployment hostname is public (it ships in every Convex client); showing it exposes typos.
  let convexHost: string | undefined;
  try {
    convexHost = config.convexUrl ? new URL(config.convexUrl).host : undefined;
  } catch {
    convexHost = undefined;
  }
  res.json({ status: 'ok', convex, convexHost, timestamp: new Date().toISOString() });
});

export default router;
