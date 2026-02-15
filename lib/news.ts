const RSS_FEEDS = {
  local:
    "https://news.google.com/rss/search?q=United+States+local+news&hl=en-US&gl=US&ceid=US:en",
  international:
    "https://news.google.com/rss/search?q=international+news&hl=en-US&gl=US&ceid=US:en",
  tech:
    "https://news.google.com/rss/search?q=technology+news&hl=en-US&gl=US&ceid=US:en",
  crypto:
    "https://news.google.com/rss/search?q=cryptocurrency+news&hl=en-US&gl=US&ceid=US:en",
  ai: "https://news.google.com/rss/search?q=artificial+intelligence+news&hl=en-US&gl=US&ceid=US:en",
  other: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
} as const;

export const NEWS_CATEGORIES = [
  { key: "local", label: "Local" },
  { key: "international", label: "International" },
  { key: "tech", label: "Tech" },
  { key: "crypto", label: "Crypto" },
  { key: "ai", label: "AI" },
  { key: "other", label: "Other" },
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number]["key"];

export type NewsArticle = {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
};

const TAG_STRIP_REGEX = /<[^>]*>/g;

export function isNewsCategory(value: string): value is NewsCategory {
  return NEWS_CATEGORIES.some((category) => category.key === value);
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripCData(value: string) {
  const match = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  return match ? match[1] : value;
}

function readTag(block: string, tagName: string) {
  const tagPattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const match = block.match(tagPattern);

  if (!match) {
    return "";
  }

  return decodeEntities(
    stripCData(match[1]).replace(TAG_STRIP_REGEX, "").trim(),
  );
}

function parseRssItems(xml: string) {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches
    .map((item) => {
      const title = readTag(item, "title");
      const url = readTag(item, "link");
      const source = readTag(item, "source") || null;
      const pubDate = readTag(item, "pubDate");
      const parsedDate = pubDate ? new Date(pubDate) : null;

      if (!title || !url) {
        return null;
      }

      return {
        title,
        url,
        source,
        publishedAt:
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : null,
      } satisfies NewsArticle;
    })
    .filter((item): item is NewsArticle => Boolean(item))
    .slice(0, 20);
}

export async function fetchNewsForCategory(category: NewsCategory) {
  const feedUrl = RSS_FEEDS[category];
  const response = await fetch(feedUrl, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch news feed for ${category}.`);
  }

  const xml = await response.text();
  return parseRssItems(xml);
}
