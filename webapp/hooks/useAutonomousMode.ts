"use client";

import { useState, useEffect, useCallback } from "react";

const AUTONOMOUS_MODE_KEY = "agent_autonomous_mode";
const AUTONOMOUS_MODE_LIMIT_KEY = "agent_autonomous_limit";
const SPEND_PERMISSION_KEY = "agent_spend_permission";

export interface AutonomousModeConfig {
  enabled: boolean;
  dailyLimit: number; // in ETH
  lastResetDate: string; // ISO date string
  dailySpent: number; // in ETH
  allowanceGranted?: boolean; // Whether autonomous mode is ready (for ETH, this is always true once enabled)
  agentAddress?: string; // Agent's public address
}

const DEFAULT_CONFIG: AutonomousModeConfig = {
  enabled: false,
  dailyLimit: 0.1, // 0.1 ETH default limit
  lastResetDate: new Date().toISOString().split("T")[0],
  dailySpent: 0,
};

export function useAutonomousMode() {
  // Start with default config to avoid hydration mismatch
  const [config, setConfig] = useState<AutonomousModeConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load config from localStorage on mount (client-side only)
  useEffect(() => {
    // Only access localStorage on client
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(AUTONOMOUS_MODE_KEY);
      const storedLimit = localStorage.getItem(AUTONOMOUS_MODE_LIMIT_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reset daily spent if it's a new day
        const today = new Date().toISOString().split("T")[0];
        if (parsed.lastResetDate !== today) {
          parsed.dailySpent = 0;
          parsed.lastResetDate = today;
        }
        setConfig(parsed);
      } else if (storedLimit) {
        // Legacy support
        setConfig({
          ...DEFAULT_CONFIG,
          dailyLimit: parseFloat(storedLimit),
        });
      }
    } catch (error) {
      console.error("[useAutonomousMode] Failed to load config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback((newConfig: AutonomousModeConfig) => {
    try {
      localStorage.setItem(AUTONOMOUS_MODE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.error("[useAutonomousMode] Failed to save config:", error);
    }
  }, []);

  // Enable autonomous mode (simplified - just marks as enabled)
  // The actual allowance is granted via AuthorizeAgentButton component
  const enableAutonomousMode = useCallback(
    async (dailyLimit: number = 0.1) => {
      const today = new Date().toISOString().split("T")[0];
      
      // Import agent address dynamically to avoid SSR issues
      let agentAddress: string | null = null;
      if (typeof window !== "undefined") {
        try {
          const { getAgentAddress } = await import("@/lib/agent-payment");
          agentAddress = getAgentAddress();
        } catch {
          // Ignore if module not available
        }
      }

      const newConfig: AutonomousModeConfig = {
        enabled: true,
        dailyLimit,
        lastResetDate: today,
        dailySpent: 0,
        allowanceGranted: true, // For ETH, no approval needed, so always true
        agentAddress: agentAddress || undefined,
      };

      saveConfig(newConfig);
      return newConfig;
    },
    [saveConfig]
  );

  // Mark allowance as granted (called after user approves USDC)
  const markAllowanceGranted = useCallback(() => {
    const newConfig: AutonomousModeConfig = {
      ...config,
      allowanceGranted: true,
    };
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Disable autonomous mode
  const disableAutonomousMode = useCallback(() => {
    const newConfig: AutonomousModeConfig = {
      ...config,
      enabled: false,
    };
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Check if a payment can be made autonomously
  const canPayAutonomously = useCallback(
    (amount: number): boolean => {
      if (!config.enabled) return false;

      // Reset daily spent if it's a new day
      const today = new Date().toISOString().split("T")[0];
      if (config.lastResetDate !== today) {
        const resetConfig: AutonomousModeConfig = {
          ...config,
          lastResetDate: today,
          dailySpent: 0,
        };
        saveConfig(resetConfig);
        return amount <= resetConfig.dailyLimit;
      }

      // Check if amount + daily spent is within limit
      return config.dailySpent + amount <= config.dailyLimit;
    },
    [config, saveConfig]
  );

  // Record a payment
  const recordPayment = useCallback(
    (amount: number) => {
      const today = new Date().toISOString().split("T")[0];
      let newSpent = config.dailySpent;

      // Reset if new day
      if (config.lastResetDate !== today) {
        newSpent = 0;
      }

      const newConfig: AutonomousModeConfig = {
        ...config,
        dailySpent: newSpent + amount,
        lastResetDate: today,
      };
      saveConfig(newConfig);
    },
    [config, saveConfig]
  );

  return {
    config,
    isLoading,
    enableAutonomousMode,
    disableAutonomousMode,
    canPayAutonomously,
    recordPayment,
    markAllowanceGranted,
  };
}

