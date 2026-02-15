const FALLBACK_COUNTRY_NAME_BY_CODE: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  NZ: "New Zealand",
  IN: "India",
  LK: "Sri Lanka",
  SG: "Singapore",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  JP: "Japan",
  KR: "South Korea",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  BR: "Brazil",
  MX: "Mexico",
  ZA: "South Africa",
};

const DEFAULT_TIMEZONE_BY_COUNTRY: Record<string, string> = {
  US: "America/New_York",
  CA: "America/Toronto",
  GB: "Europe/London",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  IN: "Asia/Kolkata",
  LK: "Asia/Colombo",
  SG: "Asia/Singapore",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  ZA: "Africa/Johannesburg",
};

export const LOCATION_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "New Zealand",
  "India",
  "Sri Lanka",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "Japan",
  "South Korea",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Brazil",
  "Mexico",
  "South Africa",
] as const;

export const FALLBACK_TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

function countryNameFromCode(countryCode: string | null | undefined) {
  if (!countryCode) {
    return null;
  }

  const normalizedCode = countryCode.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;
  const intlName = displayNames?.of(normalizedCode);
  if (intlName && intlName !== normalizedCode) {
    return intlName;
  }

  return FALLBACK_COUNTRY_NAME_BY_CODE[normalizedCode] ?? null;
}

function firstForwardedIp(value: string | null) {
  if (!value) {
    return null;
  }

  const ip = value
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)[0];

  if (!ip) {
    return null;
  }

  return ip.replace(/^\[|]$/g, "");
}

function isPrivateIp(ip: string) {
  const normalized = ip.trim().toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

async function fetchIpGeo(ip: string) {
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      success?: boolean;
      country?: string;
      country_code?: string;
      city?: string;
      timezone?: { id?: string } | null;
    };

    if (!payload.success) {
      return null;
    }

    return {
      countryCode: payload.country_code?.trim().toUpperCase() ?? null,
      countryName: payload.country?.trim() || null,
      city: payload.city?.trim() || null,
      timezone: payload.timezone?.id?.trim() || null,
    };
  } catch {
    return null;
  }
}

function locationFromCityAndCountry(city: string | null, countryName: string | null) {
  if (city && countryName) {
    return `${city}, ${countryName}`;
  }

  if (countryName) {
    return countryName;
  }

  return null;
}

export async function detectGeoFromRequest(request: Request) {
  const countryCodeHeader =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");
  const cityHeader =
    request.headers.get("x-vercel-ip-city") ?? request.headers.get("x-city");
  const timezoneHeader =
    request.headers.get("x-vercel-ip-timezone") ??
    request.headers.get("cf-timezone") ??
    request.headers.get("x-timezone");

  let countryCode = countryCodeHeader?.trim().toUpperCase() || null;
  let countryName = countryNameFromCode(countryCode);
  let city = cityHeader?.trim() || null;
  let timezone = timezoneHeader?.trim() || null;

  const forwardedIp = firstForwardedIp(request.headers.get("x-forwarded-for"));
  if (forwardedIp && !isPrivateIp(forwardedIp)) {
    const ipGeo = await fetchIpGeo(forwardedIp);

    countryCode = countryCode ?? ipGeo?.countryCode ?? null;
    countryName = countryName ?? ipGeo?.countryName ?? countryNameFromCode(countryCode);
    city = city ?? ipGeo?.city ?? null;
    timezone = timezone ?? ipGeo?.timezone ?? null;
  }

  const location = locationFromCityAndCountry(city, countryName);
  const fallbackTimezone =
    countryCode ? DEFAULT_TIMEZONE_BY_COUNTRY[countryCode] ?? null : null;

  return {
    location,
    timezone: timezone ?? fallbackTimezone,
  };
}
