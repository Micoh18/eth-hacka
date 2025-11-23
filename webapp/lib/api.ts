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
  const response = await apiClient.get(`${machineUrl}/ai-manifest`);
  return response.data;
}

export async function getDevices(machineUrl: string) {
  const response = await apiClient.get(`${machineUrl}/status`);
  return response.data;
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

  const response = await apiClient(config);
  return response;
}

