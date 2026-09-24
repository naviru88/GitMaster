// Types

export type ReleaseLevel = "MAJOR" | "MINOR" | "PATCH";

export interface ParsedVersion {
  //Normalized version string with "v" prefix: "v1.0.1"
  version: string;
  //MAJOR | MINOR | PATCH, derived from segment count
  level: ReleaseLevel;
  /** Numeric segments: [1, 0, 1] */
  segments: number[];
  //Parent version string, or null for MAJOR: "v1.0"
  parentVersion: string | null;
  //True if the input had the "v" prefix
  hadPrefix: boolean;
}

export class VersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionError";
  }
}

// Constants
//Regex that matches a valid version string.
const VERSION_REGEX = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

// Public API
export function parseVersion(input: string): ParsedVersion {
  if (typeof input !== "string") {
    throw new VersionError("Version must be a string");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new VersionError("Version cannot be empty");
  }

  const match = trimmed.match(VERSION_REGEX);
  if (!match) {
    throw new VersionError(
      `Invalid version format: "${input}". ` +
        `Expected "v1", "v1.0", or "v1.0.1" (with optional "v" prefix).`,
    );
  }

  // Reject leading zeros like "v01" — treat as ambiguous/invalid.
  const rawSegments = [match[1], match[2], match[3]].filter(
    (s): s is string => s !== undefined,
  );

  for (const seg of rawSegments) {
    if (seg.length > 1 && seg.startsWith("0")) {
      throw new VersionError(
        `Version segment cannot have leading zeros: "${input}"`,
      );
    }
  }

  const segments = rawSegments.map((s) => Number(s));

  const level: ReleaseLevel =
    segments.length === 1
      ? "MAJOR"
      : segments.length === 2
        ? "MINOR"
        : "PATCH";

  const hadPrefix = trimmed.startsWith("v");
  const version = `v${segments.join(".")}`;

  const parentVersion =
    segments.length === 1
      ? null
      : `v${segments.slice(0, -1).join(".")}`;

  return { version, level, segments, parentVersion, hadPrefix };
}

//Add the "v" prefix if missing.
export function normalizeVersion(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

//Strip the "v" prefix if present.
export function stripVersionPrefix(input: string): string {
  return input.startsWith("v") ? input.slice(1) : input;
}

//Returns true if the input is a valid version.
export function isValidVersion(input: unknown): input is string {
  if (typeof input !== "string") return false;
  try {
    parseVersion(input);
    return true;
  } catch {
    return false;
  }
}

//Validate that a child version's parent matches the expected parent.
export function validateParent(
  childVersion: string,
  parentVersion: string | null,
): void {
  const parsed = parseVersion(childVersion);
  if (parsed.parentVersion !== parentVersion) {
    throw new VersionError(
      `Version ${parsed.version} must have parent ${parsed.parentVersion ?? "null"}, ` +
        `not ${parentVersion ?? "null"}.`,
    );
  }
}

// Compare two versions for sorting.
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a).segments;
  const pb = parseVersion(b).segments;
  const maxLen = Math.max(pa.length, pb.length);
  for (let i = 0; i < maxLen; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

//Tree-aware comparison: shorter versions sort BEFORE their longer
export function compareVersionsForTree(a: string, b: string): number {
  const pa = parseVersion(a).segments;
  const pb = parseVersion(b).segments;

  const minLen = Math.min(pa.length, pb.length);

  // Compare shared prefix numerically
  for (let i = 0; i < minLen; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }

  // Same prefix — shorter sorts first
  if (pa.length !== pb.length) {
    return pa.length < pb.length ? -1 : 1;
  }

  return 0;
}

// Suggest the next version given a list of existing versions at the same level.

export function suggestNextVersion(
  existingVersions: string[],
  level: ReleaseLevel,
  parentVersion: string | null,
): string {
  // Filter to versions at the requested level under the same parent
  const siblings = existingVersions
    .map((v) => {
      try {
        return parseVersion(v);
      } catch {
        return null;
      }
    })
    .filter((p): p is ParsedVersion => p !== null)
    .filter((p) => p.level === level)
    .filter((p) => p.parentVersion === parentVersion);

  if (siblings.length === 0) {
    // No siblings — first release at this level
    if (level === "MAJOR") return "v1";
    if (parentVersion === null) {
      throw new VersionError(
        `Cannot suggest a ${level} version without a parent.`,
      );
    }
    return `${parentVersion}.0`;
  }

  // Find the highest last segment and increment
  const highest = siblings.reduce((max, p) => {
    const last = p.segments[p.segments.length - 1];
    return Math.max(max, last);
  }, -1);

  const next = highest + 1;
  const prefix = parentVersion ? `${parentVersion}.` : "v";
  return parentVersion ? `${prefix}${next}` : `v${next}`;
}

//Extract the display label for a level.

export function levelLabel(level: ReleaseLevel): string {
  switch (level) {
    case "MAJOR":
      return "Major";
    case "MINOR":
      return "Minor";
    case "PATCH":
      return "Patch";
  }
}

// Extract the icon for a level (matches the HTML generator).
export function levelIcon(level: ReleaseLevel): string {
  switch (level) {
    case "MAJOR":
      return "🔴";
    case "MINOR":
      return "🟡";
    case "PATCH":
      return "🟢";
  }
}
