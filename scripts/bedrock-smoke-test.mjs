/**
 * Smoke-test all Cantara Bedrock model tiers using .env credentials.
 * Run: node scripts/bedrock-smoke-test.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const BEDROCK_MODEL_MAP = {
  "claude-sonnet-4-20250514": "us.anthropic.claude-sonnet-4-6",
  "claude-opus-4-5": "us.anthropic.claude-opus-4-6-v1",
  "claude-3-5-haiku-latest": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
};

function usesBedrock() {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "anthropic") return false;
  if (provider === "bedrock") return true;
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_ROLE_ARN ||
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
  );
}

function hasAIConfigured() {
  if (usesBedrock()) {
    return Boolean(
      process.env.AWS_BEARER_TOKEN_BEDROCK ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_PROFILE,
    );
  }
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function resolveModel(model) {
  if (!usesBedrock()) return model;
  return BEDROCK_MODEL_MAP[model] ?? model;
}

const AGENT_GROUPS = [
  {
    group: "Sonnet 4.6 (main agents — lease, TTM, WS1, pricing, etc.)",
    logicalModel: "claude-sonnet-4-20250514",
    modules: [
      "src/app/api/lease-analysis/analyze/route.ts",
      "src/lib/ttm-agent/claude.ts",
      "src/lib/pricing-analysis/analyze.ts",
      "src/app/api/contract-analysis/analyze/route.ts",
      "src/app/api/employee-obligations/analyze/route.ts",
    ],
  },
  {
    group: "Opus 4.6 (org chart, insurance, digital presence analysis)",
    logicalModel: "claude-opus-4-5",
    modules: [
      "src/lib/org-chart/analyze.ts",
      "src/lib/insurance-review.ts",
      "src/lib/digital-presence/claude-analyzer.ts",
    ],
  },
  {
    group: "Haiku 4.5 (fast form extraction)",
    logicalModel: "claude-3-5-haiku-latest",
    modules: ["src/app/api/client-form-questions/extract/route.ts"],
  },
];

console.log("=== Cantara Bedrock smoke test ===\n");
console.log("AI_PROVIDER:", process.env.AI_PROVIDER ?? "(unset)");
console.log("AWS_REGION:", process.env.AWS_REGION ?? "(unset)");
console.log("AWS_BEARER_TOKEN_BEDROCK:", process.env.AWS_BEARER_TOKEN_BEDROCK ? "set" : "missing");
console.log("ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY ? "set (ignored when bedrock)" : "unset");
console.log("usesBedrock():", usesBedrock());
console.log("hasAIConfigured():", hasAIConfigured());
console.log("");

if (!hasAIConfigured()) {
  console.error("FAIL: No AI credentials. Set AI_PROVIDER=bedrock and AWS_BEARER_TOKEN_BEDROCK in .env");
  process.exit(1);
}

if (!usesBedrock()) {
  console.error("FAIL: AI_PROVIDER is not bedrock — this test validates Bedrock only.");
  process.exit(1);
}

const client = new AnthropicBedrock({
  awsRegion: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
});

let passed = 0;
let failed = 0;

for (const { group, logicalModel, modules } of AGENT_GROUPS) {
  const bedrockModel = resolveModel(logicalModel);
  process.stdout.write(`${group}\n  logical: ${logicalModel}\n  bedrock: ${bedrockModel}\n  `);
  try {
    const res = await client.messages.create({
      model: bedrockModel,
      max_tokens: 32,
      temperature: 0,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    console.log(`  result: PASS (${text.slice(0, 40)})\n`);
    passed++;
    for (const mod of modules) {
      console.log(`    ✓ ${mod}`);
    }
    console.log("");
  } catch (err) {
    console.log(`  result: FAIL — ${err?.message ?? err}\n`);
    failed++;
  }
}

console.log(`=== Summary: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
