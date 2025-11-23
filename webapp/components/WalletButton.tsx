"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { sepolia } from "viem/chains";
import { useEffect, useState } from "react";

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    chainId: sepolia.id,
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
    return (
      <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-full pl-2 pr-4 py-1.5 shadow-xl hover:border-indigo-500/30 transition-colors cursor-pointer group">
        {/* Avatar / Status */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
        </div>
        
        {/* Info en una línea con separador visual */}
        <div className="flex items-center gap-3">
          <span className="text-white font-medium tracking-wide text-sm font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          {balance && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <span className="text-zinc-500 text-xs tabular-nums">
                {Number(balance.formatted).toFixed(3)} ETH
              </span>
            </>
          )}
        </div>
        
        {/* Disconnect button - aparece en hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            disconnect();
          }}
          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-200"
          title="Disconnect"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
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

