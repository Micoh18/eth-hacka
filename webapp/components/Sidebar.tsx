"use client";

import { useState } from "react";
import { WalletButton } from "./WalletButton";
import type { TaskHistory } from "@/types";

interface SidebarProps {
  history: TaskHistory[];
  isOpen: boolean;
  onToggle: () => void;
  walletButton?: React.ReactNode;
}

export function Sidebar({ history, isOpen, onToggle, walletButton }: SidebarProps) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar - Minimalista */}
      <aside
        className={`fixed left-0 top-0 h-full w-20 bg-black/40 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full p-4">
          {/* Toggle button mobile */}
          <button
            onClick={onToggle}
            className="lg:hidden mb-6 text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Wallet Section */}
          {walletButton && (
            <div className="mb-6 pb-6 border-b border-white/10">
              {walletButton}
            </div>
          )}

          {/* History Section - Icon only */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center gap-4">
              {history.length === 0 ? (
                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-zinc-600 mt-2 hidden lg:block">Empty</p>
                </div>
              ) : (
                history.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    className="group relative w-10 h-10 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all flex items-center justify-center"
                    title={item.intent}
                  >
                    {item.state === "success" ? (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    ) : item.state === "error" ? (
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-zinc-500" />
                    )}
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-black/90 backdrop-blur-sm border border-white/10 rounded text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {item.intent}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

