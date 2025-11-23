/**
 * Agent Payment Handler - x402 Protocol Implementation
 * 
 * Uses the Agent's private key to execute ETH payments autonomously.
 * The agent wallet must have ETH to send payments.
 */

import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// USDC Contract Addresses
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// USDC ABI (minimal - only what we need)
const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
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
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Get USDC contract address based on chain
 */
export function getUSDCAddress(): `0x${string}` {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "84532";
  return (chainId === "8453" ? BASE_MAINNET_USDC : BASE_SEPOLIA_USDC) as `0x${string}`;
}

/**
 * Check USDC balance of an address
 */
export async function checkUSDCBalance(address: `0x${string}`): Promise<string> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
  });

  const usdcAddress = getUSDCAddress();
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  return formatUnits(balance, 6); // USDC has 6 decimals
}

/**
 * Check ETH balance of an address
 */
export async function checkETHBalance(address: `0x${string}`): Promise<string> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
  });

  const balance = await publicClient.getBalance({ address });
  return formatUnits(balance, 18); // ETH has 18 decimals
}

/**
 * Execute payment using Agent's private key
 * The agent sends ETH directly from user's wallet to machine
 * 
 * @param userAddress - The user's wallet address (who will pay)
 * @param machineAddress - The machine/vendor address (recipient)
 * @param amountETH - Amount in ETH (string, e.g., "0.002")
 * @returns Transaction hash
 */
export async function executeAgentPayment(
  userAddress: `0x${string}`,
  machineAddress: `0x${string}`,
  amountETH: string
): Promise<`0x${string}`> {
  const agentPrivateKey = process.env.NEXT_PUBLIC_AGENT_PRIVATE_KEY;
  
  if (!agentPrivateKey) {
    throw new Error(
      "Agent private key not configured. Please set NEXT_PUBLIC_AGENT_PRIVATE_KEY in .env.local"
    );
  }

  // Remove 0x prefix if present
  const cleanKey = agentPrivateKey.startsWith("0x") 
    ? agentPrivateKey.slice(2) 
    : agentPrivateKey;

  // Create agent account from private key
  const agentAccount = privateKeyToAccount(`0x${cleanKey}` as `0x${string}`);

  // Create wallet and public clients for the agent
  const agentClient = createWalletClient({
    account: agentAccount,
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
  });

  const amount = parseUnits(amountETH, 18); // ETH has 18 decimals

  console.log("[Agent Payment] Executing ETH transfer:", {
    from: userAddress,
    to: machineAddress,
    amount: amountETH,
    agent: agentAccount.address,
  });

  // Check agent's ETH balance (agent needs ETH to send payments autonomously)
  try {
    const agentBalance = await checkETHBalance(agentAccount.address);
    const agentBalanceNum = parseFloat(agentBalance);
    const amountNum = parseFloat(amountETH);
    
    // Reserve some ETH for gas (estimate ~0.0001 ETH per transaction)
    const gasReserve = 0.0001;
    const requiredTotal = amountNum + gasReserve;
    
    console.log("[Agent Payment] Agent balance check:", {
      agentWallet: agentAccount.address,
      balance: agentBalance,
      required: amountETH,
      requiredWithGas: requiredTotal.toFixed(6),
      sufficient: agentBalanceNum >= requiredTotal,
    });

    if (agentBalanceNum < requiredTotal) {
      throw new Error(
        `Insufficient ETH in agent wallet. Agent has ${agentBalance} ETH but needs ${requiredTotal.toFixed(6)} ETH (${amountETH} + ~${gasReserve} for gas). ` +
        `Please send ETH to the agent wallet: ${agentAccount.address}`
      );
    }
  } catch (balanceError: any) {
    // If it's our custom error, throw it
    if (balanceError.message?.includes("Insufficient ETH")) {
      throw balanceError;
    }
    // If balance check fails for other reasons, still try the transfer (might be a network issue)
    console.warn("[Agent Payment] Balance check failed, proceeding anyway:", balanceError.message);
  }

  try {
    // Agent sends ETH from its own wallet (autonomous - no user signature needed)
    // IMPORTANT: The agent wallet must have ETH to send payments
    // The user should send ETH to the agent wallet first, or the agent wallet should be funded
    
    console.log("[Agent Payment] Agent wallet sending ETH:", {
      agentWallet: agentAccount.address,
      to: machineAddress,
      amount: amountETH,
    });
    
    // Agent sends ETH directly from its wallet
    const hash = await agentClient.sendTransaction({
      to: machineAddress,
      value: amount,
    });

    console.log("[Agent Payment] ✅ Payment executed! TX:", hash);
    return hash;
  } catch (error: any) {
    console.error("[Agent Payment] ❌ Error:", error);
    
    // Provide helpful error messages
    if (error.message?.includes("insufficient funds") || 
        error.message?.includes("exceeds balance")) {
      throw new Error(
        `Insufficient ETH balance in agent wallet. The agent wallet (${agentAccount.address}) doesn't have enough ETH. ` +
        `Please send ETH to the agent wallet to enable autonomous payments.`
      );
    }
    
    throw new Error(`Payment failed: ${error.message || "Unknown error"}`);
  }
}

/**
 * Get agent address from private key (for display/verification)
 */
export function getAgentAddress(): string | null {
  const agentPrivateKey = process.env.NEXT_PUBLIC_AGENT_PRIVATE_KEY;
  
  if (!agentPrivateKey) {
    return null;
  }

  try {
    const cleanKey = agentPrivateKey.startsWith("0x") 
      ? agentPrivateKey.slice(2) 
      : agentPrivateKey;
    
    const agentAccount = privateKeyToAccount(`0x${cleanKey}` as `0x${string}`);
    return agentAccount.address;
  } catch {
    return null;
  }
}

