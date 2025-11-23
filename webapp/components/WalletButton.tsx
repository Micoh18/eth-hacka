"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { baseSepolia } from "viem/chains";
import { useEffect, useState } from "react";

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a placeholder during SSR to match initial client render
  if (!mounted) {
    return (
      <div className="flex flex-col gap-2">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
      </div>
    );
  }

  if (isConnected && address) {
    // Generate a simple blockie-like pattern from address
    const blockieColor = `#${address.slice(2, 8)}`;
    
    return (
      <div className="group relative">
        <div className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl hover:border-indigo-500/50 transition-all">
          {/* Status dot */}
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
          </div>
          
          {/* Address */}
          <span className="text-xs text-zinc-300 font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          
          {/* Balance */}
          {balance && (
            <span className="text-xs text-zinc-500 tabular-nums ml-1">
              {Number(balance.formatted).toFixed(3)} ETH
            </span>
          )}
          
          {/* Disconnect button - aparece en hover */}
          <button
            onClick={() => disconnect()}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-200"
            title="Disconnect"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 hover:border-indigo-500/50 transition-all text-sm font-medium text-white"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}

