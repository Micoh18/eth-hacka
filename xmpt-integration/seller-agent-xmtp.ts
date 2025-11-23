/**
 * Seller Agent with XMTP Integration
 * 
 * This represents the seller/device side of the x402 protocol,
 * enhanced with XMTP for secure communication with buyer agents.
 */

import { XMTPAgentCommunication, PaymentRequest, PaymentResponse, JobStatus } from "./agent-communication";
import type { Signer } from "ethers";

export class SellerAgentXMTP {
  private xmtp: XMTPAgentCommunication;
  private address: string;
  private signer: Signer;
  private deviceId: string;
  private deviceUrl: string;

  constructor(
    signer: Signer,
    address: string,
    deviceId: string,
    deviceUrl: string
  ) {
    this.signer = signer;
    this.address = address;
    this.deviceId = deviceId;
    this.deviceUrl = deviceUrl;
    this.xmtp = new XMTPAgentCommunication(signer, address);
  }

  /**
   * Initialize the seller agent and XMTP client
   */
  async initialize(): Promise<void> {
    console.log("[SellerAgent] Initializing seller agent:", this.address);
    await this.xmtp.initialize();
    console.log("[SellerAgent] Seller agent ready for device:", this.deviceId);
  }

  /**
   * Listen for payment requests from buyer agents
   */
  async listenForPaymentRequests(
    onPaymentRequest: (request: PaymentRequest, buyerAddress: string) => Promise<void>
  ): Promise<void> {
    await this.xmtp.listenForMessages(async (message, senderAddress) => {
      if (message.type === "payment_request") {
        console.log("[SellerAgent] Received payment request from:", senderAddress);
        const paymentRequest = message as PaymentRequest;
        
        // Process the payment request
        await onPaymentRequest(paymentRequest, senderAddress);
      }
    });
  }

  /**
   * Process a payment request and respond
   */
  async processPaymentRequest(
    buyerAddress: string,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResponse> {
    console.log("[SellerAgent] Processing payment request:", paymentRequest);

    // Validate payment request
    if (!paymentRequest.amount || !paymentRequest.recipient) {
      const error = "Invalid payment request: missing amount or recipient";
      await this.xmtp.sendPaymentResponse(buyerAddress, {
        accepted: false,
        error,
      });
      return { accepted: false, error };
    }

    // Check if device is available
    // (This would integrate with your device status check)

    // Accept the payment request
    const jobId = `job-${Date.now()}-${this.deviceId}`;
    const response: PaymentResponse = {
      accepted: true,
      jobId,
    };

    await this.xmtp.sendPaymentResponse(buyerAddress, response);
    console.log("[SellerAgent] Payment request accepted, job ID:", jobId);

    return response;
  }

  /**
   * Wait for payment confirmation (on-chain transaction)
   */
  async waitForPaymentConfirmation(
    buyerAddress: string,
    jobId: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      // In real implementation, listen for payment_response messages
      // For demo, we'll simulate waiting
      console.log("[SellerAgent] Waiting for payment confirmation for job:", jobId);
      
      // This would be handled by the message listener
      // For now, return null as placeholder
      setTimeout(() => resolve(null), 1000);
    });
  }

  /**
   * Execute the job after payment is confirmed
   */
  async executeJob(jobId: string, params: any): Promise<void> {
    console.log("[SellerAgent] Executing job:", jobId);

    // Update job status to executing
    // await this.sendJobStatus(buyerAddress, {
    //   jobId,
    //   status: "executing",
    // });

    // Execute the actual device action
    // (This would integrate with your existing device API calls)
    // const result = await executeDeviceAction(this.deviceId, params);

    // Update job status to completed
    // await this.sendJobStatus(buyerAddress, {
    //   jobId,
    //   status: "completed",
    //   result,
    // });
  }

  /**
   * Send job status update to buyer
   */
  async sendJobStatus(buyerAddress: string, status: JobStatus): Promise<void> {
    await this.xmtp.sendJobStatus(buyerAddress, status);
  }
}

