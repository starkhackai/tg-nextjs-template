'use client';

import { useState, useEffect } from 'react';
import { Cell, Button } from '@telegram-apps/telegram-ui';
import dynamic from 'next/dynamic';

export function ArgentWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [argentTMA, setArgentTMA] = useState<any>(null);

  useEffect(() => {
    const initArgent = async () => {
      try {
        const { ArgentTMA } = await import('@argent/tma-wallet');
        const tma = ArgentTMA.init({
          environment: "sepolia",
          appName: "MOAI",
          appTelegramUrl: "https://t.me/moai_bot/MOAI",
          sessionParams: {
            validityDays: 90,
            allowedMethods: []
          },
        });
        setArgentTMA(tma);
      } catch (error) {
        console.error("Failed to initialize Argent:", error);
      }
    };

    initArgent();
  }, []);

  useEffect(() => {
    if (!argentTMA) return;

    argentTMA
      .connect()
      .then((res: any) => {
        if (!res) {
          setIsConnected(false);
          return;
        }
        
        const { account } = res;

        if (account.getSessionStatus() !== "VALID") {
          setAccount(account);
          setIsConnected(false);
          return;
        }

        setAccount(account);
        setIsConnected(true);
      })
      .catch((err: any) => {
        console.error("Failed to connect", err);
      });
  }, [argentTMA]);

  const handleConnect = async () => {
    if (!argentTMA) return;
    try {
      await argentTMA.connect();
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  return (
    <Cell>
      {!isConnected ? (
        <Button onClick={handleConnect}>Connect Argent Wallet</Button>
      ) : (
        <div>
          <p>Connected Address: {account?.address}</p>
        </div>
      )}
    </Cell>
  );
} 