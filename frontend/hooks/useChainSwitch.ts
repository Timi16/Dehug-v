"use client";

import { useCallback } from "react";
import { toast } from 'react-toastify'
import { useAccount } from "@/lib/thirdweb-hooks";

export const useChainSwitch = () => {
  const { isConnected } = useAccount();

  const isOnCorrectChain = undefined as unknown as boolean; // Unknown from UI Kit, assume user-managed

  const switchToLiskSepolia = useCallback(async () => {
    if (!isConnected) {
      toast.error("No wallet connected");
      return false;
    }

    try {
      toast.info("Please switch your wallet to Push Chain Donut Testnet (chain id 42101) and retry.");
      return true;
    } catch (error) {
      console.error("Failed to switch chain:", error);
      
      // Handle different error types
      if (error instanceof Error) {
        toast.error(`Failed to switch network: ${error.message}`);
      } else {
        toast.error("Failed to switch network");
      }
      
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const ensureCorrectChain = useCallback(async () => {
    if (!isConnected) {
      toast.warning("Please connect your wallet first");
      return false;
    }

    // Until UI Kit exposes network id, prompt user and proceed.
    return await switchToLiskSepolia();
  }, [isConnected, switchToLiskSepolia]);

  return {
    isOnCorrectChain,
    switchToLiskSepolia,
    ensureCorrectChain,
    currentChainId: undefined,
  };
};