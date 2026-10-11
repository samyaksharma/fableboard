import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from './config';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = localStorage.getItem('fableboard_token');
  if (!socket) {
    socket = io(SERVER_URL || '/', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token: token ?? '' },
    });
  } else {
    socket.auth = { token: token ?? '' };
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}
