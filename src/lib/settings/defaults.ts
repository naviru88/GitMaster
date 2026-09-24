import type {
  UserProfile,
  ThemePreference,
  FontSize,
  DateFormat,
} from "@prisma/client";

// Types
export interface ProfileDefaults {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  website: string | null;
  pronouns: string | null;
  company: string | null;
  githubUsername: string | null;

  theme: ThemePreference;
  accentColor: string;
  fontSize: FontSize;
  reducedMotion: boolean;
  compactMode: boolean;

  defaultLandingPage: string;
  timezone: string;
  dateFormat: DateFormat;
  language: string;

  emailNotifications: boolean;
  pushNotifications: boolean;
  notifyOnCommit: boolean;
  notifyOnRelease: boolean;
  notifyOnMention: boolean;
  notifyOnWeeklyDigest: boolean;
}

/** Alias kept for existing imports. */
export type PublicProfile = ProfileDefaults;

// Default values
export const DEFAULT_PROFILE: ProfileDefaults = {
  displayName: null,
  bio: null,
  avatarUrl: null,
  location: null,
  website: null,
  pronouns: null,
  company: null,
  githubUsername: null,

  theme: "SYSTEM",
  accentColor: "blue",
  fontSize: "MEDIUM",
  reducedMotion: false,
  compactMode: false,

  defaultLandingPage: "/dashboard",
  timezone: "UTC",
  dateFormat: "MMM_D_YYYY",
  language: "en",

  emailNotifications: true,
  pushNotifications: false,
  notifyOnCommit: true,
  notifyOnRelease: true,
  notifyOnMention: true,
  notifyOnWeeklyDigest: false,
};

// Merging helpers
export type StoredProfile = UserProfile | null;

export function withDefaults(stored: StoredProfile): ProfileDefaults {
  if (!stored) {
    return { ...DEFAULT_PROFILE };
  }

  return {
    displayName: stored.displayName ?? DEFAULT_PROFILE.displayName,
    bio: stored.bio ?? DEFAULT_PROFILE.bio,
    avatarUrl: stored.avatarUrl ?? DEFAULT_PROFILE.avatarUrl,
    location: stored.location ?? DEFAULT_PROFILE.location,
    website: stored.website ?? DEFAULT_PROFILE.website,
    pronouns: stored.pronouns ?? DEFAULT_PROFILE.pronouns,
    company: stored.company ?? DEFAULT_PROFILE.company,
    githubUsername:
      stored.githubUsername ?? DEFAULT_PROFILE.githubUsername,

    theme: stored.theme ?? DEFAULT_PROFILE.theme,
    accentColor: stored.accentColor ?? DEFAULT_PROFILE.accentColor,
    fontSize: stored.fontSize ?? DEFAULT_PROFILE.fontSize,
    reducedMotion: stored.reducedMotion ?? DEFAULT_PROFILE.reducedMotion,
    compactMode: stored.compactMode ?? DEFAULT_PROFILE.compactMode,

    defaultLandingPage:
      stored.defaultLandingPage ?? DEFAULT_PROFILE.defaultLandingPage,
    timezone: stored.timezone ?? DEFAULT_PROFILE.timezone,
    dateFormat: stored.dateFormat ?? DEFAULT_PROFILE.dateFormat,
    language: stored.language ?? DEFAULT_PROFILE.language,

    emailNotifications:
      stored.emailNotifications ?? DEFAULT_PROFILE.emailNotifications,
    pushNotifications:
      stored.pushNotifications ?? DEFAULT_PROFILE.pushNotifications,
    notifyOnCommit:
      stored.notifyOnCommit ?? DEFAULT_PROFILE.notifyOnCommit,
    notifyOnRelease:
      stored.notifyOnRelease ?? DEFAULT_PROFILE.notifyOnRelease,
    notifyOnMention:
      stored.notifyOnMention ?? DEFAULT_PROFILE.notifyOnMention,
    notifyOnWeeklyDigest:
      stored.notifyOnWeeklyDigest ?? DEFAULT_PROFILE.notifyOnWeeklyDigest,
  };
}

// Validation
export const ALLOWED_VALUES = {
  theme: ["LIGHT", "DARK", "SYSTEM"] as const,
  fontSize: ["SMALL", "MEDIUM", "LARGE"] as const,
  dateFormat: [
    "MMM_D_YYYY",
    "DD_MM_YYYY",
    "MM_DD_YYYY",
    "YYYY_MM_DD",
    "RELATIVE",
  ] as const,
  accentColor: [
    "blue",
    "violet",
    "emerald",
    "amber",
    "rose",
    "slate",
  ] as const,
};

export type AllowedTheme = (typeof ALLOWED_VALUES.theme)[number];
export type AllowedFontSize = (typeof ALLOWED_VALUES.fontSize)[number];
export type AllowedDateFormat = (typeof ALLOWED_VALUES.dateFormat)[number];
export type AllowedAccentColor = (typeof ALLOWED_VALUES.accentColor)[number];

export function validateProfilePatch(
  patch: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  const inSet = <T extends readonly string[]>(
    value: unknown,
    set: T,
    field: string,
  ) => {
    if (value === undefined) return;
    if (typeof value !== "string" || !set.includes(value as T[number])) {
      errors.push(`${field} must be one of: ${set.join(", ")}`);
    }
  };

  inSet(patch.theme, ALLOWED_VALUES.theme, "theme");
  inSet(patch.fontSize, ALLOWED_VALUES.fontSize, "fontSize");
  inSet(patch.dateFormat, ALLOWED_VALUES.dateFormat, "dateFormat");
  inSet(patch.accentColor, ALLOWED_VALUES.accentColor, "accentColor");

  const textLimits: Record<string, number> = {
    displayName: 80,
    bio: 1000,
    location: 100,
    website: 200,
    pronouns: 40,
    company: 100,
    githubUsername: 40,
    timezone: 60,
    language: 10,
    defaultLandingPage: 200,
  };

  for (const [field, max] of Object.entries(textLimits)) {
    const value = patch[field];
    if (value === undefined) continue;
    if (value === null) continue;
    if (typeof value !== "string") {
      errors.push(`${field} must be a string or null`);
      continue;
    }
    if (value.length > max) {
      errors.push(`${field} must be at most ${max} characters`);
    }
  }

  const boolFields = [
    "reducedMotion",
    "compactMode",
    "emailNotifications",
    "pushNotifications",
    "notifyOnCommit",
    "notifyOnRelease",
    "notifyOnMention",
    "notifyOnWeeklyDigest",
  ];
  for (const field of boolFields) {
    const value = patch[field];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      errors.push(`${field} must be a boolean`);
    }
  }

  return errors;
}

// Date formatting
export function formatDate(
  date: Date | string,
  format: DateFormat,
  timezone = "UTC",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  const opts: Intl.DateTimeFormatOptions = { timeZone: timezone };

  switch (format) {
    case "MMM_D_YYYY":
      return new Intl.DateTimeFormat("en-US", {
        ...opts,
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);

    case "DD_MM_YYYY":
      return new Intl.DateTimeFormat("en-GB", {
        ...opts,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);

    case "MM_DD_YYYY":
      return new Intl.DateTimeFormat("en-US", {
        ...opts,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);

    case "YYYY_MM_DD":
      return new Intl.DateTimeFormat("en-CA", {
        ...opts,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);

    case "RELATIVE":
      return d.toISOString().slice(0, 10);

    default:
      return d.toISOString().slice(0, 10);
  }
}
