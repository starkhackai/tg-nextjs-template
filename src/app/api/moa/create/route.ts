import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PrismaClient, Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { chatInstance, address, publicKey } = await request.json();

    if (!chatInstance || !address || !publicKey) {
      return NextResponse.json(
        { error: 'Chat instance, address and public key are required' },
        { status: 400 }
      );
    }

    // Create MOA and first participant in a transaction
    const moa = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the MOA
      const newMoa = await tx.multiOwnerAccount.create({
        data: {
          chatInstance,
          status: 'PENDING'
        }
      });

      // Create or connect the user
      const user = await tx.user.upsert({
        where: { address },
        update: { publicKey },
        create: {
          address,
          publicKey
        }
      });

      // Create the participant relationship
      await tx.participantOnMOA.create({
        data: {
          participantId: user.address,
          moaId: newMoa.chatInstance
        }
      });

      return newMoa;
    });

    return NextResponse.json(moa);
  } catch (error) {
    console.error('Error creating MOA:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 