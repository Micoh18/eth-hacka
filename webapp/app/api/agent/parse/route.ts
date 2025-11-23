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

    // Step 1: Try regex first (fast and cheap)
    console.log("[API] /api/agent/parse - Step 1: Attempting regex parsing");
    const regexData = parseWithRegex(text);
    
    console.log("[API] /api/agent/parse - Regex result:", regexData);
    
    // Check if regex understood the message (high confidence or clear action)
    const regexUnderstood = 
      regexData.confidence && regexData.confidence >= 0.8 || // High confidence
      (regexData.type === "action" && regexData.action); // Clear action detected
    
    if (regexUnderstood) {
      console.log("[API] /api/agent/parse - Regex understood the message, using regex result");
      console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
      return NextResponse.json(regexData);
    }

    // Step 2: Regex didn't understand, try with AI
    console.log("[API] /api/agent/parse - Regex didn't understand, falling back to AI");
    
    // Try Anthropic first (preferred), then OpenAI
    if (anthropicKey) {
      try {
        console.log("[API] /api/agent/parse - Attempting Anthropic parsing");
        const result = await parseWithAnthropic(text, anthropicKey);
        console.log("[API] /api/agent/parse - Anthropic result:", result);
        console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
        return result;
      } catch (error) {
        console.error("[API] /api/agent/parse - Anthropic parsing failed:", error);
        // Fallback to OpenAI if available
        if (openaiKey) {
          try {
            console.log("[API] /api/agent/parse - Falling back to OpenAI");
            const result = await parseWithOpenAI(text, openaiKey);
            console.log("[API] /api/agent/parse - OpenAI result:", result);
            console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
            return result;
          } catch (openaiError) {
            console.error("[API] /api/agent/parse - OpenAI fallback also failed:", openaiError);
            // Return regex result as final fallback
            console.log("[API] /api/agent/parse - All AI parsing failed, using regex result");
            console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
            return NextResponse.json(regexData);
          }
        } else {
          // No OpenAI key, return regex result
          console.log("[API] /api/agent/parse - No OpenAI key, using regex result");
          console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
          return NextResponse.json(regexData);
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
        // Return regex result as fallback
        console.log("[API] /api/agent/parse - OpenAI failed, using regex result");
        console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
        return NextResponse.json(regexData);
      }
    }

    // No API keys available, use regex result
    console.log("[API] /api/agent/parse - No API keys found, using regex result");
    console.log(`[API] /api/agent/parse - Request completed in ${Date.now() - startTime}ms`);
    return NextResponse.json(regexData);
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
              "You are an intelligent assistant for an IoT device control system. Determine if the user's message is an executable action or a conversation.\n\nIf ACTION: Return { \"type\": \"action\", \"action\": string, \"device\": string (optional), \"params\": object (optional) }\n\nIf CONVERSATION: Return { \"type\": \"chat\", \"message\": string } with a helpful response.",
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
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: "You are an intelligent assistant for an IoT device control system called 'Command Center'. Your job is to determine if the user's message is an executable action (like 'unlock door', 'print document', 'charge vehicle') or a conversational message (like greetings, questions, or general chat).\n\nIf it's an ACTION: Return JSON with type 'action': { \"type\": \"action\", \"action\": string, \"device\": string (optional), \"params\": object (optional) }\n\nIf it's a CONVERSATION: Return JSON with type 'chat' and provide a helpful, natural, conversational response in Spanish. Be friendly and helpful. If they ask about capabilities, explain what actions they can perform (unlock devices, print documents, charge vehicles). If they greet you, greet them back naturally. { \"type\": \"chat\", \"message\": string }\n\nActions can be: unlock, print, charge, etc. Devices are identified by name, ID, or type. Return ONLY valid JSON, no additional text.",
        messages: [
          {
            role: "user",
            content: `Analyze this message and determine if it's an executable action or a conversation:\n\n"${text}"\n\nIf it's an action, return: { "type": "action", "action": "unlock" | "print" | "charge", "device": "device-id-or-name" (optional), "params": {} (optional) }\n\nIf it's a conversation (greeting, question, general chat), return: { "type": "chat", "message": "your helpful, natural response in Spanish here" }`,
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
  const lowerText = text.toLowerCase().trim();

  // Check if it's a clear conversational message (greetings, questions, etc.)
  const isClearConversation = 
    lowerText.match(/^(hola|hi|hello|hey|buenos|buenas|gracias|thanks|thank you|por favor|please)$/i) ||
    (lowerText.match(/\?$/) && lowerText.length < 50) || // Short questions
    lowerText.match(/^(qué|que|what|how|cuál|which|dónde|where|cuándo|when|quién|who|por qué|why)\s/i);

  if (isClearConversation) {
    const result = {
      type: "chat" as const,
      message: "Hola! Puedo ayudarte a ejecutar acciones en dispositivos IoT. Por ejemplo, puedes decirme 'Desbloquear smart lock', 'Imprimir en Lab 3', o 'Cargar en estación 1'. ¿En qué puedo ayudarte?",
      confidence: 0.9, // High confidence for clear conversations
    };
    console.log("[API] parseWithRegex - Detected clear conversation, result:", result);
    return result; // Return object, not NextResponse
  }

  // Simple regex-based parsing for actions
  let action: string | undefined;
  let device: string | undefined;
  let confidence = 0.5; // Low confidence by default

  // Check for action keywords with high confidence patterns
  const actionPatterns = [
    { keywords: ["unlock", "desbloquear", "abrir"], action: "unlock", confidence: 0.9 },
    { keywords: ["print", "imprimir"], action: "print", confidence: 0.9 },
    { keywords: ["charge", "cargar"], action: "charge", confidence: 0.9 },
    { keywords: ["dispense", "dispensar"], action: "dispense", confidence: 0.9 },
    { keywords: ["capture", "capturar"], action: "capture", confidence: 0.9 },
  ];

  for (const pattern of actionPatterns) {
    if (pattern.keywords.some(keyword => lowerText.includes(keyword))) {
      action = pattern.action;
      confidence = pattern.confidence;
      break;
    }
  }

  // If no clear action found, low confidence
  if (!action) {
    const result = {
      type: "chat" as const,
      message: "No entendí tu mensaje. ¿Podrías ser más específico? Por ejemplo: 'Desbloquear smart lock', 'Imprimir documento', o 'Cargar vehículo'.",
      confidence: 0.3, // Low confidence - should trigger AI parsing
    };
    console.log("[API] parseWithRegex - No clear action detected, low confidence, result:", result);
    return result; // Return object, not NextResponse
  }

  // Try to extract device ID or name with better patterns
  const devicePatterns = [
    /(?:en|in|on|at)\s+([a-z0-9\s-]+?)(?:\s|$|,|\.)/i, // "en Lab 3", "in station 1"
    /(?:device|dispositivo|lock|impresora|printer|estaci[oó]n|lab|station)\s+([a-z0-9-]+)/i,
    /(?:smart\s+lock|3d\s+printer|ev\s+charger|vending\s+machine)/i,
  ];

  for (const pattern of devicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      device = match[1].trim();
      confidence = Math.min(confidence + 0.1, 0.95); // Boost confidence if device found
      break;
    }
  }

  const result = {
    type: "action" as const,
    action,
    device,
    confidence,
  };
  
  console.log("[API] parseWithRegex - Detected action, result:", result);
  return result; // Return object, not NextResponse
}

