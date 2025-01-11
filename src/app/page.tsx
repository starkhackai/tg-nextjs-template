'use client';

import { Section, Cell, Image, List, Button } from '@telegram-apps/telegram-ui';
import dynamic from 'next/dynamic';

import { Link } from '@/components/Link/Link';
import { Page } from '@/components/Page';

const ArgentWallet = dynamic(
  () => import('@/components/ArgentWallet/ArgentWallet').then(mod => mod.ArgentWallet),
  { ssr: false }
);

const VoiceChat = dynamic(
  () => import('@/components/VoiceChat/VoiceChat').then(mod => mod.VoiceChat),
  { ssr: false }
);

export default function Home() {
  

  return (
    <Page back={false}>
      <List>
        <VoiceChat />
        
        <Section
          header="Wallet Connection"
          footer="Connect your Argent wallet to interact with Starknet"
        >
          <ArgentWallet />
        </Section>

       

        <Section
          header="Features"
          footer="You can use these pages to learn more about features, provided by Telegram Mini Apps and other useful projects"
        >
          <Link href="/moa">
            <Cell subtitle="Create or join a multisig account with your group members">
              Multisig Account (MOA)
            </Cell>
          </Link>
          <Link href="/ton-connect">
            <Cell subtitle="Connect your TON wallet">
              TON Connect
            </Cell>
          </Link>
        </Section>
        <Section
          header="Application Launch Data"
          footer="These pages help developer to learn more about current launch information"
        >
          <Link href="/init-data">
            <Cell subtitle="User data, chat information, technical data">
              Init Data
            </Cell>
          </Link>
          <Link href="/launch-params">
            <Cell subtitle="Platform identifier, Mini Apps version, etc.">
              Launch Parameters
            </Cell>
          </Link>
          <Link href="/theme-params">
            <Cell subtitle="Telegram application palette information">
              Theme Parameters
            </Cell>
          </Link>
        </Section>
        
      </List>
    </Page>
  );
}
