"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { CommandInput } from "@/components/CommandInput";
import { TaskStage } from "@/components/TaskStage";
import { Sidebar } from "@/components/Sidebar";
import { WalletButton } from "@/components/WalletButton";
import { useTask } from "@/hooks/useTask";
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
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const {
    state,
    taskData,
    history,
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
    reset,
  } = useTask();

  // Listen for authorize payment event
  useEffect(() => {
    const handleAuthorize = async () => {
      if (!taskData?.paymentDetails || !walletClient || !publicClient) {
        setError("Wallet not connected");
        return;
      }

      try {
        startExecution();
        const amount = parseEther(taskData.paymentDetails.amount);

        // Send transaction
        const hash = await walletClient.sendTransaction({
          to: taskData.paymentDetails.recipient as `0x${string}`,
          value: amount,
        });

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
        setError(error.message || "Payment failed");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("authorize-payment", handleAuthorize as EventListener);
      return () => {
        window.removeEventListener("authorize-payment", handleAuthorize as EventListener);
      };
    }
  }, [taskData, walletClient, publicClient, startExecution, setTxHash, completeTask, setError]);

  const handleExecute = async (command: string) => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      startTask(command);

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

      // Step 3: Discover capabilities
      console.log("[Page] handleExecute - Step 3: Discovering capabilities");
      const manifest = await discoverMachineCapabilities(machine.url);
      console.log("[Page] handleExecute - Manifest received:", manifest);
      const capability = await findMatchingCapability(manifest, parsedIntent);
      console.log("[Page] handleExecute - Matching capability:", capability);
      if (!capability) {
        throw new Error("No matching capability found");
      }
      setCapability(capability);

      // Step 4: Find device
      console.log("[Page] handleExecute - Step 4: Finding device");
      const device = await findDevice(
        machine.url,
        parsedIntent.device,
        parsedIntent.device
      );
      console.log("[Page] handleExecute - Found device:", device);
      if (!device) {
        throw new Error("Device not found");
      }
      setDevice(device);

      // Step 5: Execute with payment
      if (!walletClient || !publicClient) {
        throw new Error("Wallet not ready");
      }

      const result = await executeWithPayment(
        machine.url,
        capability,
        { device_id: device.id },
        async (to, value) => {
          const hash = await walletClient.sendTransaction({
            to: to as `0x${string}`,
            value,
          });
          return hash;
        },
        async (hash) => {
          await publicClient.waitForTransactionReceipt({ hash });
        }
      );

      if (result.success) {
        completeTask(result.data);
      } else if (result.paymentDetails) {
        showQuote(result.paymentDetails);
      }
    } catch (error: any) {
      console.error("[Page] handleExecute - Error:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setError(error.message || "Task execution failed");
    }
  };

  const quickActions = [
    { icon: "🔓", label: "Desbloquear dispositivo", command: "Desbloquear smart lock" },
    { icon: "🖨️", label: "Imprimir documento", command: "Imprimir en Lab 3" },
    { icon: "🔌", label: "Cargar vehículo", command: "Cargar en estación 1" },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-indigo-500/30 overflow-hidden">
      {/* Breathing Void - Luz ambiental */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] opacity-50 animate-pulse" 
             style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] opacity-30" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-screen">
        <Sidebar
          history={history}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          walletButton={<WalletButton />}
        />

        <main className="flex-1 flex flex-col lg:ml-20 xl:ml-20">
          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center p-8">
            {state === "idle" ? (
              <div className="w-full max-w-3xl">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3 justify-center mb-12">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExecute(action.command)}
                      disabled={!isConnected}
                      className="group relative px-4 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 hover:border-indigo-500/50 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span className="text-lg mr-2">{action.icon}</span>
                      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                        {action.label}
                      </span>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-all duration-300" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <TaskStage state={state} taskData={taskData} />
            )}
          </div>

          {/* Command Input - God Bar */}
          <CommandInput
            onExecute={handleExecute}
            disabled={state !== "idle" && state !== "success" && state !== "error"}
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

