"use client";

import { thirdwebClient, wallets } from "../app/client";
import { useEffect, useState } from "react";
import { ConnectButton, darkTheme, useActiveAccount } from "thirdweb/react";
import type { Account } from "thirdweb/wallets";
import { pushChainDonut } from "../constants/chain";

interface ConnectWalletProps {
  onConnect?: () => void;
  label?: string;
}

const ConnectWallet = ({ onConnect, label = "Connect Wallet" }: ConnectWalletProps) => {
  const [mounted, setMounted] = useState(false);
  const account = useActiveAccount();
  const [prevAccount, setPrevAccount] = useState<Account | undefined>(undefined);
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://dehug.vercel.app";
      
  const metadata = {
    name: "DeHug",
    description: "Decentralized Machine Learning Hub",
    url: origin,
    icons: ["https://assets.reown.com/reown-profile-pic.png"],
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (account && !prevAccount && onConnect) {
      onConnect();
    }
    setPrevAccount(account);
  }, [account, prevAccount, onConnect]);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-3 justify-end self-end">
      <div className="hidden md:flex">
        <ConnectButton 
          client={thirdwebClient}
          appMetadata={metadata}
          connectButton={{ label }}
          wallets={wallets}
          connectModal={{ size: "compact" }}
          chain={pushChainDonut}
          chains={[pushChainDonut]}
          theme={darkTheme({
            colors: {
              primaryButtonBg: "hsl(var(--primary))",
            },
          })}
        />
      </div>
      <div className="md:hidden flex">
        <ConnectButton 
          client={thirdwebClient}
          appMetadata={metadata}
          connectButton={{ label }}
          wallets={wallets}
          connectModal={{ size: "compact" }}
          chain={pushChainDonut}
          chains={[pushChainDonut]}
          theme={darkTheme({
            colors: {
              primaryButtonBg: "hsl(var(--primary))",
            },
          })}
        />
      </div>
    </div>
  );
};

export default ConnectWallet;