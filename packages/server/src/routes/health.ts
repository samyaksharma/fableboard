import { Router, type Router as ExpressRouter } from 'express';
import { checkConvex } from '../services/convexHealth.js';

const router: ExpressRouter = Router();

router.get('/health', async (_req, res) => {
  const convex = await checkConvex();
  res.json({ status: 'ok', convex, timestamp: new Date().toISOString() });
});

export default router;
