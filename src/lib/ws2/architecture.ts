import { readFileSync } from "fs";
import path from "path";

const ARCHITECTURE_PATH = path.join(process.cwd(), "WS2_Agent_Architecture-3.md");

let cachedArchitecture: string | null = null;

function loadArchitecture() {
  // Always reload in development to pick up prompt changes
  if (cachedArchitecture && process.env.NODE_ENV === "production") return cachedArchitecture;
  cachedArchitecture = readFileSync(ARCHITECTURE_PATH, "utf8").replace(/\r\n/g, "\n");
  return cachedArchitecture;
}

function extractCodeBlock(heading: string) {
  const markdown = loadArchitecture();
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex === -1) {
    throw new Error(`Missing architecture section: ${heading}`);
  }

  const trailing = markdown.slice(headingIndex);
  const match = trailing.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
  if (!match) {
    throw new Error(`Missing fenced code block under section: ${heading}`);
  }

  return match[1].trim();
}

export const WS2_AGENT_MODEL = "claude-sonnet-4-20250514";
export const WS2_AGENT_TEMPERATURE = 0;
export const WS2_1_MAX_TOKENS = 8000;
export const WS2_2_MAX_TOKENS = 8000;
export const WS2_3_MAX_TOKENS = 4000;
export const WS2_4_MAX_TOKENS = 4000;
export const WS2_5_MAX_TOKENS = 4000;

export function getWs2ArchitectureMarkdown() {
  return loadArchitecture();
}

export function getWs21SystemPrompt() {
  return extractCodeBlock("### 4.4 System Prompt — WS2-1 TTM Financial Analysis Agent");
}

export function getWs22SystemPrompt() {
  return extractCodeBlock("### 5.5 System Prompt — WS2-2 EBITDA Recast Agent");
}

export function getWs23SystemPrompt() {
  return extractCodeBlock("### 6.3 System Prompt — WS2-3");
}

export function getWs24SystemPrompt() {
  return extractCodeBlock("### 7.3 System Prompt — WS2-4");
}

export function getWs25SystemPrompt() {
  return extractCodeBlock("### 8.3 System Prompt — WS2-5");
}
