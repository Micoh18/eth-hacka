import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Get API key from environment
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiKey && !anthropicKey) {
      // Fallback to simple regex-based parsing for demo
      return parseWithRegex(text);
    }

    // Try OpenAI first, then Anthropic
    if (openaiKey) {
      try {
        return await parseWithOpenAI(text, openaiKey);
      } catch (error) {
        console.error("OpenAI parsing failed:", error);
        // Fallback to regex
        return parseWithRegex(text);
      }
    }

    if (anthropicKey) {
      try {
        return await parseWithAnthropic(text, anthropicKey);
      } catch (error) {
        console.error("Anthropic parsing failed:", error);
        // Fallback to regex
        return parseWithRegex(text);
      }
    }

    return parseWithRegex(text);
  } catch (error: any) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse intent", details: error.message },
      { status: 500 }
    );
  }
}

async function parseWithOpenAI(text: string, apiKey: string) {
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

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return NextResponse.json(parsed);
}

async function parseWithAnthropic(text: string, apiKey: string) {
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
      messages: [
        {
          role: "user",
          content: `Parse this IoT command and return JSON: "${text}". Format: { action: string, device?: string, params?: object }`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;
  const parsed = JSON.parse(content);
  return NextResponse.json(parsed);
}

function parseWithRegex(text: string) {
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

  return NextResponse.json({
    action,
    device,
    confidence: 0.7,
  });
}

