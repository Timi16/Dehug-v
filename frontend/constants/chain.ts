import { defineChain } from "thirdweb";

// Define Push Chain Donut Testnet
export const pushChainDonut = defineChain({
  id: 42101,
  name: "Push Chain Donut Testnet",
  nativeCurrency: {
    name: "Push Chain",
    symbol: "PC",
    decimals: 18,
  },
  rpc: "https://evm.rpc-testnet-donut-node1.push.org",
  blockExplorers: [
    {
      name: "Push Scan",
      url: "https://donut.push.network",
    },
  ],
  testnet: true,
});

export const SUPPORTED_CHAIN_ID = 42101;

export const isSupportedChain = (
  chainId: number | undefined
): chainId is number =>
  chainId !== undefined && Number(chainId) === SUPPORTED_CHAIN_ID;