import {
  NEWS_CATEGORIES,
  fetchNewsForCategory,
  isNewsCategory,
  resolveNewsLocaleFromProfile,
} from "@/lib/news";
import { buildForYouTopics } from "@/lib/news-personalization";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const categoryParam = requestUrl.searchParams.get("category") ?? "for_you";

  if (!isNewsCategory(categoryParam)) {
    return NextResponse.json(
      {
        error: "Invalid news category.",
        categories: NEWS_CATEGORIES,
      },
      { status: 400 },
    );
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      location: true,
      timezone: true,
    },
  });

  const locale = resolveNewsLocaleFromProfile({
    location: userProfile?.location,
    timezone: userProfile?.timezone,
  });

  let forYouTopics: string[] | undefined;
  let personalizationSource: "ai" | "heuristic" | null = null;

  if (categoryParam === "for_you") {
    const [recentMessages, llmSettings] = await Promise.all([
      prisma.agentMessage.findMany({
        where: {
          role: "user",
          conversation: {
            userId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 40,
        select: {
          content: true,
        },
      }),
      prisma.userLlmSettings.findUnique({
        where: { userId },
        select: {
          provider: true,
          model: true,
          openaiApiKeyEnc: true,
          anthropicApiKeyEnc: true,
          googleApiKeyEnc: true,
        },
      }),
    ]);

    const personalization = await buildForYouTopics({
      messages: recentMessages.map((message) => message.content),
      provider: llmSettings?.provider,
      model: llmSettings?.model,
      openaiApiKey: decryptSecret(llmSettings?.openaiApiKeyEnc),
      anthropicApiKey: decryptSecret(llmSettings?.anthropicApiKeyEnc),
      googleApiKey: decryptSecret(llmSettings?.googleApiKeyEnc),
    });

    forYouTopics = personalization.topics;
    personalizationSource = personalization.source;
  }

  try {
    const articles = await fetchNewsForCategory(categoryParam, {
      locale,
      forYouTopics,
    });

    return NextResponse.json({
      category: categoryParam,
      categories: NEWS_CATEGORIES,
      articles,
      locale: {
        countryCode: locale.countryCode,
        countryName: locale.countryName,
      },
      forYouTopics,
      personalizationSource,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        category: categoryParam,
        categories: NEWS_CATEGORIES,
        articles: [],
        locale: {
          countryCode: locale.countryCode,
          countryName: locale.countryName,
        },
        forYouTopics,
        personalizationSource,
        error: "Unable to load news right now.",
      },
      { status: 200 },
    );
  }
}
