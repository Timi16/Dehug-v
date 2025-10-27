"use client";

import { useCallback } from "react";
import { toast } from 'react-toastify';
import { useChainId, useAccount } from "../../lib/thirdweb-hooks";
import { useChainSwitch } from "../useChainSwitch";
import { usePushChainClient } from '@pushchain/ui-kit';
import { pushChainDonut  } from "@/constants/chain";
import { ethers } from 'ethers';

type ErrorWithReason = {
  reason?: string;
  message?: string;
};

const useUpdateDownloadCount = () => {
    const chainId = useChainId();
    const { address, isConnected } = useAccount();
    const { ensureCorrectChain } = useChainSwitch();
    const { pushChainClient } = usePushChainClient();

    return useCallback(
        async (tokenId: number, downloadCount: number) => {
            if (!isConnected || !address) {
                toast.warning("Please connect your wallet first.");
                return false;
            }

            if (!isConnected) {
                toast.warning("Please connect your wallet first.");
                return false;
            }
            
            const isCorrectChain = await ensureCorrectChain();
            if (!isCorrectChain) {
                return false;
            }

            if (tokenId <= 0 || downloadCount <= 0) {
                toast.error("Invalid token ID or download count.");
                return false;
            }

            try {
                const contractAddress = process.env.NEXT_PUBLIC_DEHUG_ADDRESS || process.env.DEHUG_ADDRESS as string;
                if (!contractAddress) {
                  toast.error("Contract address not configured. Please add DEHUG_ADDRESS to .env");
                  return false;
                }

                const iface = new ethers.Interface([
                  "function updateDownloadCount(uint256 _tokenId, uint256 _downloadCount)"
                ]);
                const data = iface.encodeFunctionData("updateDownloadCount", [
                  BigInt(tokenId),
                  BigInt(downloadCount)
                ]);

                if (!pushChainClient) {
                  throw new Error("Push Chain client not initialized");
                }

                toast.info("Updating download count...");
                const sendRes = await (pushChainClient as any).universal.sendTransaction({
                  to: contractAddress,
                  data,
                });
                const txHash = sendRes?.hash as `0x${string}`;
                if (!txHash) throw new Error("No transaction hash returned");

                const provider = new ethers.JsonRpcProvider((pushChainDonut as any).rpc as string);
                await provider.waitForTransaction(txHash);

                toast.success("Download count updated successfully!");
                return {
                  success: true,
                  transactionHash: txHash,
                };
            } catch (error) {
                const err = error as ErrorWithReason;
                let errorMessage = "An error occurred while updating download count.";
                
                if (err.reason === "Token does not exist") {
                    errorMessage = "Content not found.";
                } else if (err.reason === "Content is not active") {
                    errorMessage = "Content is no longer active.";
                } else if (err.reason === "Not owner") {
                    errorMessage = "Only the content owner can update download count.";
                }
                
                toast.error(errorMessage);
                console.error("Update download count error:", error);
                return false;
            }
        },
        [chainId, isConnected, address, ensureCorrectChain, pushChainClient]
    );
};

export default useUpdateDownloadCount;