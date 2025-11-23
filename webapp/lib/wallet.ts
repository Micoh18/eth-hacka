import { baseSepolia } from "viem/chains";
import { http } from "viem";
import { createConfig } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: "Command Center x402",
      preference: "smartWalletOnly", // <--- KEY: Force Smart Wallet
    }),
  ],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
  },
});

export { baseSepolia };

// Base Sepolia USDC address (for testing)
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Base Mainnet USDC address (for production)
export const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

