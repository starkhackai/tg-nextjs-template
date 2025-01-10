import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const socketId = formData.get('socket_id') as string;
    const channel = formData.get('channel_name') as string;

    if (!socketId || !channel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a random user ID if not available
    const userId = Math.random().toString(36).slice(2);

    const authResponse = pusherServer.authorizeChannel(socketId, channel, {
      user_id: userId,
      user_info: {
        name: `User ${userId.slice(0, 4)}`
      }
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher Auth Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}