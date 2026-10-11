import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@fableboard/shared';
import { config } from '../config/env.js';
import { verifyToken } from '../services/authService.js';
import { registerSessionHandlers } from './handlers/sessionHandler.js';
import { registerCanvasHandlers } from './handlers/canvasHandler.js';
import { registerKanbanHandlers } from './handlers/kanbanHandler.js';

export interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      (socket as AuthenticatedSocket).user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    registerSessionHandlers(io, socket);
    registerCanvasHandlers(io, socket);
    registerKanbanHandlers(io, socket);
  });

  return io;
}
