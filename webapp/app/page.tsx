"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { CommandInput } from "@/components/CommandInput";
import { TaskStage } from "@/components/TaskStage";
import { Sidebar } from "@/components/Sidebar";
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
      const parseResponse = await fetch("/api/agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command }),
      });

      if (!parseResponse.ok) {
        throw new Error("Failed to parse intent");
      }

      const parsedIntent = await parseResponse.json();
      setParsedIntent(parsedIntent);

      // Step 2: Discover machines
      const machines = await discoverMachines();
      if (machines.length === 0) {
        throw new Error("No machines found");
      }

      // For now, use first machine (can be enhanced with matching logic)
      const machine = machines[0];
      setMachine(machine);

      // Step 3: Discover capabilities
      const manifest = await discoverMachineCapabilities(machine.url);
      const capability = await findMatchingCapability(manifest, parsedIntent);
      if (!capability) {
        throw new Error("No matching capability found");
      }
      setCapability(capability);

      // Step 4: Find device
      const device = await findDevice(
        machine.url,
        parsedIntent.device,
        parsedIntent.device
      );
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
      setError(error.message || "Task execution failed");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        history={history}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className="flex-1 flex flex-col lg:ml-80">
        {/* Header */}
        <header className="p-4 border-b border-gray-200 dark:border-gray-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-950">
          {state === "idle" ? (
            <div className="text-center">
              <h1 className="text-4xl font-semibold text-gray-900 dark:text-white mb-4">
                Command Center
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Describe una tarea para comenzar
              </p>
            </div>
          ) : (
            <TaskStage state={state} taskData={taskData} />
          )}
        </div>

        {/* Command Input */}
        <CommandInput
          onExecute={handleExecute}
          disabled={state !== "idle" && state !== "success" && state !== "error"}
        />
        
        {/* Reset button after success/error */}
        {(state === "success" || state === "error") && (
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30">
            <button
              onClick={reset}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Nueva Tarea
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

