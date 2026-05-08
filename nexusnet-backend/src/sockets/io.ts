import type { Server } from 'socket.io';

let ioRef: Server | null = null;

export function setSocketServer(io: Server): void {
  ioRef = io;
}

export function getSocketServer(): Server | null {
  return ioRef;
}
