"use client";

import { getContract, readContract } from "thirdweb";
import { useAccount } from "@/lib/thirdweb-hooks";
import { useEffect, useState, useCallback } from "react";
import { toast } from 'react-toastify';
import { useLoading } from "./useLoading";
import { thirdwebClient } from "@/app/client";
import { pushChainDonut  } from "@/constants/chain";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

interface ModelData {
  id: string;
  title: string;
  description: string;
  category: string;
  task: string;
  author: string;
  uploadDate: string;
  downloads: number;
  size: string;
  format: string;
  tags: string[];
  likes: number;
  verified: boolean;
  license: string;
  framework: string;
  nftValue: string;
  trending: boolean;
}

const useGetLatestModels = (limit: number = 10, maxFetch: number = 50) => {
  const { isConnected } = useAccount();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelData[]>([]);

  const fetchLatestModels = useCallback(async () => {
    if (limit <= 0) return;

    startLoading();
    setError(null);

    try {
      console.log('🔍 Fetching models from contract:', process.env.DEHUG_ADDRESS);
      
      const contract = getContract({
        client: thirdwebClient,
        chain: pushChainDonut,
        address: process.env.DEHUG_ADDRESS as string,
      });

      // STEP 1: Fetch latest token IDs
      console.log('📋 Step 1: Fetching latest token IDs...');
      let latestTokenIdsBigInt;
      try {
        latestTokenIdsBigInt = await readContract({
          contract,
          method: "function getLatestContent(uint256 _count) view returns (uint256[] memory)",
          params: [BigInt(maxFetch)],
        });
        
        console.log('✅ Step 1 Complete: Found token IDs:', latestTokenIdsBigInt);
      } catch (contractError: any) {
        console.error('❌ Step 1 Failed:', {
          message: contractError.message,
          code: contractError.code,
        });
        
        // Check if it's a zero data error (no content uploaded yet)
        if (contractError.message?.includes('zero data') || 
            contractError.message?.includes('0x') ||
            contractError.message?.includes('empty')) {
          console.log('ℹ️ No models found on blockchain yet');
          setModels([]);
          setError(null);
          return;
        }
        
        throw contractError;
      }

      // Check if response is empty
      if (!latestTokenIdsBigInt || latestTokenIdsBigInt.length === 0) {
        console.log('ℹ️ Contract returned empty array - no models uploaded yet');
        setModels([]);
        return;
      }

      const latestTokenIds = latestTokenIdsBigInt.map((id) => Number(id));
      console.log(`📊 Processing ${latestTokenIds.length} token IDs`);

      // STEP 2: Filter for models by fetching content individually
      console.log('🔍 Step 2: Filtering for models...');
      const modelTokenIds: number[] = [];
      
      for (const tokenId of latestTokenIds) {
        try {
          const contentResult = await readContract({
            contract,
            method: "function getContent(uint256 _tokenId) view returns (address uploader, uint8 contentType, string memory ipfsHash, string memory title, uint8 qualityTier, uint256 downloadCount, uint256 totalPointsEarned, uint256 uploadTimestamp, bool isActive)",
            params: [BigInt(tokenId)],
          });
          
          // contentResult[1] = contentType (0 = DATASET, 1 = MODEL)
          // contentResult[8] = isActive
          const contentType = contentResult[1];
          const isActive = contentResult[8];
          
          console.log(`  Token ${tokenId}: type=${contentType}, active=${isActive}`);
          
          // Only include active models (contentType === 1)
          if (contentType === 1 && isActive) {
            modelTokenIds.push(tokenId);
            console.log(`  ✅ Added model token ${tokenId}`);
            
            // Stop when we reach the limit
            if (modelTokenIds.length >= limit) {
              console.log(`  🎯 Reached limit of ${limit} models`);
              break;
            }
          }
        } catch (err) {
          console.log(`  ⚠️ Skipping token ${tokenId}:`, err);
          continue;
        }
      }

      console.log(`✅ Step 2 Complete: Found ${modelTokenIds.length} models`);

      if (modelTokenIds.length === 0) {
        console.log('ℹ️ No active models found (might be datasets only or all inactive)');
        setModels([]);
        return;
      }

      // STEP 3: Fetch full details for filtered models
      console.log('📦 Step 3: Fetching full model details...');
      const modelPromises = modelTokenIds.map(async (tid, index) => {
        try {
          console.log(`  Fetching details for model ${index + 1}/${modelTokenIds.length} (Token ID: ${tid})`);
          
          // Fetch content details
          const contentResult = await readContract({
            contract,
            method: "function getContent(uint256 _tokenId) view returns (address uploader, uint8 contentType, string memory ipfsHash, string memory title, uint8 qualityTier, uint256 downloadCount, uint256 totalPointsEarned, uint256 uploadTimestamp, bool isActive)",
            params: [BigInt(tid)],
          });

          // Fetch metadata URI
          const uri = await readContract({
            contract,
            method: "function uri(uint256) view returns (string memory)",
            params: [BigInt(tid)],
          });

          // Fetch metadata from IPFS
          let metadata: any = {};
          try {
            const metadataUrl = uri.replace("ipfs://", IPFS_GATEWAY);
            console.log(`    Fetching metadata from: ${metadataUrl}`);
            const response = await fetch(metadataUrl);
            if (response.ok) {
              metadata = await response.json();
              console.log(`    ✅ Metadata loaded for token ${tid}`);
            } else {
              console.log(`    ⚠️ Metadata fetch failed (${response.status})`);
            }
          } catch (fetchErr) {
            console.error(`    ❌ Failed to fetch metadata for token ${tid}:`, fetchErr);
          }

          const properties = metadata.properties || {};

          const model = {
            id: tid.toString(),
            title: contentResult[3],
            description: metadata.description || "No description available",
            category: properties.category || "Natural Language Processing",
            task: properties.task || "Text Generation",
            author: `${contentResult[0].slice(0, 6)}...${contentResult[0].slice(-4)}`,
            uploadDate: new Date(Number(contentResult[7]) * 1000).toISOString().split('T')[0],
            downloads: Number(contentResult[5]),
            size: properties.size || "Unknown",
            format: properties.format || "PyTorch",
            tags: properties.tags || [],
            likes: Math.floor(Number(contentResult[6]) / 10),
            verified: Number(contentResult[4]) >= 2, // SILVER tier or higher
            license: properties.license || "MIT",
            framework: properties.framework || "transformers",
            nftValue: `${(Number(contentResult[6]) / 1000).toFixed(1)} ETH`,
            trending: Number(contentResult[5]) > 1000,
          } as ModelData;

          console.log(`    ✅ Model ${index + 1} complete:`, model.title);
          return model;
        } catch (err) {
          console.error(`    ❌ Error processing token ${tid}:`, err);
          throw err;
        }
      });

      const fetchedModels = await Promise.all(modelPromises);
      console.log(`✅ Step 3 Complete: Successfully fetched ${fetchedModels.length} models`);
      console.log('🎉 All steps complete!');
      
      setModels(fetchedModels);
      toast.success(`Loaded ${fetchedModels.length} models`);
      
    } catch (err: any) {
      console.error("❌ Fatal error in fetchLatestModels:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      
      setError("Failed to fetch models from blockchain. Please check console for details.");
      toast.error("Error loading models");
    } finally {
      stopLoading();
    }
  }, [limit, maxFetch]);

  useEffect(() => {
    if (isConnected) {
      console.log('🚀 Wallet connected, fetching models...');
      fetchLatestModels();
    } else {
      console.log('⏸️ Wallet not connected');
    }
  }, [isConnected, fetchLatestModels]);

  return { models, isLoading, error, refetch: fetchLatestModels };
};

export default useGetLatestModels;