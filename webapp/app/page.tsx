"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient, useConnectorClient } from "wagmi";
import { parseEther } from "viem";
import { sepolia } from "@/lib/wallet";
import { CommandInput } from "@/components/CommandInput";
import { TaskStage } from "@/components/TaskStage";
import { AgentMessage } from "@/components/AgentMessage";
import { Sidebar } from "@/components/Sidebar";
import { WalletButton } from "@/components/WalletButton";
import { AutonomousModeSetup } from "@/components/AutonomousModeSetup";
import { useTask } from "@/hooks/useTask";
import { useAutonomousMode } from "@/hooks/useAutonomousMode";
import { executeAgentPayment, getAgentAddress } from "@/lib/agent-payment";
import { Lock, Printer, Zap } from "lucide-react";
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
    // Clear chat message when starting new command
    clearChatMessage();

    // For chat mode, wallet connection is not required
    // For action mode, wallet is required
    try {
      // Step 1: Parse intent
      console.log("[Page] handleExecute - Step 1: Parsing intent for:", command);
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

      // Check if it's a chat message or an action
      if (parsedIntent.type === "chat") {
        // Chat mode: just show the message
        updateChatMessage(parsedIntent.message || "No response available");
        return;
      }

      // Action mode: proceed with execution flow
      if (!isConnected) {
        setError("Please connect your wallet first");
        return;
      }

      startTask(command);
      setParsedIntent(parsedIntent);

      // Step 2: Discover machines
      console.log("[Page] handleExecute - Step 2: Discovering machines");
      const machines = await discoverMachines();
      console.log("[Page] handleExecute - Found machines:", machines.length);
      if (machines.length === 0) {
        throw new Error("No machines found");
      }

      // For now, use first machine (can be enhanced with matching logic)
      const machine = machines[0];
      console.log("[Page] handleExecute - Using machine:", machine.url);
      setMachine(machine);

      // Step 3: Find device FIRST (needed for device-specific manifest)
      console.log("[Page] handleExecute - Step 3: Finding device");
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

      // Step 4: Discover device-specific capabilities
      console.log("[Page] handleExecute - Step 4: Discovering device-specific capabilities");
      const deviceNameForUrl = device.id.replace(/-/g, "_"); // Convert to URL-friendly format
      const manifest = await discoverMachineCapabilities(machine.url, deviceNameForUrl);
      console.log("[Page] handleExecute - Manifest received:", manifest);
      const capability = await findMatchingCapability(manifest, parsedIntent);
      console.log("[Page] handleExecute - Matching capability:", capability);
      if (!capability) {
        throw new Error("No matching capability found");
      }
      setCapability(capability);

      // Step 5: Execute with payment
      console.log("[Page] Step 5: Checking autonomous mode before execution:", {
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
        completeTask(result.data);
      } else if (result.paymentDetails) {
        // Payment amount is already in ETH
        const amountEth = parseFloat(result.paymentDetails.amount);
        
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
            
            // Wait for transaction confirmation
            console.log("[Page] Waiting for transaction confirmation...");
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("[Page] Transaction confirmed");
            
            // Retry with payment proof
            console.log("[Page] Payment confirmed, retrying action with payment proof");
            // State is already "executing" from startExecution(), no need to set again
            
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
            completeTask(retryResult);
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
    }
  };

  const quickActions = [
    { icon: Lock, label: "Desbloquear dispositivo", command: "Desbloquear smart lock" },
    { icon: Printer, label: "Imprimir documento", command: "Imprimir en Lab 3" },
    { icon: Zap, label: "Cargar vehículo", command: "Cargar en estación 1" },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-indigo-500/30 overflow-hidden">
      {/* Breathing Void - Luz ambiental */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] opacity-50 animate-pulse" 
             style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] opacity-30" />
      </div>

      {/* Wallet Identity Pill - Top Right */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        {mounted && !autonomousLoading && isConnected && (
          <>
            {autonomousConfig.enabled ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-300 flex items-center gap-2">
                  <Zap size={12} className="fill-green-400" />
                  <span className="hidden sm:inline">
                    Agente: {autonomousConfig.dailySpent.toFixed(4)}/{autonomousConfig.dailyLimit} ETH
                  </span>
                  <span className="sm:hidden">Agente</span>
                </div>
                {/* Debug: Quick reset button */}
                <button
                  onClick={() => setShowAutonomousSetup(true)}
                  className="px-2 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-600/30 rounded-lg text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                  title="🛠️ Debug: Configurar/Resetear"
                >
                  ⚙️
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAutonomousSetup(true)}
                className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-2"
                title="Habilitar pagos automáticos"
              >
                <Zap size={14} />
                <span className="hidden sm:inline">Activar Agente</span>
                <span className="sm:hidden">Agente</span>
              </button>
            )}
          </>
        )}
        <WalletButton />
      </div>

      {/* Autonomous Mode Setup Modal */}
      {showAutonomousSetup && (
        <AutonomousModeSetup
          onSetupComplete={() => {
            setShowAutonomousSetup(false);
            setNeedsAutonomousSetup(false);
            // Retry the last action if it failed due to missing setup
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

      {/* Content */}
      <div className="relative z-10 flex h-screen">
        <Sidebar
          history={history}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 flex flex-col lg:ml-20 xl:ml-20">
          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center p-8">
            {chatMessage ? (
              <AgentMessage message={chatMessage} />
            ) : state === "idle" ? (
              <div className="w-full max-w-3xl">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-4 justify-center mb-12">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleExecute(action.command)}
                        disabled={!mounted || !isConnected}
                        className="group flex items-center gap-3 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <div className="p-2 rounded-lg bg-black/50 text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                          <Icon size={18} strokeWidth={2} />
                        </div>
                        <span className="text-sm font-medium text-zinc-300 group-hover:text-white tracking-wide">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <TaskStage state={state} taskData={taskData} />
            )}
          </div>

          {/* Command Input - God Bar */}
          <CommandInput
            onExecute={handleExecute}
            disabled={Boolean(state !== "idle" && state !== "success" && state !== "error" && !chatMessage)}
          />
          
          {/* Reset button after success/error */}
          {(state === "success" || state === "error") && (
            <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30">
              <button
                onClick={reset}
                className="px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 hover:border-indigo-500/50 transition-all text-sm font-medium text-zinc-300 hover:text-white"
              >
                Nueva Tarea
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

