const NEWS_SEARCH_QUERIES = {
  international: "international world news",
  tech: "technology news",
  crypto: "cryptocurrency news",
  ai: "artificial intelligence news",
} as const;

type CountryConfig = {
  countryCode: string;
  countryName: string;
  languageCode: string;
};

const DEFAULT_COUNTRY: CountryConfig = {
  countryCode: "US",
  countryName: "United States",
  languageCode: "en-US",
};

const COUNTRY_CONFIG_BY_CODE: Record<string, CountryConfig> = {
  US: { countryCode: "US", countryName: "United States", languageCode: "en-US" },
  CA: { countryCode: "CA", countryName: "Canada", languageCode: "en-CA" },
  GB: { countryCode: "GB", countryName: "United Kingdom", languageCode: "en-GB" },
  AU: { countryCode: "AU", countryName: "Australia", languageCode: "en-AU" },
  NZ: { countryCode: "NZ", countryName: "New Zealand", languageCode: "en-NZ" },
  IN: { countryCode: "IN", countryName: "India", languageCode: "en-IN" },
  LK: { countryCode: "LK", countryName: "Sri Lanka", languageCode: "en" },
  SG: { countryCode: "SG", countryName: "Singapore", languageCode: "en-SG" },
  AE: { countryCode: "AE", countryName: "United Arab Emirates", languageCode: "en" },
  SA: { countryCode: "SA", countryName: "Saudi Arabia", languageCode: "ar" },
  JP: { countryCode: "JP", countryName: "Japan", languageCode: "ja" },
  KR: { countryCode: "KR", countryName: "South Korea", languageCode: "ko" },
  DE: { countryCode: "DE", countryName: "Germany", languageCode: "de" },
  FR: { countryCode: "FR", countryName: "France", languageCode: "fr" },
  ES: { countryCode: "ES", countryName: "Spain", languageCode: "es" },
  IT: { countryCode: "IT", countryName: "Italy", languageCode: "it" },
  BR: { countryCode: "BR", countryName: "Brazil", languageCode: "pt-BR" },
  MX: { countryCode: "MX", countryName: "Mexico", languageCode: "es-MX" },
  ZA: { countryCode: "ZA", countryName: "South Africa", languageCode: "en-ZA" },
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "US",
  "united states": "US",
  america: "US",
  canada: "CA",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  australia: "AU",
  "new zealand": "NZ",
  india: "IN",
  "sri lanka": "LK",
  singapore: "SG",
  uae: "AE",
  "united arab emirates": "AE",
  "saudi arabia": "SA",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  germany: "DE",
  france: "FR",
  spain: "ES",
  italy: "IT",
  brazil: "BR",
  mexico: "MX",
  "south africa": "ZA",
};

const TIMEZONE_PREFIX_COUNTRY: Array<{ prefix: string; code: string }> = [
  { prefix: "America/", code: "US" },
  { prefix: "Canada/", code: "CA" },
  { prefix: "Europe/London", code: "GB" },
  { prefix: "Europe/Berlin", code: "DE" },
  { prefix: "Europe/Paris", code: "FR" },
  { prefix: "Europe/Madrid", code: "ES" },
  { prefix: "Europe/Rome", code: "IT" },
  { prefix: "Asia/Kolkata", code: "IN" },
  { prefix: "Asia/Colombo", code: "LK" },
  { prefix: "Asia/Singapore", code: "SG" },
  { prefix: "Asia/Tokyo", code: "JP" },
  { prefix: "Asia/Seoul", code: "KR" },
  { prefix: "Australia/", code: "AU" },
  { prefix: "Pacific/Auckland", code: "NZ" },
  { prefix: "America/Sao_Paulo", code: "BR" },
  { prefix: "Africa/Johannesburg", code: "ZA" },
  { prefix: "Asia/Dubai", code: "AE" },
  { prefix: "Asia/Riyadh", code: "SA" },
];

export const NEWS_CATEGORIES = [
  { key: "for_you", label: "For you" },
  { key: "local", label: "Local" },
  { key: "international", label: "International" },
  { key: "tech", label: "Tech" },
  { key: "crypto", label: "Crypto" },
  { key: "ai", label: "AI" },
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number]["key"];

export type NewsArticle = {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
};

export type NewsLocale = {
  countryCode: string;
  countryName: string;
  languageCode: string;
};

type FetchNewsOptions = {
  locale?: NewsLocale;
  forYouTopics?: string[];
};

const TAG_STRIP_REGEX = /<[^>]*>/g;

export function isNewsCategory(value: string): value is NewsCategory {
  return NEWS_CATEGORIES.some((category) => category.key === value);
}

function normalizeTerm(value: string) {
  return value.trim().toLowerCase();
}

function resolveCountryByCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return COUNTRY_CONFIG_BY_CODE[code.trim().toUpperCase()] ?? null;
}

function resolveCountryByLocation(location: string | null | undefined) {
  if (!location) {
    return null;
  }

  const normalized = normalizeTerm(location);
  const aliases = Object.keys(COUNTRY_ALIASES).sort(
    (left, right) => right.length - left.length,
  );

  for (const alias of aliases) {
    if (normalized === alias || normalized.includes(alias)) {
      const countryCode = COUNTRY_ALIASES[alias];
      return resolveCountryByCode(countryCode);
    }
  }

  const segments = normalized.split(",").map((segment) => segment.trim());
  const lastSegment = segments[segments.length - 1];

  if (lastSegment && COUNTRY_ALIASES[lastSegment]) {
    return resolveCountryByCode(COUNTRY_ALIASES[lastSegment]);
  }

  return null;
}

function resolveCountryByTimezone(timezone: string | null | undefined) {
  if (!timezone) {
    return null;
  }

  const normalized = timezone.trim();

  for (const entry of TIMEZONE_PREFIX_COUNTRY) {
    if (normalized.startsWith(entry.prefix)) {
      return resolveCountryByCode(entry.code);
    }
  }

  return null;
}

export function resolveNewsLocaleFromProfile(profile: {
  location?: string | null;
  timezone?: string | null;
}) {
  return (
    resolveCountryByLocation(profile.location) ??
    resolveCountryByTimezone(profile.timezone) ??
    DEFAULT_COUNTRY
  );
}

function buildSearchFeedUrl(args: {
  query: string;
  countryCode: string;
  languageCode: string;
}) {
  const language = args.languageCode.trim() || DEFAULT_COUNTRY.languageCode;
  const shortLanguage = language.split("-")[0] || "en";

  return `https://news.google.com/rss/search?q=${encodeURIComponent(args.query)}&hl=${encodeURIComponent(language)}&gl=${encodeURIComponent(args.countryCode)}&ceid=${encodeURIComponent(`${args.countryCode}:${shortLanguage}`)}`;
}

function buildFeedUrlForCategory(category: NewsCategory, options: FetchNewsOptions) {
  const locale = options.locale ?? DEFAULT_COUNTRY;

  if (category === "local") {
    return buildSearchFeedUrl({
      query: `${locale.countryName} local news`,
      countryCode: locale.countryCode,
      languageCode: locale.languageCode,
    });
  }

  if (category === "for_you") {
    const cleanedTopics = (options.forYouTopics ?? [])
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 1)
      .slice(0, 6);

    const query =
      cleanedTopics.length > 0
        ? `${cleanedTopics.map((topic) => `"${topic}"`).join(" OR ")} news`
        : "top headlines technology business science";

    return buildSearchFeedUrl({
      query,
      countryCode: locale.countryCode,
      languageCode: locale.languageCode,
    });
  }

  return buildSearchFeedUrl({
    query: NEWS_SEARCH_QUERIES[category],
    countryCode: locale.countryCode,
    languageCode: locale.languageCode,
  });
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

export async function fetchNewsForCategory(
  category: NewsCategory,
  options: FetchNewsOptions = {},
) {
  const feedUrl = buildFeedUrlForCategory(category, options);
  const response = await fetch(feedUrl, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch news feed for ${category}.`);
  }

  const xml = await response.text();
  return parseRssItems(xml);
}
