/**
 * Example Usage of XMTP Integration
 * 
 * This file demonstrates how to use the XMTP-enabled buyer and seller agents
 * for decentralized IoT device communication in the ChainMachina system.
 * 
 * This is a demonstration file showing the integration pattern.
 * To use in production, integrate with your existing agent-payment.ts and device APIs.
 */

import { BuyerAgentXMTP } from "./buyer-agent-xmtp";
import { SellerAgentXMTP } from "./seller-agent-xmtp";
import type { Signer } from "ethers";

/**
 * Example: Buyer requests a 3D print job
 */
export async function exampleBuyerRequestPrint(
  buyerSigner: Signer,
  buyerAddress: string,
  sellerAddress: string
) {
  console.log("=== Example: Buyer Requesting Print Job ===");

  // Initialize buyer agent
  const buyerAgent = new BuyerAgentXMTP(buyerSigner, buyerAddress);
  await buyerAgent.initialize();

  // Request print job with payment
  const paymentRequest = {
    amount: "0.002", // 0.002 ETH
    recipient: sellerAddress,
    chainId: 11155111, // Sepolia
    jobId: "print-job-001",
    deviceId: "printer-3d-01",
  };

  const result = await buyerAgent.requestDeviceAction(
    sellerAddress,
    paymentRequest
  );

  console.log("Job requested:", result);
  return result;
}

/**
 * Example: Seller agent listening for requests
 */
export async function exampleSellerListenForRequests(
  sellerSigner: Signer,
  sellerAddress: string,
  deviceId: string,
  deviceUrl: string
) {
  console.log("=== Example: Seller Agent Listening ===");

  // Initialize seller agent
  const sellerAgent = new SellerAgentXMTP(
    sellerSigner,
    sellerAddress,
    deviceId,
    deviceUrl
  );
  await sellerAgent.initialize();

  // Listen for payment requests
  await sellerAgent.listenForPaymentRequests(async (request, buyerAddress) => {
    console.log("Received payment request:", request);

    // Process the request
    const response = await sellerAgent.processPaymentRequest(
      buyerAddress,
      request
    );

    if (response.accepted && response.jobId) {
      // Wait for payment confirmation
      const txHash = await sellerAgent.waitForPaymentConfirmation(
        buyerAddress,
        response.jobId
      );

      if (txHash) {
        // Execute the job
        await sellerAgent.executeJob(response.jobId, {
          action: "print",
          file: "model.gcode",
        });
      }
    }
  });
}

/**
 * Example: Complete flow - Buyer to Seller communication
 */
export async function exampleCompleteFlow(
  buyerSigner: Signer,
  buyerAddress: string,
  sellerSigner: Signer,
  sellerAddress: string,
  deviceId: string,
  deviceUrl: string
) {
  console.log("=== Example: Complete XMTP Flow ===");

  // Initialize both agents
  const buyerAgent = new BuyerAgentXMTP(buyerSigner, buyerAddress);
  const sellerAgent = new SellerAgentXMTP(
    sellerSigner,
    sellerAddress,
    deviceId,
    deviceUrl
  );

  await buyerAgent.initialize();
  await sellerAgent.initialize();

  // Buyer: Request device action
  const paymentRequest = {
    amount: "0.002",
    recipient: sellerAddress,
    chainId: 11155111,
    jobId: `job-${Date.now()}`,
    deviceId: deviceId,
  };

  // Start seller listener in background
  sellerAgent.listenForPaymentRequests(async (request, buyerAddr) => {
    const response = await sellerAgent.processPaymentRequest(
      buyerAddr,
      request
    );
    console.log("Seller response:", response);
  });

  // Buyer sends request
  await buyerAgent.requestDeviceAction(sellerAddress, paymentRequest);

  // Buyer listens for job updates
  buyerAgent.listenForJobUpdates((status) => {
    console.log("Job status update:", status);
  });
}

/**
 * Integration points with existing ChainMachina code:
 * 
 * 1. Replace direct API calls in agent.ts with XMTP messaging
 * 2. Integrate with agent-payment.ts for on-chain payment execution
 * 3. Use ENS resolution to get seller agent XMTP address
 * 4. Combine with existing device APIs for actual device control
 * 
 * Example integration:
 * 
 * ```typescript
 * // In webapp/lib/agent.ts
 * import { BuyerAgentXMTP } from '../../xmpt-integration/buyer-agent-xmtp';
 * 
 * // Instead of direct API call:
 * // const result = await executeAction(deviceUrl, action, params);
 * 
 * // Use XMTP:
 * const buyerAgent = new BuyerAgentXMTP(walletClient, address);
 * await buyerAgent.initialize();
 * const result = await buyerAgent.requestDeviceAction(
 *   sellerAddress, // Resolved from ENS
 *   paymentRequest
 * );
 * ```
 */

