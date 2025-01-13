import { useState, useEffect } from 'react';
import { Section, Button, Cell } from '@telegram-apps/telegram-ui';
import { initData } from '@telegram-apps/sdk-react';
import { ArgentTMA } from '@argent/tma-wallet';

const argentTMA = ArgentTMA.init({
  environment: "sepolia",
  appName: "MOAI",
  appTelegramUrl: "https://t.me/moai_bot/MOAI",
  sessionParams: {
    allowedMethods: [
      {
        contract: "*", // Allow all contracts for MOA operations
        selector: "*" // Allow all methods
      }
    ],
    validityDays: 90
  },
});

export function MOAInitializer() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [account, setAccount] = useState<any>();
  const [publicKey, setPublicKey] = useState<string>();
  const [moaExists, setMoaExists] = useState(false);

  useEffect(() => {
    // Check if MOA exists for this chat
    const checkMOA = async () => {
      try {
        const chatInstance = initData.chatInstance;
        if (!chatInstance) return;

        const response = await fetch(`/api/moa/check?chatInstance=${chatInstance}`);
        const data = await response.json();
        setMoaExists(data.exists);
      } catch (error) {
        console.error('Error checking MOA:', error);
      }
    };

    checkMOA();
  }, []);

  useEffect(() => {
    // Check wallet connection status
    argentTMA
      .connect()
      .then(async (res) => {
        if (!res) {
          setIsWalletConnected(false);
          return;
        }

        const { account } = res;
        if (account.getSessionStatus() !== "VALID") {
          setAccount(account);
          setIsWalletConnected(false);
          return;
        }

        setAccount(account);
        setPublicKey(await account.signer.getPubKey());
        setIsWalletConnected(true);
      })
      .catch((err) => {
        console.error("Failed to connect wallet", err);
      });
  }, []);

  const handleConnectWallet = async () => {
    await argentTMA.requestConnection({
      callbackData: "connect_for_moa"
    });
  };

  const handleCreateMOA = async () => {
    try {
      if (!account || !publicKey) {
        console.error('Wallet not connected');
        return;
      }

      const chatInstance = initData.chatInstance;
      if (!chatInstance) {
        console.error('No chat instance found');
        return;
      }

      const response = await fetch('/api/moa/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInstance,
          address: account.address,
          publicKey
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create MOA');
      }

      setMoaExists(true);
    } catch (error) {
      console.error('Error creating MOA:', error);
    }
  };

  if (moaExists) {
    return null; // Don't show anything if MOA already exists
  }

  return (
    <Section header="Multi Owner Account">
      <Cell>
        {!isWalletConnected ? (
          <Button onClick={handleConnectWallet}>Connect Argent Wallet</Button>
        ) : (
          <Button onClick={handleCreateMOA}>Create Multi Owner Wallet</Button>
        )}
      </Cell>
    </Section>
  );
} 