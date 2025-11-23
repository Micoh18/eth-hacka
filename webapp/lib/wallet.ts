import { sepolia } from "viem/chains";
import { http } from "viem";
import { createConfig } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    coinbaseWallet({
      appName: "Command Center x402",
      preference: "smartWalletOnly", // <--- KEY: Force Smart Wallet
    }),
  ],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
});

export { sepolia };

// Ethereum Sepolia USDC address (for testing - if needed)
export const ETH_SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Ethereum Mainnet USDC address (for production)
export const ETH_MAINNET_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

