/**
 * Buyer Agent with XMTP Integration
 * 
 * This represents the buyer/user side of the x402 protocol,
 * enhanced with XMTP for secure communication with seller agents.
 */

import { XMTPAgentCommunication, PaymentRequest, PaymentResponse, JobStatus } from "./agent-communication";
import type { Signer } from "ethers";

export class BuyerAgentXMTP {
  private xmtp: XMTPAgentCommunication;
  private address: string;
  private signer: Signer;

  constructor(signer: Signer, address: string) {
    this.signer = signer;
    this.address = address;
    this.xmtp = new XMTPAgentCommunication(signer, address);
  }

  /**
   * Initialize the buyer agent and XMTP client
   */
  async initialize(): Promise<void> {
    console.log("[BuyerAgent] Initializing buyer agent:", this.address);
    await this.xmtp.initialize();
    console.log("[BuyerAgent] Buyer agent ready");
  }

  /**
   * Request a device action and handle payment via XMTP
   * 
   * Flow:
   * 1. Send payment request to seller agent via XMTP
   * 2. Wait for payment response
   * 3. If accepted, execute payment on-chain
   * 4. Send payment proof to seller agent
   * 5. Receive job confirmation
   */
  async requestDeviceAction(
    sellerAddress: string,
    paymentRequest: PaymentRequest
  ): Promise<{ jobId: string; status: string }> {
    console.log("[BuyerAgent] Requesting device action from:", sellerAddress);

    // Step 1: Send payment request via XMTP
    await this.xmtp.sendPaymentRequest(sellerAddress, paymentRequest);

    // Step 2: Wait for payment response (in real implementation, use message listener)
    // For demo purposes, we'll simulate the response
    console.log("[BuyerAgent] Waiting for payment response...");

    // Step 3: If payment is accepted, execute on-chain payment
    // (This would integrate with your existing agent-payment.ts logic)

    // Step 4: Send payment proof via XMTP
    // await this.xmtp.sendPaymentResponse(sellerAddress, {
    //   accepted: true,
    //   transactionHash: txHash,
    //   jobId: paymentRequest.jobId
    // });

    // Step 5: Wait for job confirmation
    // const jobStatus = await this.waitForJobStatus(sellerAddress, paymentRequest.jobId);

    return {
      jobId: paymentRequest.jobId || "pending",
      status: "requested",
    };
  }

  /**
   * Listen for job status updates from seller agents
   */
  async listenForJobUpdates(
    onStatusUpdate: (status: JobStatus) => void
  ): Promise<void> {
    await this.xmtp.listenForMessages((message, senderAddress) => {
      if (message.type === "job_status") {
        console.log("[BuyerAgent] Received job status update:", message);
        onStatusUpdate(message as JobStatus);
      }
    });
  }

  /**
   * Send payment confirmation after on-chain transaction
   */
  async confirmPayment(
    sellerAddress: string,
    transactionHash: string,
    jobId: string
  ): Promise<void> {
    await this.xmtp.sendPaymentResponse(sellerAddress, {
      accepted: true,
      transactionHash,
      jobId,
    });
  }
}

