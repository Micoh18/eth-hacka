"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { baseSepolia } from "viem/chains";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  if (isConnected && address) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Connected
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        {balance && (
          <div className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">
            {Number(balance.formatted).toFixed(4)} ETH
          </div>
        )}
        <button
          onClick={() => disconnect()}
          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors text-sm font-medium"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}

