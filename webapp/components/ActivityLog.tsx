"use client";

import { CheckCircle2, Loader2, AlertCircle, CreditCard, ArrowRight } from "lucide-react";
import Image from "next/image";
import type { ActivityStep } from "@/types";

interface ActivityLogProps {
  steps: ActivityStep[];
  onSignTransaction?: () => void;
  isAutoSigning?: boolean;
}

const statusIcons: Record<ActivityStep['status'], typeof CheckCircle2> = {
  pending: Loader2,
  running: Loader2,
  success: CheckCircle2,
  error: AlertCircle,
  payment_required: CreditCard,
};

const statusLabels: Record<ActivityStep['status'], string> = {
  pending: "[ .. ]",
  running: "[ .. ]",
  success: "[ OK ]",
  error: "[ERROR]",
  payment_required: "[ ⚡ ]",
};

const statusColors: Record<ActivityStep['status'], string> = {
  pending: "text-zinc-500",
  running: "text-system",
  success: "text-success",
  error: "text-error",
  payment_required: "text-warning",
};

export function ActivityLog({ steps, onSignTransaction, isAutoSigning }: ActivityLogProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md font-mono text-xs p-4 shadow-2xl max-w-2xl">
      <div className="flex justify-between items-center mb-3 text-zinc-500 border-b border-zinc-900 pb-2">
        <span className="text-xs uppercase tracking-wider">SYSTEM_OUTPUT</span>
        <span className="text-xs">v1.0.2</span>
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const Icon = statusIcons[step.status];
          const label = statusLabels[step.status];
          const color = statusColors[step.status];
          const isRunning = step.status === "running" || step.status === "pending";

          return (
            <div key={step.id} className="flex gap-3">
              <div className={`flex-shrink-0 ${color} ${isRunning ? "animate-pulse" : ""}`}>
                {step.status === "payment_required" ? (
                  <span className="font-bold">{label}</span>
                ) : (
                  <span className="font-bold">{label}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300 font-medium">{step.label}</span>
                    {/* Show ENS logo when resolving ENS */}
                    {step.label === "ENS_RESOLVER" && (
                      <Image
                        src="/ethereum-name-service-ens-logo.svg"
                        alt="ENS"
                        width={16}
                        height={16}
                        className="opacity-70"
                      />
                    )}
                  </div>
                  <span className="text-zinc-500 mt-0.5">{step.message}</span>
                  
                  {step.details && (
                    <div className="mt-1 ml-4 text-zinc-600">
                      <span className="text-zinc-600">↳</span>{" "}
                      <span className="text-zinc-500">{step.details}</span>
                    </div>
                  )}

                  {/* Show Etherscan link if this is a payment success step with TX hash */}
                  {step.status === "success" && step.label === "PAYMENT" && step.txHash && (
                    <div className="mt-2 ml-4">
                      <a
                        href={`https://sepolia.etherscan.io/tx/${step.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-system hover:text-system/80 underline font-mono transition-colors inline-flex items-center gap-1"
                      >
                        View on Etherscan
                        <ArrowRight size={12} className="inline" />
                      </a>
                    </div>
                  )}

                  {/* Payment Required - Show button inside log */}
                  {step.status === "payment_required" && (
                    <div className="mt-3 bg-zinc-900 border border-zinc-700 p-3 rounded flex justify-between items-center">
                      <div className="flex-1">
                        <span className="text-zinc-400 text-xs">Total: {step.details || "0.000 ETH"}</span>
                      </div>
                      {onSignTransaction && (
                        <button
                          onClick={onSignTransaction}
                          disabled={isAutoSigning}
                          className="bg-zinc-100 text-black px-3 py-1.5 hover:bg-white transition-colors text-xs font-mono border border-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isAutoSigning ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              AUTO-SIGNING
                            </>
                          ) : (
                            <>
                              <CreditCard size={12} />
                              SIGN TRANSACTION
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Running state - show spinner */}
                  {isRunning && (
                    <div className="mt-1 flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-system" />
                      <span className="text-zinc-600 text-xs">Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

