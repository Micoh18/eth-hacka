"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient, useConnectorClient } from "wagmi";
import { parseEther } from "viem";
import { sepolia } from "@/lib/wallet";
import { CommandPanel } from "@/components/CommandPanel";
import { DeviceControlGrid } from "@/components/DeviceControlGrid";
import { ActivityLog } from "@/components/ActivityLog";
import { WalletButton } from "@/components/WalletButton";
import { AutonomousModeSetup } from "@/components/AutonomousModeSetup";
import { useTask } from "@/hooks/useTask";
import { useAutonomousMode } from "@/hooks/useAutonomousMode";
import { executeAgentPayment, getAgentAddress } from "@/lib/agent-payment";
import { Lock, Printer, Zap } from "lucide-react";
import Image from "next/image";
import {
  discoverMachines,
  discoverMachineCapabilities,
  findMatchingCapability,
  findDevice,
  executeWithPayment,
  retryWithPaymentProof,
} from "@/lib/agent";
import type { Machine } from "@/types";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAutonomousSetup, setShowAutonomousSetup] = useState(false);
  const [needsAutonomousSetup, setNeedsAutonomousSetup] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, connector } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: connectorClient } = useConnectorClient();
  const publicClient = usePublicClient();
  const {
    config: autonomousConfig,
    canPayAutonomously,
    recordPayment,
    isLoading: autonomousLoading,
  } = useAutonomousMode();

  // Prevent hydration mismatch by only rendering client-side dependent UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  const {
    state,
    taskData,
    history,
    chatMessage,
    activitySteps,
    activeDeviceId,
    startTask,
    setParsedIntent,
    setMachine,
    setCapability,
    setDevice,
    showQuote,
    startExecution,
    setTxHash,
    completeTask,
    setError,
    updateChatMessage,
    clearChatMessage,
    reset,
    addActivityStep,
    updateActivityStep,
    clearActivitySteps,
    setActiveDeviceId,
  } = useTask();

  // Listen for authorize payment event
  useEffect(() => {
    const handleAuthorize = async () => {
      if (!taskData?.paymentDetails) {
        setError("No payment details available");
        return;
      }

      if (!walletClient || !publicClient) {
        if (!autonomousConfig.enabled) {
          setNeedsAutonomousSetup(true);
          setShowAutonomousSetup(true);
          setError("Wallet not ready. Please enable autonomous mode.");
        } else {
          setError("Wallet not connected");
        }
        return;
      }

      try {
        startExecution();
        const amount = parseEther(taskData.paymentDetails.amount);
        const amountEth = parseFloat(taskData.paymentDetails.amount);

        // Check autonomous mode limits if enabled
        if (autonomousConfig.enabled && !canPayAutonomously(amountEth)) {
          setError(
            `Payment amount (${amountEth.toFixed(4)} ETH) exceeds daily limit (${autonomousConfig.dailyLimit} ETH)`
          );
          return;
        }

        // Agent sends ETH from its own wallet (autonomous - no user signature needed)
        // This works on any chain (Ethereum Sepolia, Base, etc.)
        if (!address) {
          setError("User wallet not connected");
          return;
        }

        const amountETHStr = (Number(amount) / 1e18).toFixed(6);
        const hash = await executeAgentPayment(
          address as `0x${string}`, // User's wallet address (for logging)
          taskData.paymentDetails.recipient as `0x${string}`, // Machine address
          amountETHStr // Amount in ETH
        );

        // Record payment if autonomous mode is enabled
        if (autonomousConfig.enabled) {
          recordPayment(amountEth);
        }

        setTxHash(hash);

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash });

        // Retry with payment proof
        if (taskData.machine && taskData.capability && taskData.device) {
          const result = await retryWithPaymentProof(
            taskData.machine.url,
            taskData.capability,
            { device_id: taskData.device.id },
            hash
          );
          completeTask(result);
        }
      } catch (error: any) {
        console.error("[Page] handleAuthorize - Error:", error);
        setError(error.message || "Payment failed");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("authorize-payment", handleAuthorize as EventListener);
      return () => {
        window.removeEventListener("authorize-payment", handleAuthorize as EventListener);
      };
    }
  }, [
    taskData,
    walletClient,
    publicClient,
    startExecution,
    setTxHash,
    completeTask,
    setError,
    autonomousConfig,
    canPayAutonomously,
    recordPayment,
  ]);

  const handleExecute = async (command: string) => {
    // Clear chat message and activity steps when starting new command
    clearChatMessage();
    clearActivitySteps();
    setActiveDeviceId(undefined);

    // For chat mode, wallet connection is not required
    // For action mode, wallet is required
    try {
      // Step 1: Parse intent
      console.log("[Page] handleExecute - Step 1: Parsing intent for:", command);
      
      addActivityStep({
        id: "parse",
        status: "running",
        label: "INTENT_PARSER",
        message: "Analyzing command...",
        timestamp: Date.now(),
      });
      const parseResponse = await fetch("/api/agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command }),
      });

      console.log("[Page] handleExecute - Parse response status:", parseResponse.status);

      if (!parseResponse.ok) {
        const errorText = await parseResponse.text();
        console.error("[Page] handleExecute - Parse failed:", errorText);
        throw new Error(`Failed to parse intent: ${parseResponse.status} ${errorText}`);
      }

      const parsedIntent = await parseResponse.json();
      console.log("[Page] handleExecute - Parsed intent:", parsedIntent);

      updateActivityStep("parse", {
        status: "success",
        message: `Intent: ${parsedIntent.type === "chat" ? "Chat" : "Action"}`,
      });

      // Check if it's a chat message or an action
      if (parsedIntent.type === "chat") {
        // Chat mode: just show the message
        updateChatMessage(parsedIntent.message || "No response available");
        clearActivitySteps();
        return;
      }

      // Action mode: proceed with execution flow
      if (!isConnected) {
        setError("Please connect your wallet first");
        return;
      }

      startTask(command);
      setParsedIntent(parsedIntent);

      // Step 2: Discover machines (filtered by action if available)
      console.log("[Page] handleExecute - Step 2: Discovering machines");
      
      addActivityStep({
        id: "discovery",
        status: "running",
        label: "DISCOVERY",
        message: "Scanning local peers...",
        timestamp: Date.now(),
      });
      
      // Only resolve the ENS domain that matches the intent (not all of them)
      const machines = await discoverMachines(parsedIntent.action);
      console.log("[Page] handleExecute - Found machines:", machines.length);
      if (machines.length === 0) {
        updateActivityStep("discovery", { status: "error", message: "No machines found" });
        throw new Error("No machines found for this action");
      }
      
      updateActivityStep("discovery", {
        status: "success",
        message: `Found ${machines.length} device(s)`,
        details: `Device: ${machines[0].name || machines[0].ens_domain}`,
      });

      // Select machine (should be only one if filtered by action, but handle multiple)
      let machine = machines[0]; // Default to first
      
      // If multiple machines found, try to match by device name
      if (machines.length > 1 && parsedIntent.device) {
        const searchTerm = parsedIntent.device.toLowerCase();
        const matched = machines.find(m => 
          m.name?.toLowerCase().includes(searchTerm) ||
          m.ens?.toLowerCase().includes(searchTerm) ||
          m.ens_domain?.toLowerCase().includes(searchTerm) ||
          searchTerm.includes(m.name?.toLowerCase() || "")
        );
        if (matched) {
          machine = matched;
          console.log("[Page] handleExecute - Matched machine by device name:", machine.name);
        }
      }
      
      console.log("[Page] handleExecute - Using machine:", {
        name: machine.name,
        url: machine.url,
        ens: machine.ens || machine.ens_domain,
        action: parsedIntent.action,
      });
      setMachine(machine);

      // Step 3: ENS Resolution
      const ensDomain = machine.ens || machine.ens_domain || "";
      addActivityStep({
        id: "ens",
        status: "running",
        label: "ENS_RESOLVER",
        message: `Resolving '${ensDomain}'...`,
        timestamp: Date.now(),
      });

      updateActivityStep("ens", {
        status: "success",
        message: `Resolved ${ensDomain}`,
        details: `Address: ${machine.payment_address?.slice(0, 6)}...${machine.payment_address?.slice(-4)} | URL: ${machine.url}`,
      });

      // Step 4: Find device FIRST (needed for device-specific manifest)
      console.log("[Page] handleExecute - Step 4: Finding device");
      console.log("[Page] handleExecute - Searching with:", {
        deviceId: parsedIntent.device,
        deviceName: parsedIntent.device,
        action: parsedIntent.action,
      });
      const device = await findDevice(
        machine.url,
        parsedIntent.device,
        parsedIntent.device,
        parsedIntent.action
      );
      console.log("[Page] handleExecute - Found device:", device);
      if (!device) {
        throw new Error(
          `Device not found. Searched for: "${parsedIntent.device}" with action: "${parsedIntent.action}". ` +
          `Available devices: Check the API at ${machine.url}/status`
        );
      }
      setDevice(device);
      setActiveDeviceId(device.id);

      // Step 5: Discover device-specific capabilities
      console.log("[Page] handleExecute - Step 5: Discovering device-specific capabilities");
      const deviceNameForUrl = device.id.replace(/-/g, "_"); // Convert to URL-friendly format
      const manifest = await discoverMachineCapabilities(machine.url, deviceNameForUrl);
      console.log("[Page] handleExecute - Manifest received:", manifest);
      const capability = await findMatchingCapability(manifest, parsedIntent);
      console.log("[Page] handleExecute - Matching capability:", capability);
      if (!capability) {
        throw new Error("No matching capability found");
      }
      setCapability(capability);

      // Step 6: Execute with payment
      addActivityStep({
        id: "handshake",
        status: "running",
        label: "HANDSHAKE",
        message: `POST /devices/${device.id.replace(/-/g, "_")}/job...`,
        details: `Payload: { action: "${parsedIntent.action}", device_id: "${device.id}" }`,
        timestamp: Date.now(),
      });

      console.log("[Page] Step 6: Checking autonomous mode before execution:", {
        enabled: autonomousConfig.enabled,
        allowanceGranted: autonomousConfig.allowanceGranted,
        hasWalletClient: !!walletClient,
        hasPublicClient: !!publicClient,
        config: autonomousConfig,
      });
      
      // For autonomous mode, we don't need walletClient/publicClient from user
      // The agent uses its own wallet via private key
      if (!autonomousConfig.enabled) {
        console.log("[Page] Autonomous mode not enabled, checking wallet...");
        // If autonomous mode is not enabled, we need user's wallet
        if (!walletClient || !publicClient) {
          console.log("[Page] Wallet not ready, showing setup modal");
          setNeedsAutonomousSetup(true);
          setShowAutonomousSetup(true);
          setError("Wallet not ready. Please enable autonomous mode to continue.");
          return;
        }
      } else {
        console.log("[Page] Autonomous mode enabled, checking publicClient for tx confirmation...");
        // Autonomous mode enabled - we still need publicClient for waiting for tx confirmation
        if (!publicClient) {
          console.log("[Page] Public client not available");
          setError("Public client not available. Please connect your wallet.");
          return;
        }
        // walletClient is not needed for autonomous mode (agent uses its own wallet)
        console.log("[Page] Autonomous mode ready, proceeding with execution");
      }

      const result = await executeWithPayment(
        machine.url,
        capability,
        { device_id: device.id },
        async (to, value) => {
          // Check if autonomous mode is enabled (for ETH, no allowance needed)
          if (!autonomousConfig.enabled) {
            throw new Error("Autonomous mode not enabled");
          }

          // Convert value to ETH amount
          const amountEth = Number(value) / 1e18;
          const amountETHStr = amountEth.toFixed(6); // 6 decimal places for ETH

          // Check if payment can be made autonomously
          if (!canPayAutonomously(amountEth)) {
            throw new Error(
              `Payment amount (${amountEth.toFixed(6)} ETH) exceeds daily limit (${autonomousConfig.dailyLimit} ETH) or would exceed it.`
            );
          }

          // Get user's wallet address
          if (!address) {
            throw new Error("User wallet not connected");
          }

          console.log("[Page] Executing agent payment:", {
            userAddress: address,
            machineAddress: to,
            amountETH: amountETHStr,
          });

          // Agent sends ETH from its own wallet (autonomous - no user signature needed)
          const hash = await executeAgentPayment(
            address as `0x${string}`, // User's wallet address (for logging/verification)
            to as `0x${string}`,      // Machine address (recipient)
            amountETHStr              // Amount in ETH
          );

          // Record payment in ETH equivalent
          recordPayment(amountEth);

          return hash;
        },
        async (hash) => {
          await publicClient.waitForTransactionReceipt({ hash });
        }
      );

      if (result.success) {
        updateActivityStep("handshake", {
          status: "success",
          message: "Action executed successfully",
        });
        completeTask(result.data);
        setActiveDeviceId(undefined);
      } else if (result.paymentDetails) {
        // Payment amount is already in ETH
        const amountEth = parseFloat(result.paymentDetails.amount);
        
        updateActivityStep("handshake", {
          status: "payment_required",
          label: "x402 PAYWALL",
          message: "402 Payment Required",
          details: `Cost: ${result.paymentDetails.amount} ETH`,
        });
        
        console.log("[Page] Payment required - Checking autonomous mode:", {
          enabled: autonomousConfig.enabled,
          allowanceGranted: autonomousConfig.allowanceGranted,
          amountEth,
          canPay: canPayAutonomously(amountEth),
          config: autonomousConfig,
        });
        
        // Check if we can pay autonomously
        if (autonomousConfig.enabled && autonomousConfig.allowanceGranted && canPayAutonomously(amountEth)) {
          // AUTO-PAY: Execute payment automatically without showing modal
          console.log("[Page] Auto-paying - Autonomous mode enabled, executing payment automatically");
          startExecution(); // Use startExecution from useTask hook
          
          try {
            if (!address) {
              throw new Error("User wallet not connected");
            }
            
            if (!publicClient) {
              throw new Error("Public client not available");
            }
            
            const to = result.paymentDetails.recipient;
            const amountETHStr = result.paymentDetails.amount; // Already in ETH
            const value = parseEther(amountETHStr);
            
            console.log("[Page] Executing ETH payment via agent:", {
              userAddress: address,
              to,
              amountETH: amountETHStr,
            });
            
            // Agent sends ETH from its own wallet (autonomous - no user signature needed)
            const hash = await executeAgentPayment(
              address as `0x${string}`, // User's wallet address (for logging)
              to as `0x${string}`,      // Machine address (recipient)
              amountETHStr              // Amount in ETH
            );
            
            console.log("[Page] Payment transaction hash:", hash);
            recordPayment(amountEth);
            setTxHash(hash);
            
            addActivityStep({
              id: "payment",
              status: "running",
              label: "PAYMENT",
              message: "Signing transaction...",
              details: `Amount: ${amountETHStr} ETH`,
              timestamp: Date.now(),
            });
            
            // Wait for transaction confirmation
            console.log("[Page] Waiting for transaction confirmation...");
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("[Page] Transaction confirmed");
            
            updateActivityStep("payment", {
              status: "success",
              message: "Transaction confirmed",
              details: `TX: ${hash.slice(0, 10)}...${hash.slice(-8)}`,
              txHash: hash, // Store full hash for Etherscan link
            });
            
            // Retry with payment proof
            console.log("[Page] Payment confirmed, retrying action with payment proof");
            updateActivityStep("handshake", {
              status: "running",
              message: "Retrying with payment proof...",
            });
            
            // Use device name in URL-friendly format for the endpoint
            const deviceNameForUrl = device.id.replace(/-/g, "_");
            const retryResult = await retryWithPaymentProof(
              machine.url,
              capability,
              { 
                device_id: device.id,
                device_name: deviceNameForUrl,
                action: parsedIntent.action,
              },
              hash
            );
            
            console.log("[Page] Action completed successfully:", retryResult);
            updateActivityStep("handshake", {
              status: "success",
              message: "Action executed successfully",
            });
            completeTask(retryResult);
            setActiveDeviceId(undefined);
          } catch (paymentError: any) {
            const errorMessage = paymentError?.message || paymentError?.toString() || JSON.stringify(paymentError) || "Payment failed";
            console.error("[Page] Auto-payment failed:", {
              error: paymentError,
              message: errorMessage,
              stack: paymentError?.stack,
              name: paymentError?.name,
              fullError: paymentError,
            });
            setError(errorMessage); // setError already sets state to "error"
          }
        } else if (!autonomousConfig.enabled) {
          // Show setup prompt if not enabled
          console.log("[Page] Autonomous mode not enabled, showing setup modal");
          setNeedsAutonomousSetup(true);
          setShowAutonomousSetup(true);
        } else if (!autonomousConfig.allowanceGranted) {
          // Show setup prompt if allowance not granted
          console.log("[Page] Allowance not granted, showing setup modal");
          setNeedsAutonomousSetup(true);
          setShowAutonomousSetup(true);
        } else {
          // Exceeds limit, show quote for manual approval
          console.log("[Page] Payment exceeds limit, showing quote modal");
          showQuote(result.paymentDetails);
        }
      }
    } catch (error: any) {
      console.error("[Page] handleExecute - Error:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Check if error is related to wallet/autonomous mode
      if (error.message?.includes("Wallet not ready") || error.message?.includes("exceeds daily limit")) {
        if (!autonomousConfig.enabled) {
          setNeedsAutonomousSetup(true);
          setShowAutonomousSetup(true);
        }
      }
      
      setError(error.message || "Task execution failed");
      setActiveDeviceId(undefined);
    }
  };

  const handleDeviceAction = async (deviceId: string, action: string, params?: Record<string, any>) => {
    // Build command from device action
    const actionCommands: Record<string, string> = {
      print: `Imprimir en ${deviceId}`,
      unlock: `Desbloquear ${deviceId}`,
      charge: `Cargar en ${deviceId}`,
      buy_filament: `Comprar filamento para ${deviceId}`,
      pause: `Pausar impresión en ${deviceId}`,
      cancel: `Cancelar impresión en ${deviceId}`,
      stop: `Detener carga en ${deviceId}`,
      lock: `Bloquear ${deviceId}`,
      dispense: `Dispensar producto de ${deviceId}`,
      restock: `Reabastecer ${deviceId}`,
    };
    
    const command = actionCommands[action] || `${action} ${deviceId}`;
    await handleExecute(command);
  };

  return (
    <div className="h-screen bg-zinc-950 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              System: ONLINE
            </span>
            {/* Logo with rounded frame */}
            <div className="ml-2 w-8 h-8 rounded-full border-2 border-zinc-700 overflow-hidden bg-zinc-900 flex items-center justify-center">
              <Image
                src="/principal logo.png"
                alt="ChainMachina Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {mounted && !autonomousLoading && isConnected && (
            <>
              {autonomousConfig.enabled ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-success/20 border border-success/30 rounded text-xs text-success font-mono flex items-center gap-2">
                    <Zap size={12} className="fill-success" />
                    <span className="hidden sm:inline">
                      {autonomousConfig.dailySpent.toFixed(4)}/{autonomousConfig.dailyLimit} ETH
                    </span>
                    <span className="sm:hidden">Agent</span>
                  </div>
                  <button
                    onClick={() => setShowAutonomousSetup(true)}
                    className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-zinc-400 hover:text-zinc-300 transition-colors font-mono"
                    title="Configure"
                  >
                    ⚙
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAutonomousSetup(true)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-zinc-300 hover:text-white transition-colors font-mono flex items-center gap-2"
                  title="Enable Autonomous Mode"
                >
                  <Zap size={12} />
                  <span className="hidden sm:inline">Activate Agent</span>
                  <span className="sm:hidden">Agent</span>
                </button>
              )}
            </>
          )}
          <WalletButton />
        </div>
      </div>

      {/* Autonomous Mode Setup Modal */}
      {showAutonomousSetup && (
        <AutonomousModeSetup
          onSetupComplete={() => {
            setShowAutonomousSetup(false);
            setNeedsAutonomousSetup(false);
            if (needsAutonomousSetup && taskData?.intent) {
              handleExecute(taskData.intent);
            }
          }}
          onClose={() => {
            setShowAutonomousSetup(false);
            setNeedsAutonomousSetup(false);
          }}
        />
      )}

      {/* Split View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Command Interface (30-40%) */}
        <div className="w-full md:w-[35%] lg:w-[40%] flex flex-col border-r border-zinc-800">
          <CommandPanel
            onExecute={handleExecute}
            chatMessage={chatMessage || undefined}
            history={history}
            disabled={Boolean(state !== "idle" && state !== "success" && state !== "error" && !chatMessage)}
          />
          
          {/* Activity Log - Shows below command panel when active */}
          {activitySteps.length > 0 && (
            <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
              <ActivityLog
                steps={activitySteps}
                onSignTransaction={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("authorize-payment"));
                  }
                }}
                isAutoSigning={autonomousConfig.enabled && state === "executing"}
              />
            </div>
          )}
        </div>

        {/* Right Panel: Device Grid (60-70%) */}
        <div className="flex-1 overflow-hidden">
          <DeviceControlGrid
            activeDeviceId={activeDeviceId}
            onDeviceAction={handleDeviceAction}
          />
        </div>
      </div>
    </div>
  );
}

