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

export async function executeWithPayment(
  machineUrl: string,
  capability: Capability,
  params: Record<string, any>,
  sendTransaction: (to: string, value: bigint) => Promise<`0x${string}`>,
  waitForTransaction: (hash: `0x${string}`) => Promise<void>
): Promise<{ success: boolean; data?: any; paymentDetails?: PaymentDetails }> {
  try {
    // First attempt (will get 402)
    const response = await executeAction(
      machineUrl,
      capability.endpoint,
      capability.method,
      params
    );

    if (response.status === 200) {
      return { success: true, data: response.data };
    }

    // Handle 402 Payment Required
    if (response.status === 402) {
      const paymentDetails: PaymentDetails =
        response.data.detail.paymentDetails;

      return {
        success: false,
        paymentDetails,
      };
    }

    throw new Error(`Unexpected status: ${response.status}`);
  } catch (error: any) {
    if (error.response?.status === 402) {
      const paymentDetails: PaymentDetails =
        error.response.data.detail.paymentDetails;
      return {
        success: false,
        paymentDetails,
      };
    }
    throw error;
  }
}

export async function retryWithPaymentProof(
  machineUrl: string,
  capability: Capability,
  params: Record<string, any>,
  txHash: string
): Promise<any> {
  const response = await executeAction(
    machineUrl,
    capability.endpoint,
    capability.method,
    params,
    txHash
  );

  if (response.status !== 200) {
    throw new Error(`Action failed after payment: ${response.status}`);
  }

  return response.data;
}

