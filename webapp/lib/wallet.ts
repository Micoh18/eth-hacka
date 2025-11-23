import { baseSepolia } from "viem/chains";
import { http } from "viem";
import { createConfig } from "wagmi";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
  },
});

export { baseSepolia };

