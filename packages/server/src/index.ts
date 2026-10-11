import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env.js';
import { convexEnabled } from './config/convex.js';
import { flushPersist } from './store/persist.js';
import { createSocketServer } from './socket/index.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
if (config.trustProxy) app.set('trust proxy', config.trustProxy);
const httpServer = createServer(app);

app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', requireAuth, sessionsRouter);

app.set('io', createSocketServer(httpServer));

async function start() {
  console.log(convexEnabled ? 'Persistence: Convex' : 'Convex not configured — running in memory only');

  httpServer.listen(config.port, () => {
    console.log(`Fableboard server running on port ${config.port}`);
  });
}

start();

// Push any debounced writes out before exiting.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    flushPersist();
    setTimeout(() => process.exit(0), 500);
  });
}
