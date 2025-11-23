import axios, { AxiosInstance } from "axios";

const MACHINE_API_URL =
  process.env.NEXT_PUBLIC_MACHINE_API_URL || "http://localhost:8000";

export const apiClient: AxiosInstance = axios.create({
  baseURL: MACHINE_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function getManifest(machineUrl: string) {
  console.log("[API Client] getManifest - Calling:", `${machineUrl}/ai-manifest`);
  try {
    const response = await apiClient.get(`${machineUrl}/ai-manifest`);
    console.log("[API Client] getManifest - Success:", response.status);
    return response.data;
  } catch (error: any) {
    console.error("[API Client] getManifest - Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: `${machineUrl}/ai-manifest`
    });
    throw error;
  }
}

export async function getDeviceManifest(machineUrl: string, deviceName: string) {
  // Convert device name to URL-friendly format (replace hyphens with underscores)
  const urlFriendlyName = deviceName.replace(/-/g, "_");
  const url = `/devices/${urlFriendlyName}/ai-manifest`;
  
  console.log("[API Client] getDeviceManifest - Calling:", `${machineUrl}${url}`);
  try {
    // Use axios directly with full URL since apiClient baseURL might not match machineUrl
    const response = await axios.get(`${machineUrl}${url}`, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("[API Client] getDeviceManifest - Success:", response.status);
    return response.data;
  } catch (error: any) {
    console.error("[API Client] getDeviceManifest - Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: `${machineUrl}${url}`
    });
    throw error;
  }
}

export async function getDevices(machineUrl: string) {
  console.log("[API Client] getDevices - Calling:", `${machineUrl}/status`);
  try {
    const response = await apiClient.get(`${machineUrl}/status`);
    console.log("[API Client] getDevices - Success:", response.status, `(${response.data?.length || 0} devices)`);
    return response.data;
  } catch (error: any) {
    console.error("[API Client] getDevices - Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: `${machineUrl}/status`
    });
    throw error;
  }
}

/**
 * Resolve ENS domain to seller agent URL and payment address
 * This is the only way the buyer agent discovers seller agents
 */
export async function resolveENS(ensDomain: string, resolverUrl?: string): Promise<{
  url: string;
  payment_address: string;
  device_id: string;
  device_name: string;
  ens_domain: string;
}> {
  // Use resolver URL from env or default to API base URL
  const resolver = resolverUrl || process.env.NEXT_PUBLIC_ENS_RESOLVER_URL || MACHINE_API_URL;
  
  // Normalize ENS domain (remove .eth if present)
  const normalized = ensDomain.replace(/\.eth$/, "");
  const url = `${resolver}/resolve/${normalized}`;
  
  console.log("[API Client] resolveENS - Resolving:", ensDomain, "→", url);
  
  try {
    const response = await axios.get(url, {
      timeout: 5000, // Shorter timeout for ENS resolution
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    console.log("[API Client] resolveENS - Resolved:", response.data);
    return response.data;
  } catch (error: any) {
    console.warn("[API Client] resolveENS - ENS resolution failed, using fallback:", {
      message: error.message,
      status: error.response?.status,
      url
    });
    
    // Fallback: Use direct API URL and construct device info from ENS domain
    const fallbackUrl = MACHINE_API_URL;
    const fallbackDeviceId = normalized.replace(/[-_]/g, "-"); // Normalize device ID
    
    console.log("[API Client] resolveENS - Using fallback:", {
      url: fallbackUrl,
      deviceId: fallbackDeviceId,
      ensDomain
    });
    
    // Try to get device info from API directly
    try {
      const devicesResponse = await axios.get(`${fallbackUrl}/status`, {
        timeout: 10000,
      });
      
      // Find device by ID or name matching the ENS domain
      const devices = devicesResponse.data;
      const matchingDevice = devices.find((d: any) => 
        d.id?.toLowerCase().includes(normalized.toLowerCase()) ||
        d.name?.toLowerCase().includes(normalized.toLowerCase()) ||
        normalized.toLowerCase().includes(d.id?.toLowerCase() || "") ||
        normalized.toLowerCase().includes(d.name?.toLowerCase() || "")
      );
      
      if (matchingDevice) {
        // Use a default payment address (can be configured via env)
        const defaultPaymentAddress = process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000";
        
        return {
          url: fallbackUrl,
          payment_address: defaultPaymentAddress,
          device_id: matchingDevice.id,
          device_name: matchingDevice.id.replace(/-/g, "_"),
          ens_domain: ensDomain,
        };
      }
    } catch (fallbackError: any) {
      console.error("[API Client] resolveENS - Fallback also failed:", fallbackError.message);
    }
    
    // Last resort: Return a constructed response with default values
    const defaultPaymentAddress = process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000";
    
    return {
      url: fallbackUrl,
      payment_address: defaultPaymentAddress,
      device_id: fallbackDeviceId,
      device_name: fallbackDeviceId.replace(/-/g, "_"),
      ens_domain: ensDomain,
    };
  }
}

export async function executeAction(
  machineUrl: string,
  endpoint: string,
  method: string,
  params: Record<string, any>,
  txHash?: string
) {
  const url = endpoint.replace(/{device_id}/g, params.device_id || "");
  const fullUrl = `${machineUrl}${url}`;
  
  console.log("[API Client] executeAction - Calling:", {
    method: method.toLowerCase(),
    url: fullUrl,
    params,
    hasTxHash: !!txHash
  });

  const config: any = {
    method: method.toLowerCase(),
    url: fullUrl,
    data: params,
    validateStatus: (status: number) => status === 200 || status === 402,
  };

  if (txHash) {
    config.headers = {
      Authorization: `Bearer ${txHash}`,
    };
  }

  try {
    const response = await apiClient(config);
    console.log("[API Client] executeAction - Response:", {
      status: response.status,
      data: response.data
    });
    return response;
  } catch (error: any) {
    console.error("[API Client] executeAction - Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: fullUrl
    });
    throw error;
  }
}

