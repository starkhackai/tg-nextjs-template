import { CHAIN_ID, ARGENT_WEBWALLET_URL } from "@/constants"
import {
  connectorAtom,
  connectorDataAtom,
  walletStarknetkitNextAtom,
} from "@/state/connectedWalletStarknetkitNext"
import { starknetkitVersionAtom } from "@/state/versionState"
import { useSetAtom } from "jotai"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { connect } from "starknetkit"
import { ArgentMobileBaseConnector } from "starknetkit/argentMobile"
import { InjectedConnector } from "starknetkit/injected"
import { WebWalletConnector } from "starknetkit/webwallet"

const ConnectButtonStarknetkitNext = () => {
  const setWallet = useSetAtom(walletStarknetkitNextAtom)
  const setConnectorData = useSetAtom(connectorDataAtom)
  const setConnector = useSetAtom(connectorAtom)
  const setStarknetkitVersion = useSetAtom(starknetkitVersionAtom)
  const navigate = useRouter()

  const [withAdditionalWallets, setWithAdditionalWallets] = useState(false)

  const connectFn = async () => {
    const res = await connect(
      withAdditionalWallets
        ? {
            modalMode: "alwaysAsk",
            connectors: [
              new InjectedConnector({ options: { id: "argentX" } }),
              new InjectedConnector({ options: { id: "braavos" } }),
              new InjectedConnector({ options: { id: "keplr" } }),
              new InjectedConnector({ options: { id: "metamask" } }),
              new InjectedConnector({ options: { id: "okxwallet" } }),
              new ArgentMobileBaseConnector({
                dappName: "Starknetkit example dapp",
                url: window.location.hostname,
                chainId: CHAIN_ID,
                icons: [],
              }),
              new WebWalletConnector({ url: ARGENT_WEBWALLET_URL }),
            ],
          }
        : {
            modalMode: "alwaysAsk",
            webWalletUrl: ARGENT_WEBWALLET_URL,
            argentMobileOptions: {
              dappName: "Starknetkit example dapp",
              url: window.location.hostname,
              chainId: CHAIN_ID,
              icons: [],
            },
          },
    )

    const { wallet, connectorData, connector } = res
    setWallet(wallet)
    setConnectorData(connectorData)
    setConnector(connector)
    setStarknetkitVersion(
      `starknetkit@next (${process.env.starknetkitNextVersion})`,
    )
    navigate.push("/starknetkitNext")
  }

  return (
    <>
      <div className="flex flex-col items-center">
        <button
          className="p-4 rounded-lg bg-primary-500 hover:bg-primary-600 h-20 w-full text-white"
          onClick={connectFn}
        >
          starknetkit@next ({process.env.starknetkitNextVersion}) +
          <strong>(with session keys)</strong> {/* TODO: will be removed */}
        </button>
      </div>
      <div className="flex gap-1">
        <input
          type="checkbox"
          checked={withAdditionalWallets}
          onChange={() => setWithAdditionalWallets(!withAdditionalWallets)}
        />
        Include Metamask, Keplr and OKX wallets with starknetkit@next (
        {process.env.starknetkitNextVersion})
      </div>
    </>
  )
}

export { ConnectButtonStarknetkitNext }