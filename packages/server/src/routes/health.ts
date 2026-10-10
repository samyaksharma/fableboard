import { Router, type Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
