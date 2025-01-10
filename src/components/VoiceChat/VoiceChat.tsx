import { FC, useEffect, useRef, useState } from 'react';
import { Button, Section } from '@telegram-apps/telegram-ui';
import SimplePeer from 'simple-peer';
import { useSignal, initData } from '@telegram-apps/sdk-react';

import './styles.css';

export const VoiceChat: FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState<SimplePeer.Instance[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const user = useSignal(initData.user);

  const startVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsConnected(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    peers.forEach(peer => peer.destroy());
    setPeers([]);
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