const REGISTRATION_KEYWORDS = [
  "business registration",
  "certificate of incorporation",
  "certificate of registration",
  "registration number",
  "company registration",
  "trade license",
  "commercial register",
  "chamber of commerce",
  "incorporated",
  "memorandum of association",
  "articles of association",
];

const BUSINESS_PLAN_KEYWORDS = [
  "business plan",
  "market analysis",
  "financial projection",
  "revenue forecast",
  "go to market",
];

type ExpectedType = "BUSINESS_REGISTRATION" | "BUSINESS_PLAN" | "GENERIC";
type DetectedType = "BUSINESS_REGISTRATION" | "BUSINESS_PLAN" | "UNKNOWN";

type OpenAiVisionResult = {
  detectedType: DetectedType;
  businessNameMatch: boolean;
  extractedBusinessName: string | null;
  confidence: number | null;
  flags: string[];
};

export type DocumentAiReviewResult = {
  status: "PASS" | "RED_FLAG";
  summary: string;
  flags: string[];
  detectedType: DetectedType;
  businessNameMatch: boolean;
  reviewedAt: Date;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LEGAL_SUFFIXES = new Set([
  "co",
  "company",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "llc",
  "ltd",
  "limited",
  "plc",
  "lp",
  "llp",
  "pte",
]);

function normalizeBusinessName(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 0 && !LEGAL_SUFFIXES.has(token))
    .join(" ");
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const previousRow: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previousRow[0];
    previousRow[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const upper = previousRow[j];
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      previousRow[j] = Math.min(
        previousRow[j] + 1,
        previousRow[j - 1] + 1,
        diagonal + substitutionCost,
      );

      diagonal = upper;
    }
  }

  return previousRow[b.length];
}

function isBusinessNameEquivalent(expectedBusinessName: string, extractedBusinessName: string) {
  const expected = normalizeBusinessName(expectedBusinessName);
  const extracted = normalizeBusinessName(extractedBusinessName);

  if (!expected || !extracted) {
    return false;
  }

  if (expected === extracted) {
    return true;
  }

  const expectedTokens = new Set(expected.split(" "));
  const extractedTokens = new Set(extracted.split(" "));
  const sharedTokenCount = [...expectedTokens].filter((token) => extractedTokens.has(token)).length;
  const tokenOverlapRatio = sharedTokenCount / Math.max(expectedTokens.size, extractedTokens.size);

  if (tokenOverlapRatio >= 0.75) {
    return true;
  }

  const maxLength = Math.max(expected.length, extracted.length);
  const similarity = 1 - levenshteinDistance(expected, extracted) / maxLength;

  return similarity >= 0.82;
}

function isBusinessNameMismatchFlag(flag: string) {
  const normalized = normalizeText(flag);
  return (
    normalized.includes("business name") ||
    normalized.includes("name mismatch") ||
    normalized.includes("spelling mismatch")
  );
}

function includesAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function extractReadableText(buffer: Buffer) {
  const raw = buffer.toString("utf8");
  return raw.replace(/\0/g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function nameLooksMatching(text: string, businessName: string) {
  const normalizedName = normalizeBusinessName(businessName);

  if (!normalizedName) {
    return false;
  }

  if (text.includes(normalizedName)) {
    return true;
  }

  const tokens = normalizedName.split(" ").filter((part) => part.length > 2);

  if (tokens.length === 0) {
    return false;
  }

  const hitCount = tokens.filter((token) => text.includes(token)).length;
  return hitCount / tokens.length >= 0.7;
}

function expectedTypeFromRequest(requestTitle: string, requestDescription?: string | null): ExpectedType {
  const requestText = normalizeText(`${requestTitle} ${requestDescription ?? ""}`);

  if (includesAnyKeyword(requestText, REGISTRATION_KEYWORDS)) {
    return "BUSINESS_REGISTRATION";
  }

  if (includesAnyKeyword(requestText, BUSINESS_PLAN_KEYWORDS)) {
    return "BUSINESS_PLAN";
  }

  return "GENERIC";
}

function detectedTypeFromDocument(corpus: string): DetectedType {
  if (includesAnyKeyword(corpus, REGISTRATION_KEYWORDS)) {
    return "BUSINESS_REGISTRATION";
  }

  if (includesAnyKeyword(corpus, BUSINESS_PLAN_KEYWORDS)) {
    return "BUSINESS_PLAN";
  }

  return "UNKNOWN";
}

function isVisionSupportedMimeType(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function normalizeDetectedType(raw: unknown): DetectedType {
  if (typeof raw !== "string") {
    return "UNKNOWN";
  }

  const value = raw.trim().toUpperCase();

  if (value === "BUSINESS_REGISTRATION") {
    return "BUSINESS_REGISTRATION";
  }

  if (value === "BUSINESS_PLAN") {
    return "BUSINESS_PLAN";
  }

  return "UNKNOWN";
}

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const topLevel = payload as { output_text?: unknown; output?: unknown[] };

  if (typeof topLevel.output_text === "string" && topLevel.output_text.trim()) {
    return topLevel.output_text;
  }

  if (!Array.isArray(topLevel.output)) {
    return "";
  }

  const chunks: string[] = [];

  for (const item of topLevel.output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }

      const record = block as { type?: unknown; text?: unknown };

      if ((record.type === "output_text" || record.type === "text") && typeof record.text === "string") {
        chunks.push(record.text);
      }
    }
  }

  return chunks.join("\n");
}

function parseJsonFromModel(outputText: string) {
  const trimmed = outputText.trim();

  if (!trimmed) {
    return null;
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    const candidate = withoutFence.slice(start, end + 1);

    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function runOpenAiVisionReview({
  fileName,
  mimeType,
  buffer,
  businessName,
  expectedType,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  businessName: string;
  expectedType: ExpectedType;
}): Promise<OpenAiVisionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !isVisionSupportedMimeType(mimeType)) {
    return null;
  }

  const prompt = [
    "You are a document-verification assistant for due diligence.",
    `Expected document type: ${expectedType}.`,
    `Expected business name: \"${businessName}\".`,
    "Classify the uploaded document and check if the business name appears to match.",
    "Return only valid JSON with this exact shape:",
    '{"detectedType":"BUSINESS_REGISTRATION|BUSINESS_PLAN|UNKNOWN","businessNameMatch":true,"extractedBusinessName":"string|null","confidence":0.0,"flags":["string"]}',
    "If uncertain, use detectedType UNKNOWN and add a flag.",
  ].join("\n");

  const encoded = buffer.toString("base64");
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: prompt }];

  if (mimeType === "application/pdf") {
    content.push({
      type: "input_file",
      filename: fileName || "document.pdf",
      file_data: `data:application/pdf;base64,${encoded}`,
    });
  } else {
    content.push({
      type: "input_image",
      image_url: `data:${mimeType};base64,${encoded}`,
      detail: "high",
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content,
        },
      ],
      max_output_tokens: 250,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI vision request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractOutputText(payload);
  const parsed = parseJsonFromModel(outputText);

  if (!parsed) {
    return null;
  }

  const detectedType = normalizeDetectedType(parsed.detectedType);
  const extractedBusinessName =
    typeof parsed.extractedBusinessName === "string" && parsed.extractedBusinessName.trim()
      ? parsed.extractedBusinessName.trim()
      : null;

  const businessNameMatchFromModel =
    typeof parsed.businessNameMatch === "boolean" ? parsed.businessNameMatch : null;

  const businessNameMatchFromExtractedName = extractedBusinessName
    ? isBusinessNameEquivalent(businessName, extractedBusinessName)
    : null;

  const businessNameMatch =
    businessNameMatchFromExtractedName !== null
      ? businessNameMatchFromExtractedName || businessNameMatchFromModel === true
      : (businessNameMatchFromModel ?? false);

  const confidence = clampConfidence(parsed.confidence);
  let flags = Array.isArray(parsed.flags)
    ? parsed.flags.filter((flag): flag is string => typeof flag === "string")
    : [];

  if (businessNameMatch) {
    flags = flags.filter((flag) => !isBusinessNameMismatchFlag(flag));
  }

  return {
    detectedType,
    businessNameMatch,
    extractedBusinessName,
    confidence,
    flags,
  };
}

export async function runDocumentAiReview({
  fileName,
  mimeType,
  buffer,
  businessName,
  requestTitle,
  requestDescription,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  businessName: string;
  requestTitle: string;
  requestDescription?: string | null;
}): Promise<DocumentAiReviewResult> {
  const expectedType = expectedTypeFromRequest(requestTitle, requestDescription);

  let detectedType: DetectedType = "UNKNOWN";
  let businessNameMatch = false;
  let flags: string[] = [];

  try {
    const openAiResult = await runOpenAiVisionReview({
      fileName,
      mimeType,
      buffer,
      businessName,
      expectedType,
    });

    if (openAiResult) {
      detectedType = openAiResult.detectedType;
      businessNameMatch = openAiResult.businessNameMatch;
      flags = [...openAiResult.flags];

      if (openAiResult.confidence !== null && openAiResult.confidence < 0.55) {
        flags.push("Low AI confidence in extracted document details.");
      }
    } else {
      const extractedText = extractReadableText(buffer);
      const corpus = normalizeText(`${fileName} ${mimeType} ${extractedText}`);
      detectedType = detectedTypeFromDocument(corpus);
      businessNameMatch = nameLooksMatching(corpus, businessName);

      if (corpus.length < 60) {
        flags.push("Low readable text confidence. File may be image-only or unsupported format.");
      }
    }
  } catch (error) {
    const extractedText = extractReadableText(buffer);
    const corpus = normalizeText(`${fileName} ${mimeType} ${extractedText}`);
    detectedType = detectedTypeFromDocument(corpus);
    businessNameMatch = nameLooksMatching(corpus, businessName);
    flags.push("OpenAI vision check failed; fallback keyword review used.");

    if (error instanceof Error) {
      console.error(error.message);
    }
  }

  if (expectedType !== "GENERIC" && detectedType !== expectedType) {
    flags.push(
      `Expected ${expectedType.replaceAll("_", " ").toLowerCase()} but detected ${detectedType
        .replaceAll("_", " ")
        .toLowerCase()}.`,
    );
  }

  if (!businessNameMatch) {
    flags.push("Business name does not appear to match the client profile.");
  }

  const uniqueFlags = [...new Set(flags)].filter((flag) => flag.length > 0);
  const status = uniqueFlags.length > 0 ? "RED_FLAG" : "PASS";

  return {
    status,
    summary:
      status === "PASS"
        ? "No obvious issues found in AI document checks."
        : `Potential issues found: ${uniqueFlags.join(" ")}`,
    flags: uniqueFlags,
    detectedType,
    businessNameMatch,
    reviewedAt: new Date(),
  };
}
