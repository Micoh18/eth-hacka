"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { getUSDCAddress, getAgentAddress } from "@/lib/agent-payment";
import { Shield, CheckCircle2, Loader2 } from "lucide-react";

const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface AuthorizeAgentButtonProps {
  dailyLimit?: number; // in ETH, will be converted to USDC
  onAuthorized?: () => void;
}

export function AuthorizeAgentButton({
  dailyLimit = 0.1,
  onAuthorized,
}: AuthorizeAgentButtonProps) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const agentAddress = getAgentAddress();

  const handleApprove = () => {
    if (!address || !agentAddress) {
      alert("Please connect your wallet and configure agent address");
      return;
    }

    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    // Convert ETH limit to USDC (assuming 1 ETH = 2500 USDC)
    const usdcAmount = dailyLimit * 2500;
    const usdcAddress = getUSDCAddress();

    console.log("[AuthorizeAgent] Approving:", {
      spender: agentAddress,
      amount: usdcAmount,
      usdcAddress,
    });

    writeContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "approve",
      args: [agentAddress as `0x${string}`, parseUnits(usdcAmount.toString(), 6)],
    });
  };

  // Call onAuthorized when transaction succeeds
  if (isSuccess && onAuthorized) {
    setTimeout(() => onAuthorized(), 100);
  }

  if (!agentAddress) {
    return (
      <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-300">
        ⚠️ Agent address not configured. Set NEXT_PUBLIC_AGENT_PRIVATE_KEY
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl text-sm text-green-300">
        <CheckCircle2 size={16} />
        <span>Agent Authorized ✓</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleApprove}
      disabled={!isConnected || isPending || isConfirming}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm text-indigo-300 hover:text-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending || isConfirming ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Authorizing...</span>
        </>
      ) : (
        <>
          <Shield size={16} />
          <span>1. Authorize Agent (Metamask 🦊)</span>
        </>
      )}
    </button>
  );
}

