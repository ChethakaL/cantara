import type { MondayClientField, MondayColumnMapping } from "@/lib/monday-client-import";

export const MONDAY_GLOBAL_MAPPING_FIELDS = [
  { key: "firstName", label: "First Name Column" },
  { key: "lastName", label: "Last Name Column" },
  { key: "email", label: "Email Column" },
  { key: "phone", label: "Phone Column" },
  { key: "company", label: "Business Name Column" },
  { key: "website", label: "Business Website Column" },
  { key: "businessCategory", label: "Business Category Column" },
  { key: "propertyOwnership", label: "Property Ownership Column" },
  { key: "businessAddress", label: "Business Address Column" },
  { key: "cimLink", label: "CIM Link Column" },
  { key: "teaserLink", label: "Teaser Link Column" },
] as const;

export type MondayGlobalMappingKey = (typeof MONDAY_GLOBAL_MAPPING_FIELDS)[number]["key"];
export type MondayGlobalColumnMapping = Record<MondayGlobalMappingKey, string | null>;

const CLIENT_IMPORT_FIELDS: MondayClientField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "website",
  "businessCategory",
  "propertyOwnership",
  "businessAddress",
];

export function emptyMondayGlobalMappingForm(): Record<MondayGlobalMappingKey, string> {
  return Object.fromEntries(MONDAY_GLOBAL_MAPPING_FIELDS.map((field) => [field.key, ""])) as Record<
    MondayGlobalMappingKey,
    string
  >;
}

export function normalizeMondayColumnMapping(input: unknown): MondayGlobalColumnMapping {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return Object.fromEntries(
    MONDAY_GLOBAL_MAPPING_FIELDS.map((field) => {
      const value = source[field.key];
      return [field.key, typeof value === "string" && value.trim() ? value.trim() : null];
    }),
  ) as MondayGlobalColumnMapping;
}

export function pickClientImportColumnMapping(
  mapping: Partial<Record<string, string | null>> | null | undefined,
): MondayColumnMapping | null {
  if (!mapping) return null;

  const picked = Object.fromEntries(
    CLIENT_IMPORT_FIELDS.map((key) => {
      const value = mapping[key];
      return [key, typeof value === "string" && value.trim() ? value.trim() : null];
    }),
  ) as MondayColumnMapping;

  const hasAny = CLIENT_IMPORT_FIELDS.some((key) => Boolean(picked[key]));
  return hasAny ? picked : null;
}

export function sanitizeMondayLinkUrl(url: string): string {
  let cleaned = url.trim();
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/^["']+(https?:\/\/)/, "$1");

  const embeddedUrl = cleaned.match(/https?:\/\/[^\s"'<>]+/i);
  if (embeddedUrl && (cleaned.includes('"') || cleaned.includes("'") || /^https?:\/\/["']/.test(cleaned))) {
    return embeddedUrl[0];
  }

  return cleaned;
}

export function getMondayLinkColumnKey(reportType: "CIM" | "Teaser"): "cimLink" | "teaserLink" {
  return reportType === "CIM" ? "cimLink" : "teaserLink";
}
