'use client';

import { useState, useEffect } from 'react';
import { Cell, Button } from '@telegram-apps/telegram-ui';
import { ArgentTMA, SessionAccountInterface } from '@argent/tma-wallet';

const argentTMA = ArgentTMA.init({
  environment: "sepolia",
  appName: "MOAI",
  appTelegramUrl: "https://t.me/moai_bot/MOAI",
  sessionParams: {
    allowedMethods: [
      {
        contract: "0x036133c88c1954413150db74c26243e2af77170a4032934b275708d84ec5452f",
        selector: "increment",
      }
    ],
    validityDays: 90
  },
});

export function ArgentWallet() {
  const [account, setAccount] = useState<SessionAccountInterface>();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    argentTMA
      .connect()
      .then((res) => {
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
        console.log("callback data:", res.callbackData);
      })
      .catch((err) => {
        console.error("Failed to connect", err);
      });
  }, []);

  
  const handleConnectButton = async () => {
    // If not connected, trigger a connection request
    // It will open the wallet and ask the user to approve the connection
    // The wallet will redirect back to the app and the account will be available
    // from the connect() method -- see above
    await argentTMA.requestConnection({
      callbackData: "custom_callback_data",
      approvalRequests: [
        {
          token: {
            // Token address that you need approved
          address: "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7",
          name: "Ethereum",
          symbol: "ETH",
          decimals: 18,
        },
        amount: BigInt(100000).toString(),
        spender: "0x7e00d496e324876bbc8531f2d9a82bf154d1a04a50218ee74cdd372f75a551a",
        },
      ],
    });
  };

  const handleClearSession = async () => {
    await argentTMA.clearSession();
    setAccount(undefined);
    setIsConnected(false);
  };

  return (
    <Cell>
      {!isConnected ? (
        <Button onClick={handleConnectButton}>Connect Argent Wallet</Button>
      ) : (
        <div>
          <p>Connected Address: {account?.address}</p>
          <Button onClick={handleClearSession}>Clear Session</Button>
        </div>
      )}
    </Cell>
  );
}