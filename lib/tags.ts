const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 32;

function splitTagString(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function normalizeTags(value: unknown) {
  const raw =
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : typeof value === "string"
        ? splitTagString(value)
        : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of raw) {
    const tag = entry.trim().replace(/\s+/g, " ");
    if (!tag) {
      continue;
    }

    const truncated = tag.slice(0, MAX_TAG_LENGTH);
    const key = truncated.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(truncated);
    if (normalized.length >= MAX_TAGS) {
      break;
    }
  }

  return normalized;
}

export function tagsToInput(tags: string[] | null | undefined) {
  return (tags ?? []).join(", ");
}
