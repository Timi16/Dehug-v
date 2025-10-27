"use client";

import { useEffect, useState } from "react";
import { PushUniversalAccountButton, PushUI, usePushWalletContext } from '@pushchain/ui-kit';

interface ConnectWalletProps {
  onConnect?: () => void;
  label?: string;
}

const ConnectWallet = ({ onConnect, label = "Connect Wallet" }: ConnectWalletProps) => {
  const [mounted, setMounted] = useState(false);
  const { connectionStatus } = usePushWalletContext();
  const [wasConnected, setWasConnected] = useState(false);
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
    const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
    if (isConnected && !wasConnected && onConnect) {
      onConnect();
    }
    setWasConnected(isConnected);
  }, [connectionStatus, wasConnected, onConnect]);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-3 justify-end self-end">
      <div className="flex">
        <PushUniversalAccountButton />
      </div>
    </div>
  );
};

export default ConnectWallet;