import { getManifest, getDevices, executeAction } from "./api";
import type { Machine, Capability, Device, ParsedIntent, PaymentDetails } from "@/types";
import directoryData from "./directory.json";

const directory = directoryData as Machine[];

export async function discoverMachines(): Promise<Machine[]> {
  // Read from directory.json (simulates network discovery)
  return directory as Machine[];
}

export async function discoverMachineCapabilities(
  machineUrl: string
): Promise<any> {
  return await getManifest(machineUrl);
}

export async function findMatchingCapability(
  manifest: any,
  intent: ParsedIntent
): Promise<Capability | null> {
  const actionMap: Record<string, string> = {
    unlock: "unlock_device",
    print: "print_document",
    charge: "charge_vehicle",
  };

  const capabilityId = actionMap[intent.action] || intent.action;
  const capability = manifest.capabilities.find(
    (cap: Capability) => cap.id === capabilityId
  );

  return capability || manifest.capabilities[0] || null;
}

export async function findDevice(
  machineUrl: string,
  deviceId?: string,
  deviceName?: string
): Promise<Device | null> {
  const devices = await getDevices(machineUrl);

  if (deviceId) {
    return devices.find((d: Device) => d.id === deviceId) || null;
  }

  if (deviceName) {
    return (
      devices.find(
        (d: Device) =>
          d.name.toLowerCase().includes(deviceName.toLowerCase()) ||
          d.id.toLowerCase().includes(deviceName.toLowerCase())
      ) || null
    );
  }

  // Return first device of matching type if available
  return devices[0] || null;
}

/**
 * Execute action using the Agent Assistant API
 * This uses the integrated agent-assistant logic instead of calling the API directly
 * 
 * Note: Payment is handled by the client (browser) after receiving payment details
 */
export async function executeWithPayment(
  machineUrl: string,
  capability: Capability,
  params: Record<string, any>,
  sendTransaction?: (to: string, value: bigint) => Promise<`0x${string}`>,
  waitForTransaction?: (hash: `0x${string}`) => Promise<void>
): Promise<{ success: boolean; data?: any; paymentDetails?: PaymentDetails }> {
  console.log("[Agent] executeWithPayment - Using Agent Assistant API");
  
  try {
    // Call the Agent Assistant API route
    const response = await fetch("/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineUrl,
        capability,
        params,
      }),
    });

    const result = await response.json();

    // Success without payment
    if (response.ok && result.success) {
      console.log("[Agent] executeWithPayment - Action completed (no payment)");
      return { success: true, data: result.data };
    }

    // Payment required (402)
    if (response.status === 402 && result.requiresPayment) {
      console.log("[Agent] executeWithPayment - Payment required");
      return {
        success: false,
        paymentDetails: result.paymentDetails,
      };
    }

    // Error
    throw new Error(result.error || `Unexpected response: ${response.status}`);
  } catch (error: any) {
    console.error("[Agent] executeWithPayment - Error:", error.message);
    throw error;
  }
}

/**
 * Retry action with payment proof using Agent Assistant API
 */
export async function retryWithPaymentProof(
  machineUrl: string,
  capability: Capability,
  params: Record<string, any>,
  txHash: string
): Promise<any> {
  console.log("[Agent] retryWithPaymentProof - Using Agent Assistant API");
  
  try {
    const response = await fetch("/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineUrl,
        capability,
        params,
        txHash,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Action failed after payment: ${response.status}`);
    }

    const result = await response.json();
    console.log("[Agent] retryWithPaymentProof - Action completed successfully");
    return result.data;
  } catch (error: any) {
    console.error("[Agent] retryWithPaymentProof - Error:", error.message);
    throw error;
  }
}

