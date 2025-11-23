import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[API] /api/agent/parse - Request received");
  
  try {
    const { text } = await request.json();
    console.log("[API] /api/agent/parse - Parsing text:", text);

    if (!text || typeof text !== "string") {
      console.error("[API] /api/agent/parse - Error: Text is required or invalid");
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Get API key from environment (Anthropic is preferred)
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    console.log("[API] /api/agent/parse - API keys check:", {
      hasAnthropic: !!anthropicKey,
      hasOpenAI: !!openaiKey
    });

    // Try Anthropic first (preferred), then OpenAI, then regex fallback
    if (anthropicKey) {
      try {
        console.log("[API] /api/agent/parse - Attempting Anthropic parsing");
        const result = await parseWithAnthropic(text, anthropicKey);
        console.log("[API] /api/agent/parse - Anthropic result:", result);
        console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
        return result;
      } catch (error) {
        console.error("[API] /api/agent/parse - Anthropic parsing failed:", error);
        // Fallback to OpenAI if available, otherwise regex
        if (openaiKey) {
          try {
            console.log("[API] /api/agent/parse - Falling back to OpenAI");
            const result = await parseWithOpenAI(text, openaiKey);
            console.log("[API] /api/agent/parse - OpenAI result:", result);
            console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
            return result;
          } catch (openaiError) {
            console.error("[API] /api/agent/parse - OpenAI fallback also failed:", openaiError);
            // Final fallback to regex
            const result = await parseWithRegex(text);
            console.log("[API] /api/agent/parse - Using regex fallback");
            console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
            return result;
          }
        } else {
          // Fallback to regex
          const result = await parseWithRegex(text);
          console.log("[API] /api/agent/parse - Using regex fallback");
          console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
          return result;
        }
      }
    }

    // Try OpenAI if Anthropic is not available
    if (openaiKey) {
      try {
        console.log("[API] /api/agent/parse - Attempting OpenAI parsing");
        const result = await parseWithOpenAI(text, openaiKey);
        console.log("[API] /api/agent/parse - OpenAI result:", result);
        console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
        return result;
      } catch (error) {
        console.error("[API] /api/agent/parse - OpenAI parsing failed:", error);
        // Fallback to regex
        const result = await parseWithRegex(text);
        console.log("[API] /api/agent/parse - Using regex fallback");
        console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
        return result;
      }
    }

    // No API keys available, use regex fallback
    console.log("[API] /api/agent/parse - No API keys found, using regex fallback");
    const result = await parseWithRegex(text);
    console.log("[API] /api/agent/parse - Regex result:", result);
    console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
    return result;
  } catch (error: any) {
    console.error("[API] /api/agent/parse - Parse error:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    console.log(`[API] /api/agent/parse - Request failed in ${Date.now() - startTime}ms`);
    return NextResponse.json(
      { error: "Failed to parse intent", details: error.message },
      { status: 500 }
    );
  }
}

async function parseWithOpenAI(text: string, apiKey: string) {
  console.log("[API] parseWithOpenAI - Calling OpenAI API");
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an intent parser for an IoT device control system. Parse user commands and return JSON with: { action: string, device?: string, params?: object }. Actions can be: unlock, print, charge, etc. Devices are identified by name or ID.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    console.log("[API] parseWithOpenAI - Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] parseWithOpenAI - Error response:", errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[API] parseWithOpenAI - Response data received");
    const parsed = JSON.parse(data.choices[0].message.content);
    console.log("[API] parseWithOpenAI - Parsed intent:", parsed);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[API] parseWithOpenAI - Exception:", error.message);
    throw error;
  }
}

async function parseWithAnthropic(text: string, apiKey: string) {
  console.log("[API] parseWithAnthropic - Calling Anthropic API");
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: "You are an intent parser for an IoT device control system. Parse user commands in natural language and return ONLY valid JSON. The JSON must have this exact structure: { \"action\": string, \"device\": string (optional), \"params\": object (optional) }. Actions can be: unlock, print, charge, etc. Devices are identified by name, ID, or type. Return ONLY the JSON object, no additional text or explanation.",
        messages: [
          {
            role: "user",
            content: `Parse this IoT device command and return ONLY valid JSON: "${text}"\n\nReturn format: { "action": "unlock" | "print" | "charge", "device": "device-id-or-name" (optional), "params": {} (optional) }`,
          },
        ],
      }),
    });

    console.log("[API] parseWithAnthropic - Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] parseWithAnthropic - Error response:", errorText);
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[API] parseWithAnthropic - Response data received");
    const content = data.content[0].text;
    const parsed = JSON.parse(content);
    console.log("[API] parseWithAnthropic - Parsed intent:", parsed);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[API] parseWithAnthropic - Exception:", error.message);
    throw error;
  }
}

function parseWithRegex(text: string) {
  console.log("[API] parseWithRegex - Parsing with regex");
  const lowerText = text.toLowerCase();

  // Simple regex-based parsing
  let action = "unlock";
  let device: string | undefined;

  if (lowerText.includes("unlock") || lowerText.includes("desbloquear")) {
    action = "unlock";
  } else if (lowerText.includes("print") || lowerText.includes("imprimir")) {
    action = "print";
  } else if (lowerText.includes("charge") || lowerText.includes("cargar")) {
    action = "charge";
  }

  // Try to extract device ID or name
  const deviceMatch = text.match(
    /(?:device|dispositivo|lock|impresora|printer|estaci[oó]n)\s+([a-z0-9-]+)/i
  );
  if (deviceMatch) {
    device = deviceMatch[1];
  }

  const result = {
    action,
    device,
    confidence: 0.7,
  };
  
  console.log("[API] parseWithRegex - Result:", result);
  return NextResponse.json(result);
}

