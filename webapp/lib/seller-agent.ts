/**
 * Seller Agent - Represents the machine/vendor side of the x402 protocol
 * 
 * This agent has knowledge of:
 * - Device-specific endpoints and capabilities
 * - Payment configuration (VENDOR_ADDRESS)
 * - Job execution logic
 */

import { getDevices } from "./api";
import type { Capability, Device, PaymentDetails } from "@/types";

export class SellerAgent {
  private machineUrl: string;
  private vendorAddress: string;

  constructor(machineUrl: string, vendorAddress?: string) {
    this.machineUrl = machineUrl;
    this.vendorAddress = vendorAddress || process.env.NEXT_PUBLIC_VENDOR_ADDRESS || "0x13EB37a124F98A76c973c3fce0F3FF829c7df57C";
  }

  /**
   * Get device-specific manifest
   * Uses the device-specific endpoint: /devices/{device_name}/ai-manifest
   */
  async getDeviceManifest(deviceName: string): Promise<any> {
    // Convert device name to URL-friendly format (replace hyphens with underscores)
    const urlFriendlyName = deviceName.replace(/-/g, "_");
    const url = `${this.machineUrl}/devices/${urlFriendlyName}/ai-manifest`;
    
    console.log("[SellerAgent] getDeviceManifest - Calling:", url);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to get device manifest: ${response.status} ${response.statusText}`);
      }
      const manifest = await response.json();
      console.log("[SellerAgent] getDeviceManifest - Success:", {
        device: deviceName,
        capabilities: manifest.capabilities?.length || 0
      });
      return manifest;
    } catch (error: any) {
      console.error("[SellerAgent] getDeviceManifest - Error:", {
        device: deviceName,
        error: error.message,
        url
      });
      throw error;
    }
  }

  /**
   * Get payment configuration for a specific device
   */
  async getPaymentConfig(deviceName: string): Promise<PaymentDetails> {
    const manifest = await this.getDeviceManifest(deviceName);
    const paymentConfig = manifest.payment_config;
    
    return {
      chainId: paymentConfig.chainId,
      chainName: paymentConfig.chainName,
      token: paymentConfig.token,
      recipient: paymentConfig.recipient || this.vendorAddress,
      amount: paymentConfig.amount || "0.001",
      rpcUrl: paymentConfig.rpcUrl,
    };
  }

  /**
   * Execute a job on a device with payment proof
   */
  async executeJob(
    deviceName: string,
    capability: Capability,
    params: Record<string, any>,
    txHash: string
  ): Promise<any> {
    // Convert device name to URL-friendly format
    const urlFriendlyName = deviceName.replace(/-/g, "_");
    
    // Build the endpoint URL
    let endpoint = capability.endpoint;
    if (endpoint.includes("{device_id}")) {
      endpoint = endpoint.replace(/{device_id}/g, params.device_id || urlFriendlyName);
    }
    if (endpoint.includes("{device_name}")) {
      endpoint = endpoint.replace(/{device_name}/g, urlFriendlyName);
    }
    
    // If endpoint is relative, use device-specific path
    if (endpoint.startsWith("/devices/") || endpoint.startsWith("devices/")) {
      // Already device-specific
    } else if (endpoint.startsWith("/")) {
      // Make it device-specific
      endpoint = `/devices/${urlFriendlyName}${endpoint}`;
    } else {
      endpoint = `/devices/${urlFriendlyName}/${endpoint}`;
    }
    
    const url = `${this.machineUrl}${endpoint}`;
    
    console.log("[SellerAgent] executeJob - Calling:", {
      method: capability.method,
      url,
      params,
      txHash: txHash.substring(0, 20) + "..."
    });
    
    try {
      const response = await fetch(url, {
        method: capability.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${txHash}`,
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Job execution failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      const result = await response.json();
      console.log("[SellerAgent] executeJob - Success:", {
        device: deviceName,
        capability: capability.id,
        result: result.success
      });
      return result;
    } catch (error: any) {
      console.error("[SellerAgent] executeJob - Error:", {
        device: deviceName,
        capability: capability.id,
        error: error.message,
        url
      });
      throw error;
    }
  }

  /**
   * Get all devices from the machine
   */
  async getDevices(): Promise<Device[]> {
    return await getDevices(this.machineUrl);
  }

  /**
   * Get vendor address
   */
  getVendorAddress(): string {
    return this.vendorAddress;
  }
}

