/**
 * Agent Payment Handler - x402 Protocol Implementation
 * 
 * Uses the Agent's private key to execute ETH payments autonomously.
 * The agent wallet must have ETH to send payments.
 */

import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// RPC URLs for Ethereum Sepolia (with fallbacks)
const ETH_SEPOLIA_RPC_URLS = [
  process.env.NEXT_PUBLIC_RPC_URL, // User's custom RPC (if set)
  "https://ethereum-sepolia-rpc.publicnode.com", // Public node (usually faster)
  "https://rpc.sepolia.org", // Fallback
  "https://sepolia.gateway.tenderly.co", // Another fallback
].filter(Boolean) as string[];

// USDC Contract Addresses (for reference, currently using ETH native)
const ETH_SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const ETH_MAINNET_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

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
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "11155111";
  return (chainId === "1" ? ETH_MAINNET_USDC : ETH_SEPOLIA_USDC) as `0x${string}`;
}

/**
 * Check USDC balance of an address
 */
export async function checkUSDCBalance(address: `0x${string}`): Promise<string> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org"),
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
  // Force Ethereum Sepolia RPC URL (not Base Sepolia)
  let rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || ETH_SEPOLIA_RPC_URLS[0];
  if (rpcUrl.includes("base.org") || rpcUrl.includes("base-sepolia")) {
    rpcUrl = ETH_SEPOLIA_RPC_URLS[0];
  }

  // Try with timeout and retry logic
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl, {
      timeout: 30000, // 30 seconds timeout
      retryCount: 2, // Retry up to 2 times
    }),
  });

  try {
    const balance = await publicClient.getBalance({ address });
    return formatUnits(balance, 18); // ETH has 18 decimals
  } catch (error: any) {
    // If timeout, try fallback RPCs
    if (error.message?.includes("timeout") || error.message?.includes("took too long")) {
      console.warn(`[Agent Payment] RPC ${rpcUrl} timed out, trying fallback...`);
      
      for (const fallbackUrl of ETH_SEPOLIA_RPC_URLS.slice(1)) {
        if (fallbackUrl === rpcUrl) continue; // Skip the one we just tried
        
        try {
          const fallbackClient = createPublicClient({
            chain: sepolia,
            transport: http(fallbackUrl, {
              timeout: 30000,
              retryCount: 1,
            }),
          });
          const balance = await fallbackClient.getBalance({ address });
          console.log(`[Agent Payment] Fallback RPC ${fallbackUrl} succeeded`);
          return formatUnits(balance, 18);
        } catch (fallbackError) {
          console.warn(`[Agent Payment] Fallback RPC ${fallbackUrl} also failed:`, fallbackError);
          continue;
        }
      }
    }
    throw error;
  }
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

  // Force Ethereum Sepolia RPC URL (not Base Sepolia)
  // We're using Ethereum Sepolia chain, so we must use Ethereum Sepolia RPC
  let rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || ETH_SEPOLIA_RPC_URLS[0];
  
  // If the RPC URL is for Base Sepolia, override it with Ethereum Sepolia
  if (rpcUrl.includes("base.org") || rpcUrl.includes("base-sepolia")) {
    console.warn("[Agent Payment] RPC URL is Base Sepolia, but we need Ethereum Sepolia. Overriding with Ethereum Sepolia RPC.");
    rpcUrl = ETH_SEPOLIA_RPC_URLS[0];
  }

  // Helper function to create clients with a specific RPC URL
  const createClientsWithRpc = (url: string) => {
    const transport = http(url, {
      timeout: 30000, // 30 seconds timeout
      retryCount: 2, // Retry up to 2 times
    });
    
    return {
      agentClient: createWalletClient({
        account: agentAccount,
        chain: sepolia,
        transport,
      }),
      publicClient: createPublicClient({
        chain: sepolia,
        transport,
      }),
    };
  };

  // Create wallet and public clients for the agent with timeout and retry
  let { agentClient, publicClient } = createClientsWithRpc(rpcUrl);

  const amount = parseUnits(amountETH, 18); // ETH has 18 decimals

  console.log("[Agent Payment] Executing ETH transfer:", {
    from: agentAccount.address,
    to: machineAddress,
    amount: amountETH,
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
    
    // If timeout, try fallback RPCs
    if (error.message?.includes("timeout") || error.message?.includes("took too long")) {
      console.warn(`[Agent Payment] RPC ${rpcUrl} timed out, trying fallback RPCs...`);
      
      for (const fallbackUrl of ETH_SEPOLIA_RPC_URLS.slice(1)) {
        if (fallbackUrl === rpcUrl) continue; // Skip the one we just tried
        
        try {
          console.log(`[Agent Payment] Trying fallback RPC: ${fallbackUrl}`);
          const { agentClient: fallbackAgentClient } = createClientsWithRpc(fallbackUrl);
          
          const hash = await fallbackAgentClient.sendTransaction({
            to: machineAddress,
            value: amount,
          });
          
          console.log(`[Agent Payment] ✅ Payment executed via fallback RPC! TX:`, hash);
          return hash;
        } catch (fallbackError: any) {
          console.warn(`[Agent Payment] Fallback RPC ${fallbackUrl} also failed:`, fallbackError.message);
          continue;
        }
      }
      
      throw new Error(
        `Payment failed: All RPC endpoints timed out. Please check your internet connection or try again later. ` +
        `If the problem persists, consider using a private RPC endpoint (Infura, Alchemy, etc.) by setting NEXT_PUBLIC_RPC_URL in .env.local`
      );
    }
    
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

