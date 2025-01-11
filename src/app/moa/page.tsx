'use client';

import { useState, useEffect } from 'react';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import { Section, List, Input, Button, Cell } from '@telegram-apps/telegram-ui';
import { Page } from '@/components/Page';

interface Participant {
  userId: string;
  username: string;
  publicKey: string;
}

export default function MOAPage() {
  const initDataState = useSignal(initData.state);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [publicKey, setPublicKey] = useState('');

  // In a real app, you would fetch this from your backend
  useEffect(() => {
    // Mock data for demonstration
    setParticipants([
      {
        userId: '123',
        username: 'alice',
        publicKey: '0x123...abc'
      },
      {
        userId: '456',
        username: 'bob',
        publicKey: '0x456...def'
      }
    ]);
  }, []);

  const handleJoin = () => {
    if (!publicKey.trim() || !initDataState?.user) return;
    
    const newParticipant: Participant = {
      userId: initDataState.user.id.toString(),
      username: initDataState.user.username || 'Unknown',
      publicKey: publicKey.trim()
    };

    // In a real app, you would send this to your backend
    setParticipants([...participants, newParticipant]);
    setPublicKey('');
  };

  return (
    <Page>
      <List>
        <Section header="Join Multisig Account">
          <Input
            placeholder="Enter your public key"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
          <Button onClick={handleJoin}>Join MOA</Button>
        </Section>

        <Section header="Current Participants">
          {participants.map((participant) => (
            <Cell
              key={participant.userId}
              subtitle={`Public Key: ${participant.publicKey}`}
            >
              {participant.username}
            </Cell>
          ))}
        </Section>
      </List>
    </Page>
  );
} 