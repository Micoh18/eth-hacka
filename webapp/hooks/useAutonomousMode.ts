"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  // Use a ref to track the last known config to avoid infinite loops
  const lastConfigRef = useRef<string | null>(null);

  // Load config from localStorage on mount (client-side only)
  useEffect(() => {
    // Only access localStorage on client
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const loadConfig = () => {
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
          console.log("[useAutonomousMode] Loaded config from localStorage:", parsed);
          setConfig(parsed);
        } else if (storedLimit) {
          // Legacy support
          const legacyConfig = {
            ...DEFAULT_CONFIG,
            dailyLimit: parseFloat(storedLimit),
          };
          console.log("[useAutonomousMode] Loaded legacy config:", legacyConfig);
          setConfig(legacyConfig);
        } else {
          console.log("[useAutonomousMode] No config found, using default");
        }
      } catch (error) {
        console.error("[useAutonomousMode] Failed to load config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();

    // Listen for storage changes (when config is updated in another component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTONOMOUS_MODE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          console.log("[useAutonomousMode] Storage changed, updating config:", parsed);
          setConfig(parsed);
        } catch (error) {
          console.error("[useAutonomousMode] Failed to parse storage change:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Listen for custom event (same-tab updates)
    const handleCustomEvent = (e: CustomEvent) => {
      console.log("[useAutonomousMode] Custom event received, updating config:", e.detail);
      setConfig(e.detail as AutonomousModeConfig);
    };
    
    window.addEventListener("autonomousModeUpdated", handleCustomEvent as EventListener);

    // Also poll for changes (for same-tab updates as fallback)
    // Initialize ref with current stored value
    const currentStored = localStorage.getItem(AUTONOMOUS_MODE_KEY);
    lastConfigRef.current = currentStored;
    
    const interval = setInterval(() => {
      const stored = localStorage.getItem(AUTONOMOUS_MODE_KEY);
      if (stored && stored !== lastConfigRef.current) {
        try {
          const parsed = JSON.parse(stored);
          console.log("[useAutonomousMode] Config changed via polling, updating:", parsed);
          lastConfigRef.current = stored;
          setConfig(parsed);
        } catch (error) {
          // Ignore parse errors
        }
      }
    }, 200); // Check every 200ms

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("autonomousModeUpdated", handleCustomEvent as EventListener);
      clearInterval(interval);
    };
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback((newConfig: AutonomousModeConfig) => {
    try {
      console.log("[useAutonomousMode] saveConfig - Saving config:", newConfig);
      const configStr = JSON.stringify(newConfig);
      localStorage.setItem(AUTONOMOUS_MODE_KEY, configStr);
      setConfig(newConfig);
      
      // Dispatch custom event to notify other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("autonomousModeUpdated", { detail: newConfig }));
      }
      
      console.log("[useAutonomousMode] saveConfig - Config saved and state updated");
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
  // Uses functional update to read latest config state
  const markAllowanceGranted = useCallback(() => {
    setConfig((currentConfig) => {
      const newConfig: AutonomousModeConfig = {
        ...currentConfig,
        allowanceGranted: true,
      };
      // Save to localStorage
      try {
        const configStr = JSON.stringify(newConfig);
        localStorage.setItem(AUTONOMOUS_MODE_KEY, configStr);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("autonomousModeUpdated", { detail: newConfig }));
        }
      } catch (error) {
        console.error("[useAutonomousMode] Failed to save config:", error);
      }
      return newConfig;
    });
  }, []);

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

