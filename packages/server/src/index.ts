import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env.js';
import { connectRedis } from './config/redis.js';
import { createSocketServer } from './socket/index.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', requireAuth, sessionsRouter);

createSocketServer(httpServer);

async function start() {
  await connectRedis();

  httpServer.listen(config.port, () => {
    console.log(`Fableboard server running on port ${config.port}`);
  });
}

start();
