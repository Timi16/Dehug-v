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

      // Fetch latest token IDs with better error handling
      let latestTokenIdsBigInt;
      try {
        latestTokenIdsBigInt = await readContract({
          contract,
          method: "function getLatestContent(uint256 _count) view returns (uint256[] memory)",
          params: [BigInt(maxFetch)],
        });
        
        console.log('✅ Raw contract response:', latestTokenIdsBigInt);
      } catch (contractError: any) {
        console.error('❌ Contract call failed:', {
          message: contractError.message,
          code: contractError.code,
          data: contractError.data,
        });
        
        // Check if it's a zero data error (no content uploaded yet)
        if (contractError.message?.includes('zero data') || contractError.message?.includes('0x')) {
          console.log('ℹ️ No datasets found on blockchain yet');
          setDatasets([]);
          setError(null); // Clear error since this is expected for empty contract
          return;
        }
        
        throw contractError; // Re-throw if it's a different error
      }

      // Check if response is empty or null
      if (!latestTokenIdsBigInt || latestTokenIdsBigInt.length === 0) {
        console.log('ℹ️ Contract returned empty array - no datasets uploaded yet');
        setDatasets([]);
        return;
      }

      const latestTokenIds = latestTokenIdsBigInt.map((id) => Number(id));
      console.log('📊 Found token IDs:', latestTokenIds);

      // Fetch batch content data
      const batchResult = await readContract({
        contract,
        method: "function getContentBatch(uint256[] calldata _tokenIds) view returns (address[] memory uploaders, uint8[] memory contentTypes, string[] memory ipfsHashes, string[] memory titles, uint8[] memory qualityTiers, uint256[] memory downloadCounts, bool[] memory isActiveList)",
        params: [latestTokenIds.map(BigInt)],
      });

      // Filter for datasets (contentType == 0)
      const datasetTokenIds: number[] = [];
      for (let i = 0; i < batchResult[1].length; i++) {
        if (batchResult[1][i] === 0 && batchResult[6][i]) { // contentType == 0 (DATASET) and isActive
          datasetTokenIds.push(latestTokenIds[i]);
          if (datasetTokenIds.length === limit) break;
        }
      }

      if (datasetTokenIds.length === 0) {
        console.log('ℹ️ No active datasets found (might be models only)');
        setDatasets([]);
        return;
      }

      console.log('🎯 Filtered dataset token IDs:', datasetTokenIds);

      // Fetch full details for filtered datasets
      const datasetPromises = datasetTokenIds.map(async (tid) => {
        const contentResult = await readContract({
          contract,
          method: "function getContent(uint256 _tokenId) view returns (address uploader, uint8 contentType, string memory ipfsHash, string memory title, uint8 qualityTier, uint256 downloadCount, uint256 totalPointsEarned, uint256 uploadTimestamp, bool isActive)",
          params: [BigInt(tid)],
        });

        const uri = await readContract({
          contract,
          method: "function uri(uint256) view returns (string memory)",
          params: [BigInt(tid)],
        });

        let metadata: any = {};
        try {
          const metadataUrl = uri.replace("ipfs://", IPFS_GATEWAY);
          const response = await fetch(metadataUrl);
          if (response.ok) {
            metadata = await response.json();
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch metadata for token ${tid}:`, fetchErr);
        }

        const properties = metadata.properties || {};

        return {
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
          verified: Number(contentResult[4]) === 2,
          license: properties.license || "MIT",
          framework: properties.framework || "",
          nftValue: `${(Number(contentResult[6]) / 1000).toFixed(1)} ETH`,
          trending: Number(contentResult[5]) > 1000,
        } as DatasetData;
      });

      const fetchedDatasets = await Promise.all(datasetPromises);
      console.log('✨ Successfully fetched datasets:', fetchedDatasets.length);
      setDatasets(fetchedDatasets);
    } catch (err: any) {
      console.error("❌ Error fetching latest datasets:", err);
      setError("Failed to fetch datasets from blockchain. The contract might be empty or on a different network.");
      toast.error("Error fetching datasets");
    } finally {
      stopLoading();
    }
  }, [limit, maxFetch]);

  useEffect(() => {
    if (isConnected) {
      fetchLatestDatasets();
    }
  }, [isConnected, fetchLatestDatasets]);

  return { datasets, isLoading, error, refetch: fetchLatestDatasets };
};

export default useGetLatestDatasets;