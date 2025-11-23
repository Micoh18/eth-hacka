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
              `You are an intelligent assistant for an IoT device control system. Determine if the user's message is an executable action or a conversation. IMPORTANT: Always respond in English, never in Spanish or any other language.

AVAILABLE DEVICES (4 total):
1. smart_lock - Actions: unlock (0.001 ETH), lock (free)
2. 3d_printer - Actions: print (0.002 ETH), buy_filament (0.003 ETH), pause/cancel (free)
3. ev_charger - Actions: charge (0.005 ETH), stop (free)
4. vending_machine - Actions: dispense (0.003 ETH), restock (0.004 ETH), check_inventory (free)

BE FLEXIBLE: Understand natural language commands like "I want to print", "I need to charge", "Open the door", "Give me a drink" - these are all valid actions.
Map natural language to actions: "I want to print" → print, "I need to charge" → charge, "open" → unlock, "give me" → dispense, "restock" → restock

If ACTION: Return { "type": "action", "action": string, "device": string (optional), "params": object (optional) }
If CONVERSATION: Return { "type": "chat", "message": string } with a helpful response in English ONLY. Never respond in Spanish or any other language. Guide users about available devices and actions.`,
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
        system: `You are an intelligent assistant for an IoT device control system called 'Command Center'. Your job is to determine if the user's message is an executable action or a conversational message. IMPORTANT: Always respond in English, never in Spanish or any other language.

AVAILABLE DEVICES (4 total):
1. smart_lock - Smart lock devices (e.g., "smart_lock_01")
   - Actions: unlock (0.001 ETH), lock (free), check_access_log (free)
   - Example: "Unlock door", "Open the door", "I need to enter", "Lock the door"

2. 3d_printer - 3D printer devices (e.g., "printer_3d_01")
   - Actions: print (0.002 ETH), buy_filament (0.003 ETH), pause (free), cancel (free)
   - Example: "Print document", "Print on Lab 3", "Buy filament PLA", "I want to print something", "I need ink"

3. ev_charger - EV charging stations (e.g., "ev_station_01")
   - Actions: charge (0.005 ETH), stop (free), check_availability (free)
   - Example: "Charge vehicle", "Charge at station 1", "Stop charging", "I need to charge my car", "Finish charging"

4. vending_machine - Vending machines (e.g., "vending_machine_01")
   - Actions: dispense (0.003 ETH), restock (0.004 ETH), check_inventory (free)
   - Example: "Dispense product", "Dispense from vending machine", "Restock slot 5", "Give me a drink", "Restock products"

INSTRUCTIONS:
- Be FLEXIBLE with natural language. Users may say things like "I want to print", "I need to charge", "Open the door", "Give me a drink" - these are all valid actions.
- Extract the intent even if the command is informal or incomplete.
- If it's an ACTION: Return JSON with type 'action': { "type": "action", "action": string, "device": string (optional), "params": object (optional) }
- If it's a CONVERSATION: Return JSON with type 'chat' and provide a helpful, natural response in English ONLY. Never respond in Spanish or any other language. Be friendly and guide users about available devices and actions.
- When users ask about capabilities, list all 4 devices and their actions.
- When users greet you, greet them back and offer to help with device actions.
- Actions can be: unlock, lock, print, buy_filament, pause, cancel, charge, stop, dispense, restock, check_inventory, check_availability, check_access_log
- Map natural language to actions: "I want to print" → print, "I need to charge" → charge, "open" → unlock, "give me" → dispense, "restock" → restock
- Return ONLY valid JSON, no additional text.`,
        messages: [
          {
            role: "user",
            content: `Analyze this message and determine if it's an executable action or a conversation:\n\n"${text}"\n\nAVAILABLE ACTIONS:
- unlock/lock (smart_lock): Unlock or lock a smart lock device
- print (3d_printer): Print a document on a 3D printer
- buy_filament (3d_printer): Purchase filament material (PLA, ABS, PETG, TPU)
- pause/cancel (3d_printer): Pause or cancel a print job
- charge/stop (ev_charger): Start or stop a vehicle charging session
- dispense (vending_machine): Dispense a product from a vending machine
- restock (vending_machine): Restock products in a vending machine
- check_inventory (vending_machine): Check available products

If it's an action, return: { "type": "action", "action": "unlock" | "print" | "charge" | "dispense" | "restock" | etc., "device": "device-id-or-name" (optional), "params": {} (optional) }\n\nIf it's a conversation (greeting, question about capabilities, general chat), return: { "type": "chat", "message": "your helpful, natural response in English ONLY here. Never use Spanish or any other language. If they ask about capabilities, mention all 4 devices and their main actions." }`,
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
      message: "Hello! I can help you execute actions on IoT devices. We have 4 devices available:\n\n1. **Smart Lock** - Unlock/Lock (0.001 ETH)\n2. **3D Printer** - Print documents, buy filament (0.002-0.003 ETH)\n3. **EV Charger** - Charge vehicles (0.005 ETH)\n4. **Vending Machine** - Dispense products, restock (0.003-0.004 ETH)\n\nExamples: 'Unlock smart lock', 'Print document', 'Charge vehicle', 'Dispense product'. How can I help you?",
      confidence: 0.9, // High confidence for clear conversations
    };
    console.log("[API] parseWithRegex - Detected clear conversation, result:", result);
    return result; // Return object, not NextResponse
  }

  // Simple regex-based parsing for actions
  let action: string | undefined;
  let device: string | undefined;
  let confidence = 0.5; // Low confidence by default

  // Check for action keywords with high confidence patterns (including natural language)
  const actionPatterns = [
    { keywords: ["unlock", "desbloquear", "abrir", "abre", "necesito entrar", "quiero entrar"], action: "unlock", confidence: 0.9 },
    { keywords: ["lock", "bloquear", "cerrar", "cierra"], action: "lock", confidence: 0.9 },
    { keywords: ["print", "imprimir", "quiero imprimir", "necesito imprimir", "imprime"], action: "print", confidence: 0.9 },
    { keywords: ["charge", "cargar", "necesito cargar", "quiero cargar", "carga"], action: "charge", confidence: 0.9 },
    { keywords: ["stop", "detener", "parar", "termina", "detén"], action: "stop", confidence: 0.9 },
    { keywords: ["dispense", "dispensar", "sacar", "dame", "quiero", "necesito una"], action: "dispense", confidence: 0.85 },
    { keywords: ["restock", "reabastecer", "reponer", "reponer productos"], action: "restock", confidence: 0.9 },
    { keywords: ["buy", "comprar", "purchase", "necesito tinta", "necesito filamento", "comprar tinta"], action: "buy_filament", confidence: 0.8 },
    { keywords: ["pause", "pausar", "pausa"], action: "pause", confidence: 0.9 },
    { keywords: ["cancel", "cancelar", "cancela"], action: "cancel", confidence: 0.9 },
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
      message: "I didn't understand your message. Could you be more specific? We have 4 devices available:\n\n• **Smart Lock**: Unlock/Lock\n• **3D Printer**: Print, Buy filament, Pause/Cancel\n• **EV Charger**: Charge vehicle, Stop charging\n• **Vending Machine**: Dispense product, Restock\n\nExamples: 'Unlock smart lock', 'Print document', 'Charge vehicle', 'Dispense product'.",
      confidence: 0.3, // Low confidence - should trigger AI parsing
    };
    console.log("[API] parseWithRegex - No clear action detected, low confidence, result:", result);
    return result; // Return object, not NextResponse
  }

  // Try to extract device ID or name with better patterns
  const devicePatterns = [
    /(?:en|in|on|at)\s+([a-z0-9\s-]+?)(?:\s|$|,|\.)/i, // "en Lab 3", "in station 1"
    /(?:device|dispositivo|lock|impresora|printer|estaci[oó]n|lab|station)\s+([a-z0-9-]+)/i,
    /(?:smart\s+lock|3d\s+printer|ev\s+charger|vending\s+machine|máquina\s+expendedora|expendedora)/i,
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

