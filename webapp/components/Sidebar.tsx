"use client";

import { useState } from "react";
import { WalletButton } from "./WalletButton";
import type { TaskHistory } from "@/types";

interface SidebarProps {
  history: TaskHistory[];
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ history, isOpen, onToggle }: SidebarProps) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Command Center
            </h2>
            <button
              onClick={onToggle}
              className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
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
          </div>

          {/* Wallet Section */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Wallet
            </h3>
            <WalletButton />
          </div>

          {/* History Section */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              History
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tasks executed yet
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span
                        className={`text-xs font-medium ${
                          item.state === "success"
                            ? "text-green-600 dark:text-green-400"
                            : item.state === "error"
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {item.state}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white mb-1">
                      {item.intent}
                    </p>
                    {item.txHash && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                        {item.txHash.slice(0, 10)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

