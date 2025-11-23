"use client";

import { useState } from "react";
import { useAutonomousMode } from "@/hooks/useAutonomousMode";
import { Zap, Shield, X, RotateCcw } from "lucide-react";

interface AutonomousModeSetupProps {
  onSetupComplete?: () => void;
  onClose?: () => void;
}

export function AutonomousModeSetup({
  onSetupComplete,
  onClose,
}: AutonomousModeSetupProps) {
  const { enableAutonomousMode, disableAutonomousMode, config } = useAutonomousMode();
  const [dailyLimit, setDailyLimit] = useState("0.1");
  const [isEnabling, setIsEnabling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const handleEnable = async () => {
    console.log("[AutonomousModeSetup] handleEnable - Starting...");
    setIsEnabling(true);
    try {
      const limit = parseFloat(dailyLimit);
      console.log("[AutonomousModeSetup] handleEnable - Daily limit:", limit);
      
      if (isNaN(limit) || limit <= 0) {
        console.error("[AutonomousModeSetup] handleEnable - Invalid limit");
        alert("Por favor ingresa un límite diario válido");
        setIsEnabling(false);
        return;
      }

      // Enable autonomous mode (for ETH, no authorization needed)
      console.log("[AutonomousModeSetup] handleEnable - Calling enableAutonomousMode...");
      const newConfig = await enableAutonomousMode(limit);
      console.log("[AutonomousModeSetup] handleEnable - Autonomous mode enabled:", newConfig);
      
      // For ETH, enableAutonomousMode already sets allowanceGranted: true
      // No need to call markAllowanceGranted() as it would overwrite with stale config
      
      setIsEnabling(false);
      setAuthorized(true);
      
      // Wait a bit to show success message, then close
      setTimeout(() => {
        console.log("[AutonomousModeSetup] handleEnable - Setup complete, closing modal...");
        onSetupComplete?.();
      }, 2000);
    } catch (error: any) {
      console.error("[AutonomousModeSetup] handleEnable - Error:", error);
      console.error("[AutonomousModeSetup] handleEnable - Error stack:", error?.stack);
      alert("Error al activar modo autónomo: " + (error.message || "Error desconocido"));
      setIsEnabling(false);
    }
  };


  const handleReset = async () => {
    if (!confirm("¿Estás seguro de que quieres resetear el modo autónomo? Esto eliminará todos los permisos y configuraciones.")) {
      return;
    }

    setIsResetting(true);
    try {
      // Clear localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("agent_autonomous_mode");
        localStorage.removeItem("agent_autonomous_limit");
        localStorage.removeItem("agent_spend_permission");
      }

      // Disable autonomous mode
      disableAutonomousMode();

      // Reload page to reset state
      window.location.reload();
    } catch (error: any) {
      console.error("[AutonomousModeSetup] Failed to reset:", error);
      alert("Error al resetear: " + error.message);
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              Habilitar Pagos Automáticos
            </h2>
            <p className="text-sm text-zinc-400">
              Activa el modo agente autónomo
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6 space-y-3">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Al activar el modo autónomo, el agente podrá realizar pagos
            automáticamente sin requerir tu confirmación en cada transacción.
          </p>
          <div className="flex items-start gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <Zap size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-zinc-300">
              <strong className="text-indigo-400">Límite diario:</strong> Establece
              un límite máximo de gasto por día. El agente solo pagará si el monto
              está dentro de este límite.
            </div>
          </div>
        </div>

        {/* Daily Limit Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Límite Diario (ETH)
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            placeholder="0.1"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Ejemplo: 0.1 ETH = ~$250 USD (aprox.)
          </p>
        </div>

        {/* Actions */}
        {!authorized ? (
          <div className="flex gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleEnable}
              disabled={Boolean(isEnabling)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEnabling ? "Activando..." : "Activar Modo Autónomo"}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Shield className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-green-400">
                  ¡Modo Autónomo Activado!
                </p>
                <p className="text-xs text-green-300/70 mt-1">
                  El agente puede pagar automáticamente hasta {dailyLimit} ETH por día.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status indicator */}
        {config.enabled && (
          <div className="mt-4 space-y-3">
            {config.allowanceGranted ? (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-xs text-green-400">
                  ✓ Modo autónomo activo - Límite: {config.dailyLimit} ETH/día
                </p>
                {config.agentAddress && (
                  <p className="text-xs text-green-300/70 mt-1">
                    Agente: {config.agentAddress.slice(0, 6)}...{config.agentAddress.slice(-4)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-400 mb-2">
                    ⚠️ Límite configurado, pero falta autorizar al agente
                  </p>
                  <p className="text-xs text-yellow-300/70">
                    Con ETH nativo, no se requiere autorización de tokens. El modo autónomo está listo para usar.
                  </p>
                </div>
              </div>
            )}
            
            {/* Debug: Reset Button */}
            <button
              onClick={handleReset}
              disabled={Boolean(isResetting)}
              className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-sm text-red-300 hover:text-red-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Resetear modo autónomo (para testing)"
            >
              <RotateCcw size={14} className={isResetting ? "animate-spin" : ""} />
              {isResetting ? "Reseteando..." : "🛠️ Resetear Modo Autónomo (Debug)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

