import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const generateSchema = z.object({
  description: z.string().trim().min(3, "Description is required.").max(280),
});

const responseSchema = z.object({
  titleSuggestion: z.string().trim().min(1).max(120).optional(),
  promptDraft: z.string().trim().min(20).max(12000),
});

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function normalizeTitle(description: string) {
  return description
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ") || "Agent Prompt";
}

function buildMockDraft(description: string) {
  const titleSuggestion = normalizeTitle(description);

  const promptDraft = [
    "You are a reliable assistant built for BlackDesk.",
    "",
    "Primary goal:",
    `- Help with: ${description.trim()}.`,
    "",
    "Operating rules:",
    "- Ask concise clarification questions when requirements are ambiguous.",
    "- Offer a clear plan first, then execute in ordered steps.",
    "- Keep outputs structured and actionable.",
    "- State assumptions explicitly and confirm high-impact decisions.",
    "",
    "Output style:",
    "- Use short sections with clear headings.",
    "- Prefer bullet points for plans and checklists.",
    "- End with next steps the user can choose from.",
  ].join("\n");

  return {
    titleSuggestion,
    promptDraft,
  };
}

function extractOutputText(payload: OpenAIResponsesPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const outputItem of payload.output ?? []) {
    for (const content of outputItem.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  return null;
}

async function generateWithOpenAI(description: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      max_output_tokens: 420,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You create concise system prompt drafts for agents.",
                "Return strict JSON only.",
                'JSON shape: {"titleSuggestion":"string","promptDraft":"string"}.',
                "The draft must be practical and immediately usable.",
                "Keep it under 220 words.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Description: ${description}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OpenAIResponsesPayload;
  const text = extractOutputText(payload);
  if (!text) {
    return null;
  }

  try {
    const parsed = responseSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = generateSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid generation payload." },
        { status: 400 },
      );
    }

    const description = payload.data.description;
    const generated = await generateWithOpenAI(description);

    if (generated) {
      return NextResponse.json(generated);
    }

    return NextResponse.json(buildMockDraft(description));
  } catch {
    return NextResponse.json(
      { error: "Unable to generate prompt draft." },
      { status: 500 },
    );
  }
}
