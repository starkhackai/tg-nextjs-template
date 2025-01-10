import { FC, useEffect, useRef, useState } from 'react';
import { Button, Section } from '@telegram-apps/telegram-ui';
import SimplePeer from 'simple-peer';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import { pusherClient } from '@/lib/pusher';

import './styles.css';

interface Peer {
  userId: string;
  instance: SimplePeer.Instance;
  stream?: MediaStream;
}

export const VoiceChat: FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const user = useSignal(initData.user);

  const createPeer = (targetUserId: string, initiator: boolean, stream: MediaStream) => {
    console.log('Creating peer connection:', { initiator, targetUserId });
    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', signal => {
      console.log('Generated signal:', { type: signal.type, targetUserId });
      fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signal',
          target: targetUserId,
          signal,
          userId: user?.id.toString(),
          roomId: 'main'
        })
      }).catch(console.error);
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', targetUserId);
    });

    peer.on('stream', remoteStream => {
      console.log('Received remote stream from:', targetUserId);
      setPeers(prev => {
        const newPeers = new Map(prev);
        const peerData = newPeers.get(targetUserId);
        if (peerData) {
          peerData.stream = remoteStream;
          newPeers.set(targetUserId, peerData);
        }
        return newPeers;
      });

      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(console.error);
    });

    peer.on('error', err => {
      console.error('Peer connection error:', err);
      setError('Connection error. Please try rejoining.');
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', targetUserId);
    });

    return peer;
  };

  const startVoiceChat = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!user?.id) {
        setError('User ID not found');
        return;
      }

      // Subscribe to the room channel
      const channel = pusherClient.subscribe(`presence-room-main`);
      channelRef.current = channel;

      // Handle user joined event
      channel.bind('user-joined', (data: { userId: string }) => {
        console.log('User joined:', data.userId);
        if (data.userId !== user.id.toString() && streamRef.current) {
          const peer = createPeer(data.userId, true, streamRef.current);
          setPeers(prev => {
            const newPeers = new Map(prev);
            newPeers.set(data.userId, {
              userId: data.userId,
              instance: peer
            });
            return newPeers;
          });
          setParticipants(prev => [...prev, data.userId]);
        }
      });

      // Handle user left event
      channel.bind('user-left', (data: { userId: string }) => {
        console.log('User left:', data.userId);
        setPeers(prev => {
          const newPeers = new Map(prev);
          const peer = newPeers.get(data.userId);
          if (peer) {
            peer.instance.destroy();
            newPeers.delete(data.userId);
          }
          return newPeers;
        });
        setParticipants(prev => prev.filter(id => id !== data.userId));
      });

      // Handle signaling
      channel.bind(`signal-${user.id}`, async (data: { userId: string; signal: any }) => {
        console.log('Received signal:', { from: data.userId, type: data.signal.type });
        try {
          const peer = peers.get(data.userId);
          if (peer) {
            peer.instance.signal(data.signal);
          } else if (streamRef.current) {
            console.log('Creating new peer for signal from:', data.userId);
            const newPeer = createPeer(data.userId, false, streamRef.current);
            setPeers(prev => {
              const newPeers = new Map(prev);
              newPeers.set(data.userId, {
                userId: data.userId,
                instance: newPeer
              });
              return newPeers;
            });
            // Wait for the peer to be ready before signaling
            await new Promise(resolve => setTimeout(resolve, 100));
            newPeer.signal(data.signal);
          }
        } catch (error) {
          console.error('Error handling signal:', error);
        }
      });

      // Join the room
      await fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'join',
          userId: user.id.toString(),
          roomId: 'main'
        })
      });
      
      setIsConnected(true);
      console.log('Successfully joined the room');

    } catch (error) {
      console.error('Error starting voice chat:', error);
      setError('Error accessing microphone. Please check permissions.');
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const disconnectVoiceChat = () => {
    setError(null);
    
    if (channelRef.current) {
      fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'leave',
          userId: user?.id.toString(),
          roomId: 'main'
        })
      }).catch(console.error);

      channelRef.current.unbind_all();
      pusherClient.unsubscribe(`presence-room-main`);
      channelRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    peers.forEach(peer => {
      if (peer.instance) {
        peer.instance.destroy();
      }
    });
    setPeers(new Map());
    setParticipants([]);
    setIsConnected(false);
    setIsMuted(false);
  };

  useEffect(() => {
    return () => {
      disconnectVoiceChat();
    };
  }, []);

  return (
    <Section header="Voice Chat Room">
      <div className="voice-chat">
        {user && (
          <div className="voice-chat__user">
            Connected as: {user.firstName} {user.lastName}
          </div>
        )}
        
        {error && (
          <div className="voice-chat__error">
            {error}
          </div>
        )}

        <div className="voice-chat__participants">
          {participants.length > 0 && (
            <>
              <div className="voice-chat__participants-header">
                Participants ({participants.length}):
              </div>
              <div className="voice-chat__participants-list">
                {participants.map(userId => (
                  <div key={userId} className="voice-chat__participant">
                    User {userId}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="voice-chat__controls">
          {!isConnected ? (
            <Button className="voice-chat__button" onClick={startVoiceChat}>
              Join Voice Chat
            </Button>
          ) : (
            <>
              <Button className="voice-chat__button" onClick={toggleMute}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button className="voice-chat__button" onClick={disconnectVoiceChat}>
                Leave Voice Chat
              </Button>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}; 