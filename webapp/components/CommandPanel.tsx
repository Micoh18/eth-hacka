"use client";

import { useRef, useEffect } from "react";
import { CommandInput } from "./CommandInput";
import { AgentMessage } from "./AgentMessage";
import type { TaskHistory } from "@/types";

interface CommandPanelProps {
  onExecute: (command: string) => void;
  chatMessage?: string;
  history: TaskHistory[];
  disabled?: boolean;
}

export function CommandPanel({ onExecute, chatMessage, history, disabled }: CommandPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessage, history]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-mono font-medium text-white uppercase tracking-wider">
          Command Interface
        </h2>
      </div>

      {/* Scrollable Content Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Chat Message */}
        {chatMessage && (
          <div className="mb-4">
            <AgentMessage message={chatMessage} />
          </div>
        )}

        {/* History (Simplified - Log Style) */}
        {history.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-2">
              Transaction History
            </div>
            {history.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded text-xs font-mono"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-400 truncate flex-1">{item.intent}</span>
                  <span
                    className={`ml-2 ${
                      item.state === "success"
                        ? "text-success"
                        : item.state === "error"
                        ? "text-error"
                        : "text-zinc-500"
                    }`}
                  >
                    {item.state === "success" ? "[OK]" : item.state === "error" ? "[ERR]" : "[...]"}
                  </span>
                </div>
                {item.txHash && (
                  <div className="text-zinc-600 text-xs mt-1">
                    TX: {item.txHash.slice(0, 10)}...{item.txHash.slice(-8)}
                  </div>
                )}
                <div className="text-zinc-700 text-xs mt-1">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!chatMessage && history.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-zinc-600 font-mono text-sm mb-2">
                No activity
              </div>
              <div className="text-zinc-700 text-xs">
                Enter a command below to start
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area (Fixed at Bottom) */}
      <div className="border-t border-zinc-800 p-4">
        <CommandInput onExecute={onExecute} disabled={disabled} />
      </div>
    </div>
  );
}

