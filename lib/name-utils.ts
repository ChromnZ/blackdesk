type NameInput = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
};

function normalizeValue(value: string | null | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : "";
}

export function deriveNameParts(input: NameInput) {
  const explicitFirstName = normalizeValue(input.firstName);
  const explicitLastName = normalizeValue(input.lastName);
  if (explicitFirstName || explicitLastName) {
    return {
      firstName: explicitFirstName || "User",
      lastName: explicitLastName,
    };
  }

  const fullName = normalizeValue(input.fullName);
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "User";
    const lastName = parts.slice(1).join(" ");
    return { firstName, lastName };
  }

  const email = normalizeValue(input.email).toLowerCase();
  if (email.includes("@")) {
    const local = email.split("@")[0] ?? "";
    const localParts = local.split(/[._-]+/).filter(Boolean);
    if (localParts.length > 0) {
      const [firstCandidate, ...rest] = localParts;
      return {
        firstName: firstCandidate || "User",
        lastName: rest.join(" "),
      };
    }
  }

  return { firstName: "User", lastName: "" };
}

export function formatDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallbackEmail?: string | null,
) {
  const first = normalizeValue(firstName);
  const last = normalizeValue(lastName);
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (fallbackEmail) {
    return fallbackEmail;
  }

  return "User";
}

export function initialsFromName(
  firstName?: string | null,
  lastName?: string | null,
  fallbackEmail?: string | null,
) {
  const first = normalizeValue(firstName);
  const last = normalizeValue(lastName);

  const initial = `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
  if (initial) {
    return initial;
  }

  if (fallbackEmail) {
    return fallbackEmail.slice(0, 1).toUpperCase();
  }

  return "U";
}
