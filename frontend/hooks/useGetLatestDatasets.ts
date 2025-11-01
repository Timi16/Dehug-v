"use client";

import { getContract, readContract } from "thirdweb";
import { useAccount } from "@/lib/thirdweb-hooks";
import { useEffect, useState, useCallback } from "react";
import { toast } from 'react-toastify';
import { useLoading } from "./useLoading";
import { thirdwebClient } from "@/app/client";
import { pushChainDonut  } from "@/constants/chain";

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

interface DatasetData {
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

const useGetLatestDatasets = (limit: number = 10, maxFetch: number = 50) => {
  const { isConnected } = useAccount();
  const { isLoading, startLoading, stopLoading } = useLoading();
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetData[]>([]);

  const fetchLatestDatasets = useCallback(async () => {
    if (limit <= 0) return;

    startLoading();
    setError(null);

    try {
      console.log('🔍 Fetching datasets from contract:', process.env.DEHUG_ADDRESS);
      
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
          console.log('ℹ️ No datasets found on blockchain yet');
          setDatasets([]);
          setError(null);
          return;
        }
        
        throw contractError;
      }

      // Check if response is empty
      if (!latestTokenIdsBigInt || latestTokenIdsBigInt.length === 0) {
        console.log('ℹ️ Contract returned empty array - no datasets uploaded yet');
        setDatasets([]);
        return;
      }

      const latestTokenIds = latestTokenIdsBigInt.map((id) => Number(id));
      console.log(`📊 Processing ${latestTokenIds.length} token IDs`);

      // STEP 2: Filter for datasets by fetching content individually
      console.log('🔍 Step 2: Filtering for datasets...');
      const datasetTokenIds: number[] = [];
      
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
          
          // Only include active datasets (contentType === 0)
          if (contentType === 0 && isActive) {
            datasetTokenIds.push(tokenId);
            console.log(`  ✅ Added dataset token ${tokenId}`);
            
            // Stop when we reach the limit
            if (datasetTokenIds.length >= limit) {
              console.log(`  🎯 Reached limit of ${limit} datasets`);
              break;
            }
          }
        } catch (err) {
          console.log(`  ⚠️ Skipping token ${tokenId}:`, err);
          continue;
        }
      }

      console.log(`✅ Step 2 Complete: Found ${datasetTokenIds.length} datasets`);

      if (datasetTokenIds.length === 0) {
        console.log('ℹ️ No active datasets found (might be models only or all inactive)');
        setDatasets([]);
        return;
      }

      // STEP 3: Fetch full details for filtered datasets
      console.log('📦 Step 3: Fetching full dataset details...');
      const datasetPromises = datasetTokenIds.map(async (tid, index) => {
        try {
          console.log(`  Fetching details for dataset ${index + 1}/${datasetTokenIds.length} (Token ID: ${tid})`);
          
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

          const dataset = {
            id: tid.toString(),
            title: contentResult[3],
            description: metadata.description || "No description available",
            category: properties.category || "Data Processing",
            task: properties.task || "Dataset",
            author: `${contentResult[0].slice(0, 6)}...${contentResult[0].slice(-4)}`,
            uploadDate: new Date(Number(contentResult[7]) * 1000).toISOString().split('T')[0],
            downloads: Number(contentResult[5]),
            size: properties.size || "Unknown",
            format: properties.format || "CSV",
            tags: properties.tags || [],
            likes: Math.floor(Number(contentResult[6]) / 10),
            verified: Number(contentResult[4]) >= 2, // SILVER tier or higher
            license: properties.license || "MIT",
            framework: properties.framework || "",
            nftValue: `${(Number(contentResult[6]) / 1000).toFixed(1)} ETH`,
            trending: Number(contentResult[5]) > 1000,
          } as DatasetData;

          console.log(`    ✅ Dataset ${index + 1} complete:`, dataset.title);
          return dataset;
        } catch (err) {
          console.error(`    ❌ Error processing token ${tid}:`, err);
          throw err; // Re-throw to be caught by Promise.all
        }
      });

      const fetchedDatasets = await Promise.all(datasetPromises);
      console.log(`✅ Step 3 Complete: Successfully fetched ${fetchedDatasets.length} datasets`);
      console.log('🎉 All steps complete!');
      
      setDatasets(fetchedDatasets);
      toast.success(`Loaded ${fetchedDatasets.length} datasets`);
      
    } catch (err: any) {
      console.error("❌ Fatal error in fetchLatestDatasets:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      
      setError("Failed to fetch datasets from blockchain. Please check console for details.");
      toast.error("Error loading datasets");
    } finally {
      stopLoading();
    }
  }, [limit, maxFetch]);

  useEffect(() => {
    if (isConnected) {
      console.log('🚀 Wallet connected, fetching datasets...');
      fetchLatestDatasets();
    } else {
      console.log('⏸️ Wallet not connected');
    }
  }, [isConnected, fetchLatestDatasets]);

  return { datasets, isLoading, error, refetch: fetchLatestDatasets };
};

export default useGetLatestDatasets;