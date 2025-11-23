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

