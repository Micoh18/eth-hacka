"use client";

import { Printer, Lock, Zap, ShoppingCart, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { DeviceDetail, Capability } from "@/types";

interface DeviceCardProps {
  device: DeviceDetail;
  isActive: boolean;
  onAction: (action: string, params?: Record<string, any>) => void;
}

const deviceIcons: Record<string, typeof Printer> = {
  "3d_printer": Printer,
  "smart_lock": Lock,
  "ev_charger": Zap,
  "vending_machine": ShoppingCart,
};

const statusColors: Record<string, string> = {
  IDLE: "text-zinc-400",
  ONLINE: "text-success",
  PRINTING: "text-system",
  CHARGING: "text-system",
  PAUSED: "text-warning",
  LOCKED: "text-zinc-400",
  UNLOCKED: "text-success",
  COMPLETE: "text-success",
  ERROR: "text-error",
};

export function DeviceCard({ device, isActive, onAction }: DeviceCardProps) {
  const Icon = deviceIcons[device.type] || Printer;
  const statusColor = statusColors[device.status] || "text-zinc-400";

  // Get capabilities for actions table
  const capabilities = device.capabilities || [];

  return (
    <div
      className={`bg-zinc-900/80 border rounded-lg p-4 transition-all ${
        isActive
          ? "border-system shadow-lg shadow-system/20 ring-1 ring-system/30"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Zona Superior: Estado */}
      <div className="mb-4 pb-4 border-b border-zinc-800">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Icon size={20} className="text-zinc-400" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-mono text-sm font-medium text-white">
                {device.id}.eth
              </h3>
              <p className="text-xs text-zinc-500">{device.name}</p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {isActive && (
              <div className="w-2 h-2 rounded-full bg-system animate-pulse" />
            )}
            <span className={`text-xs font-mono font-medium ${statusColor}`}>
              {device.status}
            </span>
          </div>
        </div>

        {/* Telemetry Badges */}
        <div className="flex flex-wrap gap-2">
          {device.telemetry?.temperature && (
            <div className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-300">
              {device.telemetry.temperature}°C
            </div>
          )}
          {device.telemetry?.current_power_kw && (
            <div className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-300">
              {device.telemetry.current_power_kw}kW
            </div>
          )}
          {device.telemetry?.battery_level && (
            <div className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-300">
              {device.telemetry.battery_level}%
            </div>
          )}
          {device.telemetry?.progress_percent !== undefined && (
            <div className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-300">
              {device.telemetry.progress_percent.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Zona Inferior: Acciones (Tabla de Comandos) */}
      {capabilities.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-wider">
            Commands
          </div>
          <div className="space-y-1">
            {capabilities.map((capability) => {
              const cost = capability.payment_required
                ? capability.default_amount_eth || "0.001"
                : "FREE";
              
              return (
                <div
                  key={capability.id}
                  className="group flex items-center gap-3 px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded hover:border-zinc-700 hover:bg-zinc-900/50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-300 truncate">
                        {capability.id}
                      </span>
                      <span className="text-xs text-zinc-600 font-mono">
                        {capability.method}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {capability.description}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                      {cost}
                    </span>
                    <button
                      onClick={() => {
                        // Extract action from capability id or use default
                        const action = capability.id.includes("print")
                          ? "print"
                          : capability.id.includes("unlock")
                          ? "unlock"
                          : capability.id.includes("charge")
                          ? "charge"
                          : capability.id.includes("buy")
                          ? "buy_filament"
                          : capability.id.includes("pause")
                          ? "pause"
                          : capability.id.includes("cancel")
                          ? "cancel"
                          : capability.id.includes("stop")
                          ? "stop"
                          : capability.id.includes("lock")
                          ? "lock"
                          : capability.id.includes("dispense")
                          ? "dispense"
                          : capability.id.includes("restock")
                          ? "restock"
                          : "default";
                        
                        onAction(action, {
                          device_id: device.id,
                          device_name: device.id.replace(/-/g, "_"),
                        });
                      }}
                      className="px-3 py-1 text-xs font-mono border border-zinc-700 text-zinc-300 rounded hover:border-zinc-600 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      EXECUTE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

