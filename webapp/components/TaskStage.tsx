"use client";

import { useEffect, useState } from "react";
import type { TaskState, TaskData } from "@/types";
import { Copy, CheckCircle2, AlertCircle, Loader2, Lock, Printer, Zap, Smartphone } from "lucide-react";

interface TaskStageProps {
  state: TaskState;
  taskData: TaskData | null;
}

export function TaskStage({ state, taskData }: TaskStageProps) {
  const [copied, setCopied] = useState(false);

  const copyTxHash = () => {
    if (taskData?.txHash) {
      navigator.clipboard.writeText(taskData.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (state === "idle") {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div
        className={`bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-2xl transition-all duration-300 ${
          state === "executing"
            ? "border-indigo-500/50 shadow-indigo-500/20"
            : "border-white/10"
        }`}
      >
        {/* State A: Scanning */}
        {state === "scanning" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-indigo-500/10 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-zinc-300 font-medium">
              Localizando agente...
            </p>
          </div>
        )}

        {/* State B: Quote */}
        {state === "quote" && taskData?.paymentDetails && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400">
                {taskData.device?.type === "smart_lock" && <Lock size={28} strokeWidth={2} />}
                {taskData.device?.type === "printer_3d" && <Printer size={28} strokeWidth={2} />}
                {taskData.device?.type === "ev_station" && <Zap size={28} strokeWidth={2} />}
                {!taskData.device && <Smartphone size={28} strokeWidth={2} />}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">
                  {taskData.device?.name || "Device"}
                </h3>
                <p className="text-sm text-zinc-400">
                  {taskData.machine?.name || "Machine"}
                </p>
              </div>
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-400">
                  Precio
                </span>
                <span className="text-2xl font-bold text-indigo-400 tabular-nums">
                  {taskData.paymentDetails.amount} {taskData.paymentDetails.token}
                </span>
              </div>
              <button
                onClick={() => {
                  // Dispatch custom event for parent to handle
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("authorize-payment")
                    );
                  }
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                Autorizar Pago
              </button>
            </div>
          </div>
        )}

        {/* State C: Executing */}
        {state === "executing" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {taskData?.txHash ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                )}
                <span className="text-sm text-zinc-300">
                  Procesando pago en Ethereum Sepolia...
                </span>
              </div>
              {taskData?.txHash && (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span className="text-sm text-zinc-300">
                    Enviando datos a la máquina...
                  </span>
                </div>
              )}
            </div>
            {taskData?.txHash && (
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-mono">
                    {taskData.txHash.slice(0, 10)}...{taskData.txHash.slice(-8)}
                  </span>
                  <button
                    onClick={copyTxHash}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* State D: Success */}
        {state === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold text-white mb-1">
                Tarea completada
              </p>
              <p className="text-sm text-zinc-400">
                {taskData?.device?.name
                  ? `${taskData.device.name} ${taskData.device.type === "3d_printer" ? "imprimiendo" : "desbloqueado"}`
                  : "Acción ejecutada exitosamente"}
              </p>
              
              {/* Print Job Proof */}
              {taskData?.data?.job_id && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg w-full max-w-md">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Job ID:</span>
                      <span className="text-xs text-green-400 font-mono">
                        {taskData.data.job_id.slice(0, 8)}...
                      </span>
                    </div>
                    {taskData.data.job_proof && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Proof:</span>
                        <span className="text-xs text-green-300 font-mono">
                          {taskData.data.job_proof}
                        </span>
                      </div>
                    )}
                    {taskData.data.file_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Archivo:</span>
                        <span className="text-xs text-white font-medium">
                          {taskData.data.file_name}
                        </span>
                      </div>
                    )}
                    {taskData.data.transaction_hash && (
                      <div className="flex items-center justify-between pt-2 border-t border-green-500/20">
                        <span className="text-xs text-zinc-400">TX Hash:</span>
                        <span className="text-xs text-green-400 font-mono">
                          {taskData.data.transaction_hash.slice(0, 10)}...{taskData.data.transaction_hash.slice(-8)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <div className="text-center">
              <p className="text-lg font-semibold text-white mb-1">
                Error
              </p>
              <p className="text-sm text-red-400">
                {taskData?.error || "Algo salió mal"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

