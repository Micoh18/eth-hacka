"use client";

import { useState, useCallback } from "react";
import type { TaskState, TaskData, TaskHistory, Machine, Capability, Device, ParsedIntent } from "@/types";

export function useTask() {
  const [state, setState] = useState<TaskState>("idle");
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [chatMessage, setChatMessage] = useState<string | null>(null);

  const startTask = useCallback((intent: string) => {
    const newTask: TaskData = {
      intent,
    };
    setTaskData(newTask);
    setState("scanning");
  }, []);

  const setParsedIntent = useCallback((parsedIntent: ParsedIntent) => {
    setTaskData((prev) => (prev ? { ...prev, parsedIntent } : null));
  }, []);

  const setMachine = useCallback((machine: Machine) => {
    setTaskData((prev) => (prev ? { ...prev, machine } : null));
  }, []);

  const setCapability = useCallback((capability: Capability) => {
    setTaskData((prev) => (prev ? { ...prev, capability } : null));
  }, []);

  const setDevice = useCallback((device: Device) => {
    setTaskData((prev) => (prev ? { ...prev, device } : null));
  }, []);

  const showQuote = useCallback((paymentDetails: any) => {
    setTaskData((prev) => (prev ? { ...prev, paymentDetails } : null));
    setState("quote");
  }, []);

  const startExecution = useCallback(() => {
    setState("executing");
  }, []);

  const setTxHash = useCallback((txHash: string) => {
    setTaskData((prev) => (prev ? { ...prev, txHash } : null));
  }, []);

  const completeTask = useCallback((data?: any) => {
    setState("success");
    if (taskData) {
      const historyItem: TaskHistory = {
        id: Date.now().toString(),
        intent: taskData.intent,
        state: "success",
        timestamp: new Date(),
        txHash: taskData.txHash,
        device: taskData.device?.id,
      };
      setHistory((prev) => [historyItem, ...prev]);
    }
  }, [taskData]);

  const setError = useCallback((error: string) => {
    setState("error");
    setTaskData((prev) => (prev ? { ...prev, error } : null));
    if (taskData) {
      const historyItem: TaskHistory = {
        id: Date.now().toString(),
        intent: taskData.intent,
        state: "error",
        timestamp: new Date(),
      };
      setHistory((prev) => [historyItem, ...prev]);
    }
  }, [taskData]);

  const updateChatMessage = useCallback((message: string) => {
    setChatMessage(message);
  }, []);

  const clearChatMessage = useCallback(() => {
    setChatMessage(null);
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setTaskData(null);
    setChatMessage(null);
  }, []);

  return {
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
  };
}

