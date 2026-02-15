import { isLlmProvider, type LlmProvider } from "@/lib/llm-config";
import { z } from "zod";

const topicResponseSchema = z.object({
  topics: z.array(z.string().trim().min(2).max(60)).min(1).max(8),
});

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "we",
  "what",
  "when",
  "with",
  "you",
  "your",
]);

type BuildForYouTopicsArgs = {
  messages: string[];
  provider?: string | null;
  model?: string | null;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  googleApiKey?: string | null;
};

function sanitizeTopic(topic: string) {
  return topic
    .replace(/["`']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function normalizeTopics(topics: string[]) {
  const dedupeKeys = new Set<string>();
  const normalized: string[] = [];

  for (const rawTopic of topics) {
    const cleaned = sanitizeTopic(rawTopic);
    if (!cleaned) {
      continue;
    }

    const dedupeKey = cleaned.toLowerCase();
    if (dedupeKeys.has(dedupeKey)) {
      continue;
    }

    dedupeKeys.add(dedupeKey);
    normalized.push(cleaned);

    if (normalized.length >= 6) {
      break;
    }
  }

  return normalized;
}

function parseTopicsFromJson(raw: string) {
  const text = raw.trim();

  const parseCandidates: string[] = [text];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    parseCandidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const validated = topicResponseSchema.safeParse(parsed);
      if (!validated.success) {
        continue;
      }

      return normalizeTopics(validated.data.topics);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function keywordTopicsFromMessages(messages: string[]) {
  const frequency = new Map<string, number>();

  for (const message of messages) {
    const words = message.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];

    for (const word of words) {
      if (STOP_WORDS.has(word)) {
        continue;
      }

      const count = frequency.get(word) ?? 0;
      frequency.set(word, count + 1);
    }
  }

  const sorted = [...frequency.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 6)
    .map(([word]) => word);

  const topics = normalizeTopics(sorted);

  if (topics.length > 0) {
    return topics;
  }

  return ["productivity", "technology", "business"];
}

function selectProvider(args: BuildForYouTopicsArgs): LlmProvider | null {
  if (args.provider && isLlmProvider(args.provider)) {
    if (args.provider === "openai" && args.openaiApiKey) {
      return "openai";
    }
    if (args.provider === "anthropic" && args.anthropicApiKey) {
      return "anthropic";
    }
    if (args.provider === "google" && args.googleApiKey) {
      return "google";
    }
  }

  if (args.openaiApiKey) {
    return "openai";
  }
  if (args.anthropicApiKey) {
    return "anthropic";
  }
  if (args.googleApiKey) {
    return "google";
  }

  return null;
}

async function requestOpenAiTopics(args: {
  apiKey: string;
  model: string;
  context: string;
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.3,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract personalized news interests from user chat snippets. Return strict JSON only: {\"topics\":[\"topic one\",\"topic two\"]}. 3-6 concise topics, each max 4 words.",
        },
        {
          role: "user",
          content: `Chat snippets:\n${args.context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  return parseTopicsFromJson(content);
}

async function requestAnthropicTopics(args: {
  apiKey: string;
  model: string;
  context: string;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 200,
      temperature: 0.3,
      system:
        "Extract personalized news interests from user chat snippets. Return strict JSON only with {\"topics\":[...]}. 3-6 concise topics, max 4 words each.",
      messages: [
        {
          role: "user",
          content: `Chat snippets:\n${args.context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = payload.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return null;
  }

  return parseTopicsFromJson(text);
}

async function requestGoogleTopics(args: {
  apiKey: string;
  model: string;
  context: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 220,
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Extract personalized news interests from user chat snippets.",
                  "Return strict JSON only: {\"topics\":[\"topic one\",\"topic two\"]}.",
                  "Return 3-6 concise topics with max 4 words each.",
                  "",
                  `Chat snippets:\n${args.context}`,
                ].join("\n"),
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return null;
  }

  return parseTopicsFromJson(text);
}

export async function buildForYouTopics(args: BuildForYouTopicsArgs) {
  const recentMessages = args.messages
    .map((message) => message.trim())
    .filter((message) => message.length > 0)
    .slice(-20);

  if (recentMessages.length === 0) {
    return {
      topics: ["productivity", "technology", "business"],
      source: "heuristic" as const,
    };
  }

  const provider = selectProvider(args);
  const fallbackTopics = keywordTopicsFromMessages(recentMessages);

  if (!provider) {
    return {
      topics: fallbackTopics,
      source: "heuristic" as const,
    };
  }

  const context = recentMessages.map((message, index) => `${index + 1}. ${message}`).join("\n");
  const preferredModel = args.model?.trim();
  let aiTopics: string[] | null = null;

  try {
    if (provider === "openai" && args.openaiApiKey) {
      aiTopics = await requestOpenAiTopics({
        apiKey: args.openaiApiKey,
        model: preferredModel || "gpt-4o-mini",
        context,
      });
    } else if (provider === "anthropic" && args.anthropicApiKey) {
      aiTopics = await requestAnthropicTopics({
        apiKey: args.anthropicApiKey,
        model: preferredModel || "claude-3-5-haiku-latest",
        context,
      });
    } else if (provider === "google" && args.googleApiKey) {
      aiTopics = await requestGoogleTopics({
        apiKey: args.googleApiKey,
        model: preferredModel || "gemini-1.5-flash",
        context,
      });
    }
  } catch {
    aiTopics = null;
  }

  if (aiTopics && aiTopics.length > 0) {
    return {
      topics: aiTopics,
      source: "ai" as const,
    };
  }

  return {
    topics: fallbackTopics,
    source: "heuristic" as const,
  };
}
