"use client";

import { useEffect, useState } from "react";
import type { TaskState, TaskData } from "@/types";
import { Copy, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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
        className={`bg-white dark:bg-gray-900 border rounded-xl p-6 shadow-lg transition-all duration-300 ${
          state === "executing"
            ? "border-primary/50 shadow-primary/10"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        {/* State A: Scanning */}
        {state === "scanning" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-primary/10 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              Localizando agente...
            </p>
          </div>
        )}

        {/* State B: Quote */}
        {state === "quote" && taskData?.paymentDetails && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                {taskData.device?.type === "smart_lock" && "🔒"}
                {taskData.device?.type === "printer_3d" && "🖨️"}
                {taskData.device?.type === "ev_station" && "🔌"}
                {!taskData.device && "📱"}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {taskData.device?.name || "Device"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {taskData.machine?.name || "Machine"}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Precio
                </span>
                <span className="text-2xl font-bold text-accent tabular-nums">
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
                className="w-full px-6 py-3 bg-accent hover:bg-accent-dark text-white font-medium rounded-xl transition-colors"
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
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Procesando pago en Base...
                </span>
              </div>
              {taskData?.txHash && (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enviando datos a la máquina...
                  </span>
                </div>
              )}
            </div>
            {taskData?.txHash && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {taskData.txHash.slice(0, 10)}...{taskData.txHash.slice(-8)}
                  </span>
                  <button
                    onClick={copyTxHash}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Tarea completada
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {taskData?.device?.name
                  ? `${taskData.device.name} desbloqueado`
                  : "Acción ejecutada exitosamente"}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Error
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {taskData?.error || "Algo salió mal"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

