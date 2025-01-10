import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, target, signal, userId, roomId } = body;

    switch (type) {
      case 'join':
        await pusherServer.trigger(`presence-room-${roomId}`, 'user-joined', {
          userId,
          type: 'user-joined'
        });
        break;
      case 'leave':
        await pusherServer.trigger(`presence-room-${roomId}`, 'user-left', {
          userId,
          type: 'user-left'
        });
        break;
      case 'signal':
        await pusherServer.trigger(`presence-room-${roomId}`, `signal-${target}`, {
          userId,
          signal,
          type: 'signal'
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pusher API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 