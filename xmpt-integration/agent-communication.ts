// Note: This is a demonstration implementation
// The actual XMTP Agent SDK API may differ. Adjust imports and methods based on the actual SDK version.
import type { Client, Conversation } from "@xmtp/agent-sdk";
import type { Signer as EthersSigner } from "ethers";

// XMTP Signer interface (may need to be adapted based on actual SDK)
interface XMTPSigner {
  type: "SCW" | "EOA";
  signMessage: (message: string) => Promise<string>;
  getIdentifier: () => Promise<string>;
  getChainId: () => Promise<number>;
  getBlockNumber?: () => Promise<number>;
}

export interface PaymentRequest {
  amount: string;
  recipient: string;
  chainId: number;
  token?: string; 
  jobId?: string;
  deviceId?: string;
}

export interface PaymentResponse {
  accepted: boolean;
  transactionHash?: string;
  error?: string;
  jobId?: string;
}

export interface JobStatus {
  jobId: string;
  status: "pending" | "executing" | "completed" | "failed";
  message?: string;
  result?: any;
}

export class XMTPAgentCommunication {
  private client: Client | null = null;
  private signer: EthersSigner;
  private address: string;
  private xmtpSigner: XMTPSigner | null = null;

  constructor(signer: EthersSigner, address: string) {
    this.signer = signer;
    this.address = address;
  }

  /**
   * Convert ethers Signer to XMTP Signer format
   * This is a placeholder - actual implementation depends on XMTP SDK requirements
   */
  private async createXMTPSigner(): Promise<XMTPSigner> {
    // This is a simplified adapter - actual implementation may vary
    return {
      type: "EOA",
      signMessage: async (message: string) => {
        const signature = await this.signer.signMessage(message);
        return signature;
      },
      getIdentifier: async () => {
        return this.address;
      },
      getChainId: async () => {
        const provider = this.signer.provider;
        if (!provider) {
          throw new Error("Signer has no provider");
        }
        const network = await provider.getNetwork();
        return Number(network.chainId);
      },
    };
  }

  /**
   * Initialize XMTP client
   * Note: This is a demonstration implementation. 
   * The actual Client.create() API may differ based on XMTP SDK version.
   */
  async initialize(): Promise<void> {
    try {
      console.log("[XMTP] Initializing client for address:", this.address);
      
      // Check if client already exists
      if (this.client) {
        console.log("[XMTP] Client already initialized");
        return;
      }

      // Convert ethers signer to XMTP signer format
      this.xmtpSigner = await this.createXMTPSigner();

      // Create XMTP client
      // Note: The actual API may be different. Adjust based on @xmtp/agent-sdk documentation
      // This is a placeholder implementation
      const { Client } = await import("@xmtp/agent-sdk");
      this.client = await (Client as any).create(this.xmtpSigner, {
        env: "production", // or "dev" for development
      }) as Client;
      
      console.log("[XMTP] Client initialized successfully");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[XMTP] Failed to initialize client:", errorMessage);
      throw new Error(`XMTP initialization failed: ${errorMessage}`);
    }
  }


  /**
   * Send a payment request to another agent
   */
  async sendPaymentRequest(
    recipientAddress: string,
    paymentRequest: PaymentRequest
  ): Promise<void> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    try {
      console.log("[XMTP] Sending payment request to:", recipientAddress);
      
      // Get or create conversation
      // Note: The actual API method may be different (e.g., createConversation, startConversation)
      // Adjust based on @xmtp/agent-sdk documentation
      const conversation = await (this.client.conversations as any).newConversation?.(
        recipientAddress
      ) || await (this.client.conversations as any).createConversation?.(
        recipientAddress
      ) || await (this.client.conversations as any).startConversation?.(
        recipientAddress
      );
      
      if (!conversation) {
        throw new Error("Failed to create or get conversation");
      }

      // Create message payload
      const messagePayload = {
        type: "payment_request",
        ...paymentRequest,
        timestamp: Date.now(),
      };

      // Send message as text (JSON stringified)
      await conversation.send(JSON.stringify(messagePayload));
      console.log("[XMTP] Payment request sent successfully");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[XMTP] Failed to send payment request:", errorMessage);
      throw new Error(`Failed to send payment request: ${errorMessage}`);
    }
  }


  /**
   * Send a payment response (accept/reject)
   */
  async sendPaymentResponse(
    recipientAddress: string,
    response: PaymentResponse
  ): Promise<void> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    try {
      console.log("[XMTP] Sending payment response to:", recipientAddress);
      
      // Get or create conversation
      // Note: The actual API method may be different (e.g., createConversation, startConversation)
      // Adjust based on @xmtp/agent-sdk documentation
      const conversation = await (this.client.conversations as any).newConversation?.(
        recipientAddress
      ) || await (this.client.conversations as any).createConversation?.(
        recipientAddress
      ) || await (this.client.conversations as any).startConversation?.(
        recipientAddress
      );
      
      if (!conversation) {
        throw new Error("Failed to create or get conversation");
      }

      // Create message payload
      const messagePayload = {
        type: "payment_response",
        ...response,
        timestamp: Date.now(),
      };

      // Send message as text (JSON stringified)
      await conversation.send(JSON.stringify(messagePayload));
      console.log("[XMTP] Payment response sent successfully");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[XMTP] Failed to send payment response:", errorMessage);
      throw new Error(`Failed to send payment response: ${errorMessage}`);
    }
  }


  /**
   * Send job status update
   */
  async sendJobStatus(
    recipientAddress: string,
    status: JobStatus
  ): Promise<void> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    try {
      console.log("[XMTP] Sending job status to:", recipientAddress);
      
      // Get or create conversation
      // Note: The actual API method may be different (e.g., createConversation, startConversation)
      // Adjust based on @xmtp/agent-sdk documentation
      const conversation = await (this.client.conversations as any).newConversation?.(
        recipientAddress
      ) || await (this.client.conversations as any).createConversation?.(
        recipientAddress
      ) || await (this.client.conversations as any).startConversation?.(
        recipientAddress
      );
      
      if (!conversation) {
        throw new Error("Failed to create or get conversation");
      }

      // Create message payload
      const messagePayload = {
        type: "job_status",
        ...status,
        timestamp: Date.now(),
      };

      // Send message as text (JSON stringified)
      await conversation.send(JSON.stringify(messagePayload));
      console.log("[XMTP] Job status sent successfully");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[XMTP] Failed to send job status:", errorMessage);
      throw new Error(`Failed to send job status: ${errorMessage}`);
    }
  }


  /**
   * Listen for incoming messages
   * Note: This is a blocking call that runs indefinitely
   */
  async listenForMessages(
    onMessage: (message: unknown, senderAddress: string) => void
  ): Promise<void> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    try {
      console.log("[XMTP] Starting message listener");
      
      // Stream all conversations
      // Note: The actual streaming API may differ. Adjust based on @xmtp/agent-sdk documentation
      const conversationsStream = (this.client.conversations as any).stream?.() 
        || (this.client.conversations as any).list?.() 
        || [];
      
      // Handle both async iterable and array cases
      if (Symbol.asyncIterator in conversationsStream) {
        for await (const conversation of conversationsStream as AsyncIterable<any>) {
          await this.handleConversationMessages(conversation, onMessage);
        }
      } else if (Array.isArray(conversationsStream)) {
        // If it's a promise, await it
        const conversations = await (Promise.resolve(conversationsStream) as Promise<any[]>);
        for (const conversation of conversations) {
          await this.handleConversationMessages(conversation, onMessage);
        }
      } else {
        throw new Error("Conversations stream is not iterable");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[XMTP] Error in message listener:", errorMessage);
      throw new Error(`Message listener error: ${errorMessage}`);
    }
  }

  /**
   * Helper method to handle messages from a conversation
   */
  private async handleConversationMessages(
    conversation: any,
    onMessage: (message: unknown, senderAddress: string) => void
  ): Promise<void> {
    const peerAddress = conversation.peerAddress || conversation.peer?.address || "unknown";
    console.log("[XMTP] Processing conversation with:", peerAddress);
    
    try {
      const messagesStream = conversation.streamMessages?.() 
        || conversation.messages?.() 
        || [];
      
      if (Symbol.asyncIterator in messagesStream) {
        for await (const message of messagesStream as AsyncIterable<any>) {
          await this.processMessage(message, peerAddress, onMessage);
        }
      } else if (Array.isArray(messagesStream)) {
        const messages = await (Promise.resolve(messagesStream) as Promise<any[]>);
        for (const message of messages) {
          await this.processMessage(message, peerAddress, onMessage);
        }
      }
    } catch (streamError) {
      console.warn("[XMTP] Error streaming messages from conversation:", streamError);
    }
  }

  /**
   * Helper method to process a single message
   */
  private async processMessage(
    message: any,
    senderAddress: string,
    onMessage: (message: unknown, senderAddress: string) => void
  ): Promise<void> {
    try {
      // Parse message content (assuming it's JSON)
      const content = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);
      
      const parsed = JSON.parse(content);
      console.log("[XMTP] Received message:", parsed.type);
      onMessage(parsed, senderAddress);
    } catch (parseError) {
      console.warn("[XMTP] Failed to parse message:", parseError);
      // Still pass the raw message if parsing fails
      onMessage(message.content || message, senderAddress);
    }
  }

  /**
   * Get conversation with a specific address
   */
  async getConversation(peerAddress: string): Promise<Conversation | null> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    try {
      // Try different possible API methods
      const conversation = await (this.client.conversations as any).newConversation?.(peerAddress)
        || await (this.client.conversations as any).createConversation?.(peerAddress)
        || await (this.client.conversations as any).startConversation?.(peerAddress)
        || await (this.client.conversations as any).getConversation?.(peerAddress);
      
      return conversation || null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[XMTP] Failed to get conversation:", errorMessage);
      return null;
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Get the XMTP client instance (for advanced usage)
   */
  getClient(): Client | null {
    return this.client;
  }
}

