import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { parseEther } from "viem";

const MACHINE_API_URL = process.env.NEXT_PUBLIC_MACHINE_API_URL || "http://localhost:8000";
const MAX_AUTO_PAY_AMOUNT = parseFloat(process.env.MAX_AUTO_PAY_AMOUNT || "0.05");

interface ExecuteRequest {
  machineUrl: string;
  capability: {
    id: string;
    endpoint: string;
    method: string;
    description: string;
  };
  params: Record<string, any>;
  txHash?: string;
}

/**
 * Agent Assistant API Route
 * 
 * This endpoint handles the execution of IoT device actions with automatic
 * x402 payment protocol handling. It can be called from the webapp when
 * a user wants to execute a task.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[Agent API] /api/agent/execute - Request received");

  try {
    const body: ExecuteRequest = await request.json();
    const { machineUrl, capability, params, txHash } = body;

    console.log("[Agent API] /api/agent/execute - Executing:", {
      machineUrl,
      capability: capability.id,
      params,
      hasTxHash: !!txHash
    });

    // Validate required fields
    if (!machineUrl || !capability || !params) {
      console.error("[Agent API] /api/agent/execute - Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: machineUrl, capability, params" },
        { status: 400 }
      );
    }

    // Build URL - handle both device_id and device_name placeholders
    let url = capability.endpoint;
    
    // Replace device_id placeholder
    if (url.includes("{device_id}")) {
      url = url.replace(/{device_id}/g, params.device_id || "");
    }
    
    // Replace device_name placeholder (convert to URL-friendly format)
    if (url.includes("{device_name}")) {
      const deviceName = params.device_name || params.device_id?.replace(/-/g, "_") || "";
      url = url.replace(/{device_name}/g, deviceName);
    }
    
    // If endpoint doesn't start with /, it's relative to device path
    if (!url.startsWith("/")) {
      const deviceName = params.device_name || params.device_id?.replace(/-/g, "_") || "";
      url = `/devices/${deviceName}/${url}`;
    }
    
    const fullUrl = `${machineUrl}${url}`;
    
    console.log("[Agent API] /api/agent/execute - Built URL:", {
      originalEndpoint: capability.endpoint,
      builtUrl: url,
      fullUrl,
      params
    });

    // If txHash is provided, this is a retry after payment
    if (txHash) {
      console.log("[Agent API] /api/agent/execute - Retrying with payment proof:", txHash);
      try {
        const response = await axios({
          method: capability.method.toLowerCase(),
          url: fullUrl,
          data: params,
          headers: {
            Authorization: `Bearer ${txHash}`,
          },
        });

        if (response.status === 200) {
          console.log("[Agent API] /api/agent/execute - Action completed successfully");
          console.log(`[Agent API] /api/agent/execute - Request completed in ${Date.now() - startTime}ms`);
          return NextResponse.json({
            success: true,
            data: response.data,
            txHash,
          });
        }

        throw new Error(`Unexpected status: ${response.status}`);
      } catch (error: any) {
        const errorDetails = {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: fullUrl,
          stack: error.stack,
        };
        console.error("[Agent API] /api/agent/execute - Retry failed:", errorDetails);
        
        // Provide more helpful error message
        if (error.response?.status === 404) {
          throw new Error(`Device endpoint not found: ${fullUrl}. Check that the device name and endpoint are correct.`);
        } else if (error.response?.status === 401) {
          throw new Error(`Payment verification failed. Transaction hash may be invalid.`);
        } else if (error.response?.data) {
          throw new Error(error.response.data.detail || error.response.data.error || error.message);
        }
        throw error;
      }
    }

    // First attempt (will get 402 if payment required)
    console.log("[Agent API] /api/agent/execute - First attempt (may get 402)");
    try {
      const response = await axios({
        method: capability.method.toLowerCase(),
        url: fullUrl,
        data: params,
        validateStatus: (status) => status === 200 || status === 402,
      });

      // Success without payment
      if (response.status === 200) {
        console.log("[Agent API] /api/agent/execute - Action completed (no payment required)");
        console.log(`[Agent API] /api/agent/execute - Request completed in ${Date.now() - startTime}ms`);
        return NextResponse.json({
          success: true,
          data: response.data,
        });
      }

      // Handle 402 Payment Required
      if (response.status === 402) {
        const paymentDetails = response.data.detail?.paymentDetails || response.data.paymentDetails;
        const amount = parseFloat(paymentDetails.amount);

        console.log("[Agent API] /api/agent/execute - Payment required:", {
          amount,
          token: paymentDetails.token,
          recipient: paymentDetails.recipient,
        });

        // Check if amount is within auto-pay limit
        if (amount > MAX_AUTO_PAY_AMOUNT) {
          console.warn(`[Agent API] /api/agent/execute - Amount ${amount} exceeds limit ${MAX_AUTO_PAY_AMOUNT}`);
          return NextResponse.json(
            {
              success: false,
              requiresPayment: true,
              paymentDetails,
              error: `Payment amount ${amount} exceeds auto-pay limit of ${MAX_AUTO_PAY_AMOUNT} ETH`,
            },
            { status: 402 }
          );
        }

        // Return payment details for client to handle
        console.log("[Agent API] /api/agent/execute - Returning payment details to client");
        console.log(`[Agent API] /api/agent/execute - Request completed in ${Date.now() - startTime}ms`);
        return NextResponse.json(
          {
            success: false,
            requiresPayment: true,
            paymentDetails,
          },
          { status: 402 }
        );
      }
    } catch (error: any) {
      // Handle axios errors
      if (error.response?.status === 402) {
        const paymentDetails = error.response.data.detail?.paymentDetails || error.response.data.paymentDetails;
        console.log("[Agent API] /api/agent/execute - 402 from axios error");
        return NextResponse.json(
          {
            success: false,
            requiresPayment: true,
            paymentDetails,
          },
          { status: 402 }
        );
      }

      console.error("[Agent API] /api/agent/execute - Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }

    throw new Error("Unexpected execution path");
  } catch (error: any) {
    console.error("[Agent API] /api/agent/execute - Exception:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    console.log(`[Agent API] /api/agent/execute - Request failed in ${Date.now() - startTime}ms`);
    return NextResponse.json(
      {
        error: "Failed to execute action",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

