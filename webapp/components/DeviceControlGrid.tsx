"use client";

import { useEffect, useState } from "react";
import { DeviceCard } from "./DeviceCard";
import { apiClient } from "@/lib/api";
import type { DeviceDetail } from "@/types";

interface DeviceControlGridProps {
  activeDeviceId?: string;
  onDeviceAction: (deviceId: string, action: string, params?: Record<string, any>) => void;
}

const MACHINE_API_URL = process.env.NEXT_PUBLIC_MACHINE_API_URL || "http://localhost:8000";

export function DeviceControlGrid({ activeDeviceId, onDeviceAction }: DeviceControlGridProps) {
  const [devices, setDevices] = useState<DeviceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      console.log("[DeviceGrid] Fetching devices from:", `${MACHINE_API_URL}/status`);
      const response = await apiClient.get("/status");
      
      if (response.data && Array.isArray(response.data)) {
        // Transform API response to DeviceDetail format
        const deviceDetails: DeviceDetail[] = await Promise.all(
          response.data.map(async (device: any) => {
            // Fetch device-specific manifest for capabilities
            let capabilities = [];
            try {
              const deviceNameForUrl = device.id.replace(/-/g, "_");
              const manifestResponse = await apiClient.get(`/devices/${deviceNameForUrl}/ai-manifest`);
              capabilities = manifestResponse.data?.capabilities || [];
            } catch (err) {
              console.warn(`[DeviceGrid] Failed to fetch manifest for ${device.id}:`, err);
            }

            return {
              id: device.id,
              name: device.name,
              type: device.type,
              status: device.status || "UNKNOWN",
              telemetry: device.telemetry || {},
              ens_domain: device.ens_domain || device.ens || `${device.id}.eth`,
              capabilities,
            };
          })
        );
        
        setDevices(deviceDetails);
        setError(null);
      } else {
        setError("Invalid response format from API");
      }
    } catch (err: any) {
      console.error("[DeviceGrid] Error fetching devices:", err);
      setError(err.message || "Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDevices();
  }, []);

  // Polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono text-sm">Loading devices...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-error font-mono text-sm">Error: {error}</div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-mono text-sm">No devices found</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4">
        <h2 className="text-lg font-mono font-medium text-white mb-1">Device Grid</h2>
        <p className="text-xs text-zinc-500">Real-time telemetry and control</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            isActive={activeDeviceId === device.id}
            onAction={(action, params) => {
              onDeviceAction(device.id, action, params || {});
            }}
          />
        ))}
      </div>
    </div>
  );
}

