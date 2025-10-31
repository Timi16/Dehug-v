import { useCallback } from "react";
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';

// Types for better type safety
interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
}

interface TypedDataField {
  name: string;
  type: string;
}

interface TypedDataMessage {
  [key: string]: unknown;
}

interface TypedDataPayload {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  primaryType: string;
  message: TypedDataMessage;
}

// Custom hook to mimic useAccount
export const useAccount = () => {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const address = pushChainClient?.universal?.account as string | undefined;

  return {
    address,
    isConnected: connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED,
    account: address ? ({ address } as unknown) : undefined,
  };
};

// Custom hook to mimic useChainId
export const useChainId = () => {
  // Push UI Kit does not expose numeric EVM chainId directly in docs.
  // Return undefined for now; callers should rely on ensureCorrectChain.
  return undefined as number | undefined;
};

// Custom hook to mimic useSignMessage
export const useSignMessage = () => {
  const { pushChainClient } = usePushChainClient();

  const signMessageAsync = useCallback(async (message: string) => {
    if (!pushChainClient) throw new Error("No wallet connected");
    const signer = (pushChainClient as any)?.universal;
    if (signer && typeof signer.signMessage === 'function') {
      return await signer.signMessage(message);
    }
    throw new Error("signMessage not supported by current wallet");
  }, [pushChainClient]);

  return { signMessageAsync };
};

// Custom hook to mimic useSignTypedData - Fixed version
export const useSignTypedData = () => {
  const { pushChainClient } = usePushChainClient();

  const signTypedDataAsync = useCallback(async (typedData: TypedDataPayload) => {
    if (!pushChainClient) throw new Error("No wallet connected");
    const signer = (pushChainClient as any)?.universal;
    if (signer && typeof signer.signTypedData === 'function') {
      return await signer.signTypedData(typedData);
    }
    throw new Error('signTypedData not supported by current wallet');
  }, [pushChainClient]);

  return { signTypedDataAsync };
};

// Custom hook to mimic useAppKitProvider
export const useAppKitProvider = () => {
  const { pushChainClient } = usePushChainClient();
  return { walletProvider: pushChainClient } as unknown as { walletProvider: unknown };
};

// Utility function to check if wallet supports a method
export const walletSupports = (wallet: never, method: string): boolean => {
  return wallet && method in wallet && typeof wallet[method] === 'function';
};