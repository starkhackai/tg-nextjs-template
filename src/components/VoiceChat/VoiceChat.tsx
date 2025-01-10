import { FC, useEffect, useRef, useState } from 'react';
import { Button, Section } from '@telegram-apps/telegram-ui';
import SimplePeer from 'simple-peer';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import { pusherClient } from '@/lib/pusher';

interface Peer {
  userId: string;
  instance: SimplePeer.Instance;
  stream?: MediaStream;
  isSpeaking: boolean;
  audioLevel: number;
}

export const VoiceChat: FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  const animationFrameRef = useRef<number>();
  const user = useSignal(initData.user);
  const pendingPeersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());

  const detectSpeaking = (audioLevel: number) => {
    // Adjust this threshold based on testing
    return audioLevel > -50;
  };

  const updateAudioLevels = () => {
    peers.forEach((peer, userId) => {
      const analyser = analyserNodesRef.current.get(userId);
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        
        // Calculate average volume level
        const average = Array.from(data).reduce((a, b) => a + b, 0) / analyser.frequencyBinCount;
        const normalizedLevel = (average / 255) * 100 - 100; // Convert to dB scale
        
        setPeers(prev => {
          const newPeers = new Map(prev);
          const peerData = newPeers.get(userId);
          if (peerData) {
            peerData.audioLevel = normalizedLevel;
            peerData.isSpeaking = detectSpeaking(normalizedLevel);
            newPeers.set(userId, peerData);
          }
          return newPeers;
        });
      }
    });

    animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
  };

  const createPeer = (targetUserId: string, initiator: boolean, stream: MediaStream) => {
    console.log('Creating peer connection:', { initiator, targetUserId });
    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: true,
      config: {
        iceServers: [
          {
            urls: "stun:stun.relay.metered.ca:80",
          },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "80c27bff49c6961b0c5bca2e",
            credential: "Sv/o1Tiucp68/RWS",
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "80c27bff49c6961b0c5bca2e",
            credential: "Sv/o1Tiucp68/RWS",
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "80c27bff49c6961b0c5bca2e",
            credential: "Sv/o1Tiucp68/RWS",
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "80c27bff49c6961b0c5bca2e",
            credential: "Sv/o1Tiucp68/RWS",
          },
        ],
        iceCandidatePoolSize: 10
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
      // Move from pending to active peers
      if (pendingPeersRef.current.has(targetUserId)) {
        pendingPeersRef.current.delete(targetUserId);
      }
    });

    peer.on('stream', remoteStream => {
      console.log('Received remote stream from:', targetUserId);
      
      // Set up audio analysis
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(remoteStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodesRef.current.set(targetUserId, analyser);

      setPeers(prev => {
        const newPeers = new Map(prev);
        const peerData = newPeers.get(targetUserId);
        if (peerData) {
          peerData.stream = remoteStream;
          peerData.isSpeaking = false;
          peerData.audioLevel = -100;
          newPeers.set(targetUserId, peerData);
        }
        return newPeers;
      });

      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(console.error);

      // Start audio level monitoring if not already started
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
      }
    });

    peer.on('error', err => {
      console.error('Peer connection error:', err);
      // Only set error if it's not a normal disconnection
      if (!err.message.includes('User-Initiated Abort') && !err.message.includes('Close called')) {
        setError('Connection error. Please try rejoining.');
      }
      // Clean up the peer connection
      const targetId = targetUserId;
      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.delete(targetId);
        return newPeers;
      });
      pendingPeersRef.current.delete(targetId);
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', targetUserId);
      // Clean up the peer connection
      const targetId = targetUserId;
      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.delete(targetId);
        return newPeers;
      });
      pendingPeersRef.current.delete(targetId);
      setParticipants(prev => prev.filter(id => id !== targetId));
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
              instance: peer,
              isSpeaking: false,
              audioLevel: -100
            });
            return newPeers;
          });
          pendingPeersRef.current.set(data.userId, peer);
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
        pendingPeersRef.current.delete(data.userId);
        setParticipants(prev => prev.filter(id => id !== data.userId));
      });

      // Handle signaling
      channel.bind(`signal-${user.id}`, async (data: { userId: string; signal: any }) => {
        console.log('Received signal:', { from: data.userId, type: data.signal.type });
        try {
          const existingPeer = peers.get(data.userId)?.instance || pendingPeersRef.current.get(data.userId);
          
          if (existingPeer) {
            existingPeer.signal(data.signal);
            return;
          }

          if (data.signal.type === 'offer' && streamRef.current) {
            console.log('Creating new peer for offer from:', data.userId);
            const newPeer = createPeer(data.userId, false, streamRef.current);
            setPeers(prev => {
              const newPeers = new Map(prev);
              newPeers.set(data.userId, {
                userId: data.userId,
                instance: newPeer,
                isSpeaking: false,
                audioLevel: -100
              });
              return newPeers;
            });
            pendingPeersRef.current.set(data.userId, newPeer);
            newPeer.signal(data.signal);
          } else {
            console.warn('Received signal but no peer found:', data);
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
    pendingPeersRef.current.clear();
    setPeers(new Map());
    setParticipants([]);
    setIsConnected(false);
    setIsMuted(false);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      analyserNodesRef.current.clear();
      disconnectVoiceChat();
    };
  }, []);

  const getParticipantInitial = (userId: string) => {
    // If it's the current user, use their first name's initial
    if (userId === user?.id.toString() && user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    // For other participants, use the first character of their ID
    return userId[0].toUpperCase();
  };

  return (
    <Section header="Voice Chat Room">
      <div className="voice-chat">
        {user && (
          <div className="text-sm text-gray-600 mb-4">
            Connected as: {user.firstName} {user.lastName}
          </div>
        )}
        
        {error && (
          <div className="text-red-500 mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 mb-6">
          {Array.from(peers.values()).map((peer) => (
            <div key={peer.userId} className="flex flex-col items-center">
              <div className={`
                relative w-20 h-20 rounded-full flex items-center justify-center
                bg-blue-100 text-blue-600 text-xl font-semibold
                transition-all duration-300
                ${peer.isSpeaking ? 'ring-4 ring-green-400 scale-110' : ''}
                ${peer.audioLevel > -70 ? 'ring-2 ring-green-200' : ''}
              `}>
                {getParticipantInitial(peer.userId)}
                <div className={`
                  absolute -bottom-1 right-0 w-4 h-4 rounded-full
                  ${peer.isSpeaking ? 'bg-green-400' : 'bg-gray-300'}
                `} />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {peer.userId === user?.id.toString() ? 'You' : `User ${peer.userId.slice(0, 4)}`}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          {!isConnected ? (
            <Button className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600" onClick={startVoiceChat}>
              Join Voice Chat
            </Button>
          ) : (
            <>
              <Button 
                className={`px-6 py-2 rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                onClick={toggleMute}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button 
                className="px-6 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600"
                onClick={disconnectVoiceChat}
              >
                Leave Voice Chat
              </Button>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}; 