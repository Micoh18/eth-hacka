import { getManifest, getDevices, executeAction, getDeviceManifest, resolveENS } from "./api";
import { SellerAgent } from "./seller-agent";
import type { Machine, Capability, Device, ParsedIntent, PaymentDetails } from "@/types";
import directoryData from "./directory.json";

const directory = directoryData as Machine[];

/**
 * Discover machines by resolving ENS domains from directory.json
 * Buyer agent only knows ENS, not direct URLs
 * 
 * @param filterAction - Optional action type to filter machines (e.g., "print", "unlock")
 */
export async function discoverMachines(filterAction?: string): Promise<Machine[]> {
  console.log("[Agent] discoverMachines - Resolving ENS domains from directory:", directory.length, filterAction ? `(filtered by action: ${filterAction})` : "");
  
  // Map actions to device types for filtering
  const actionToDeviceType: Record<string, string> = {
    print: "3d_printer",
    unlock: "smart_lock",
    charge: "ev_charger",
    dispense: "vending_machine",
    capture: "security_camera",
  };
  
  // Map device types to directory IDs
  const deviceTypeToDirectoryId: Record<string, string> = {
    "3d_printer": "printer",
    "smart_lock": "lock",
    "ev_charger": "charger",
    "vending_machine": "vending",
    "security_camera": "camera",
  };
  
  // Filter directory entries if action is provided
  let entriesToResolve = directory;
  if (filterAction) {
    const targetDeviceType = actionToDeviceType[filterAction];
    if (targetDeviceType) {
      const targetId = deviceTypeToDirectoryId[targetDeviceType];
      entriesToResolve = directory.filter(entry => entry.id === targetId);
      console.log("[Agent] discoverMachines - Filtered to:", entriesToResolve.length, "entry/entries for action:", filterAction);
    }
  }
  
  const machines: Machine[] = [];
  
  for (const entry of entriesToResolve) {
    // If entry has ENS domain, try to resolve it
    const ensDomain = entry.ens || entry.ens_domain;
    
    if (ensDomain) {
      try {
        console.log("[Agent] discoverMachines - Resolving ENS:", ensDomain);
        // Resolve ENS to get seller agent URL and device info
        const resolved = await resolveENS(ensDomain);
        
        machines.push({
          id: entry.id,
          name: entry.name || resolved.device_name,
          url: resolved.url.split('/devices/')[0], // Base URL (seller agent)
          description: entry.description,
          ens: ensDomain,
          ens_domain: resolved.ens_domain,
          payment_address: resolved.payment_address,
          device_id: resolved.device_id,
          device_name: resolved.device_name,
          icon: entry.icon,
        });
        
        console.log("[Agent] discoverMachines - Resolved:", ensDomain, "→", resolved.url);
      } catch (error: any) {
        console.warn(`[Agent] discoverMachines - ENS resolution failed for ${ensDomain}, using fallback:`, error.message);
        
        // Fallback: Use direct API URL from entry or default
        const fallbackUrl = (entry as any).url || process.env.NEXT_PUBLIC_MACHINE_API_URL || "http://localhost:8000";
        const fallbackDeviceId = (entry as any).fallback_device_id || entry.id.replace(/-/g, "-");
        const defaultPaymentAddress = process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000";
        
        console.log("[Agent] discoverMachines - Using fallback (direct API):", {
          url: fallbackUrl,
          deviceId: fallbackDeviceId,
          ensDomain
        });
        
        machines.push({
          id: entry.id,
          name: entry.name,
          url: fallbackUrl,
          description: entry.description,
          ens: ensDomain,
          ens_domain: ensDomain,
          payment_address: defaultPaymentAddress,
          device_id: fallbackDeviceId,
          device_name: fallbackDeviceId.replace(/-/g, "_"),
          icon: entry.icon,
        });
      }
    } else if (entry.url) {
      // Fallback: if no ENS but has URL, use it directly (legacy support)
      console.log("[Agent] discoverMachines - Using direct URL (no ENS):", entry.url);
      const fallbackDeviceId = (entry as any).fallback_device_id || entry.id.replace(/-/g, "-");
      const defaultPaymentAddress = process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000";
      
      machines.push({
        id: entry.id,
        name: entry.name,
        url: entry.url,
        description: entry.description,
        payment_address: defaultPaymentAddress,
        device_id: fallbackDeviceId,
        device_name: fallbackDeviceId.replace(/-/g, "_"),
        icon: entry.icon,
      });
    }
  }
  
  console.log("[Agent] discoverMachines - Found machines:", machines.length);
  return machines;
}

/**
 * Discover device-specific capabilities
 * Uses /devices/{device_name}/ai-manifest instead of general /ai-manifest
 */
export async function discoverMachineCapabilities(
  machineUrl: string,
  deviceName?: string
): Promise<any> {
  if (deviceName) {
    // Use device-specific manifest
    console.log("[Agent] discoverMachineCapabilities - Using device-specific manifest for:", deviceName);
    return await getDeviceManifest(machineUrl, deviceName);
  }
  
  // Fallback to general manifest if no device name provided
  console.log("[Agent] discoverMachineCapabilities - Using general manifest (fallback)");
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
    dispense: "dispense_item",
    capture: "capture_image",
  };

  const capabilityId = actionMap[intent.action || ""] || intent.action;
  
  console.log("[Agent] findMatchingCapability - Looking for:", {
    action: intent.action,
    mappedId: capabilityId,
    availableCapabilities: manifest.capabilities?.map((c: Capability) => c.id) || [],
  });

  if (!manifest.capabilities || manifest.capabilities.length === 0) {
    console.warn("[Agent] findMatchingCapability - No capabilities in manifest");
    return null;
  }

  // Try exact match first
  let capability = manifest.capabilities.find(
    (cap: Capability) => cap.id === capabilityId
  );

  // If not found, try partial match
  if (!capability && capabilityId) {
    capability = manifest.capabilities.find(
      (cap: Capability) => cap.id?.toLowerCase().includes(capabilityId.toLowerCase()) ||
                          capabilityId.toLowerCase().includes(cap.id?.toLowerCase() || "")
    );
  }

  // If still not found, return first capability as fallback
  if (!capability) {
    console.warn(
      `[Agent] findMatchingCapability - Capability "${capabilityId}" not found, using first available:`,
      manifest.capabilities[0]?.id
    );
    return manifest.capabilities[0] || null;
  }

  console.log("[Agent] findMatchingCapability - Found capability:", capability.id);
  return capability;
}

export async function findDevice(
  machineUrl: string,
  deviceId?: string,
  deviceName?: string,
  actionType?: string
): Promise<Device | null> {
  const devices = await getDevices(machineUrl);

  // Map action types to device types
  const actionToDeviceType: Record<string, string> = {
    print: "3d_printer",
    unlock: "smart_lock",
    charge: "ev_charger",
    dispense: "vending_machine",
    capture: "security_camera",
  };

  // If deviceId is provided, search by exact ID
  if (deviceId) {
    const found = devices.find((d: Device) => d.id === deviceId);
    if (found) return found;
  }

  // If deviceName is provided, try flexible matching
  if (deviceName) {
    const searchTerm = deviceName.toLowerCase();
    
    // Try exact match first
    let found = devices.find(
      (d: Device) =>
        d.name.toLowerCase() === searchTerm ||
        d.id.toLowerCase() === searchTerm
    );
    if (found) return found;

    // Try partial match (contains)
    found = devices.find(
      (d: Device) =>
        d.name.toLowerCase().includes(searchTerm) ||
        d.id.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(d.name.toLowerCase()) ||
        searchTerm.includes(d.id.toLowerCase())
    );
    if (found) return found;

    // Try word-by-word matching (e.g., "Lab 3" matches "Prusa Lab")
    const searchWords = searchTerm.split(/\s+/);
    found = devices.find((d: Device) => {
      const deviceWords = d.name.toLowerCase().split(/\s+/);
      return searchWords.some(word => 
        deviceWords.some(dWord => dWord.includes(word) || word.includes(dWord))
      );
    });
    if (found) return found;
  }

  // If actionType is provided, find device by type
  if (actionType && actionToDeviceType[actionType]) {
    const targetType = actionToDeviceType[actionType];
    const found = devices.find((d: Device) => d.type === targetType);
    if (found) return found;
  }

  // Return first device as fallback
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

