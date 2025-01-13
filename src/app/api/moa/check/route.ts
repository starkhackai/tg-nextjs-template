import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatInstance = searchParams.get('chatInstance');

    if (!chatInstance) {
      return NextResponse.json({ error: 'Chat instance is required' }, { status: 400 });
    }

    const moa = await prisma.multiOwnerAccount.findUnique({
      where: {
        chatInstance: chatInstance
      }
    });

    return NextResponse.json({ exists: !!moa });
  } catch (error) {
    console.error('Error checking MOA:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 