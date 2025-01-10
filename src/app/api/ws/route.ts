import { WebSocketServer } from 'ws';
import { NextResponse } from 'next/server';
import { IncomingMessage } from 'http';

const rooms = new Map();
let wss: WebSocketServer | null = null;

if (!wss) {
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    let userId: string | null = null;
    let roomId: string | null = null;

    ws.on('message', (message: string) => {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join':
          userId = data.userId;
          roomId = data.roomId;
          
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          
          const room = rooms.get(roomId);
          room.set(userId, ws);

          // Notify others in the room
          room.forEach((peer: WebSocket, peerId: string) => {
            if (peerId !== userId) {
              peer.send(JSON.stringify({
                type: 'user-joined',
                userId: userId
              }));
            }
          });
          break;

        case 'signal':
          const targetRoom = rooms.get(roomId);
          if (targetRoom && targetRoom.has(data.target)) {
            targetRoom.get(data.target).send(JSON.stringify({
              type: 'signal',
              userId: userId,
              signal: data.signal
            }));
          }
          break;

        case 'leave':
          const currentRoom = rooms.get(roomId);
          if (currentRoom) {
            currentRoom.delete(userId);
            if (currentRoom.size === 0) {
              rooms.delete(roomId);
            } else {
              currentRoom.forEach((peer: WebSocket, peerId: string) => {
                if (peerId !== userId) {
                  peer.send(JSON.stringify({
                    type: 'user-left',
                    userId: userId
                  }));
                }
              });
            }
          }
          break;
      }
    });

    ws.on('close', () => {
      if (roomId && userId) {
        const room = rooms.get(roomId);
        if (room) {
          room.delete(userId);
          if (room.size === 0) {
            rooms.delete(roomId);
          } else {
            room.forEach((peer: WebSocket, peerId: string) => {
              if (peerId !== userId) {
                peer.send(JSON.stringify({
                  type: 'user-left',
                  userId: userId
                }));
              }
            });
          }
        }
      }
    });
  });
}

export function GET(req: Request) {
  const { socket: res } = req as any;

  if (!res.socket) {
    return new NextResponse('WebSocket server error', { status: 500 });
  }

  // Convert Request to IncomingMessage for WebSocket upgrade
  const incomingMessage = new IncomingMessage(res.socket);
  Object.assign(incomingMessage, {
    method: req.method,
    headers: Object.fromEntries(req.headers),
    url: req.url
  });

  wss?.handleUpgrade(incomingMessage, res.socket, Buffer.alloc(0), (ws) => {
    wss?.emit('connection', ws, incomingMessage);
  });

  return new NextResponse(null, { status: 101 });
}

export const dynamic = 'force-dynamic'; 