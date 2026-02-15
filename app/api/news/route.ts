import {
  NEWS_CATEGORIES,
  fetchNewsForCategory,
  isNewsCategory,
} from "@/lib/news";
import { getAuthUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const categoryParam = requestUrl.searchParams.get("category") ?? "local";

  if (!isNewsCategory(categoryParam)) {
    return NextResponse.json(
      {
        error: "Invalid news category.",
        categories: NEWS_CATEGORIES,
      },
      { status: 400 },
    );
  }

  try {
    const articles = await fetchNewsForCategory(categoryParam);

    return NextResponse.json({
      category: categoryParam,
      categories: NEWS_CATEGORIES,
      articles,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        category: categoryParam,
        categories: NEWS_CATEGORIES,
        articles: [],
        error: "Unable to load news right now.",
      },
      { status: 200 },
    );
  }
}
