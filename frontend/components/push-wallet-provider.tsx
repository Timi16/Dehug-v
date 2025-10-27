"use client";

import { PropsWithChildren } from "react";
import { PushUniversalWalletProvider, PushUI } from "@pushchain/ui-kit";

export default function PushWalletProvider({ children }: PropsWithChildren) {
  const walletConfig = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  } as const;

  return (
    <PushUniversalWalletProvider config={walletConfig}>
      {children}
    </PushUniversalWalletProvider>
  );
}
