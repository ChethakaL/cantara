/**
 * LLM-based Category Classifier for Owner Expenses
 *
 * Takes the list of categories from the Owner Expenses Transaction Report
 * and classifies each into:
 *   SOURCE_B — owner payroll (summed as "Total Payroll Expenses" normalization)
 *   SOURCE_A — personal expense add-back (individual normalization line item)
 *   SKIP — business operating cost (not normalized)
 *
 * The LLM handles the fuzzy classification. The deterministic engine then
 * uses the classification to compute exact dollar amounts.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PersonalExpenseCategory } from "@/lib/ttm-agent/parsers/personal-expenses";

export type CategoryClass = "SOURCE_B" | "SOURCE_A" | "SKIP";

export interface CategoryClassification {
  category: string;
  classification: CategoryClass;
  reason: string;
}

export interface ClassificationResult {
  classifications: CategoryClassification[];
  sourceBCategories: Set<string>;
  sourceACategories: Set<string>;
  skipCategories: Set<string>;
}

const SYSTEM_PROMPT = `You are a financial analyst classifying expense categories from a small business owner's expense report for an M&A valuation.

You will receive a list of expense categories found in the owner's personal expense transaction report. Each category represents a group of transactions the owner ran through the business.

Classify each category into exactly one of three buckets:

SOURCE_B — Owner payroll/compensation
These are the owner's salary, wages, draws, health insurance, retirement contributions, payroll taxes, and any other compensation-related items. They get summed into a single "Total Payroll Expenses" normalization line.
Examples: Officer Wages, S-Corp Health Insurance, Other Earnings (draws), Wages (owner portion), Groom Commission (owner portion), Paycheck Tips (owner), Day Labor (owner), SIMPLE IRA, Payroll Taxes, Sick Pay, health insurance accounts.

SOURCE_A — Personal expense add-back
These are personal expenses the owner charged to the business that a buyer would not incur. Each becomes its own line item in the normalization schedule.
Examples: Donations, Church, Gifts Given, Personal meals/dining, Travel, Entertainment, Emergency Vet (personal pets), Office Expenses - Admin (personal), Postage & Delivery (personal), Mobile Phone (personal), Advertising giveaways, Dues & Subscriptions, Professional Fees (personal legal), Repairs & Maintenance (personal/home).

SKIP — Business operating cost
These are legitimate business expenses that happen to appear in the owner's expense report but are NOT personal add-backs. They stay as business costs.
Examples: Reimbursements, items that are clearly business operations with no personal component.

IMPORTANT RULES:
1. When in doubt between SOURCE_A and SKIP, choose SOURCE_A — it's better to flag a potential add-back for the advisor to review than to miss one.
2. Categories under a "Payroll" parent section are almost always SOURCE_B.
3. Categories like "Janitorial", "Pest Control", "Waste Removal" could be either business costs OR personal (e.g., owner's home cleaning). Since they appear in the OWNER'S expense report, classify as SOURCE_A — the owner listed them as personal.
4. "Consulting" under payroll = SOURCE_B. "Consulting" under professional fees = SOURCE_A.

Respond with a JSON array. Each element: {"category": "...", "classification": "SOURCE_A" | "SOURCE_B" | "SKIP", "reason": "brief reason"}`;

export async function classifyCategories(
  categories: PersonalExpenseCategory[],
): Promise<ClassificationResult> {
  const categoryList = categories.map(c =>
    `- "${c.category}" (${c.transactionCount} transactions, ${c.subCategories.length > 0 ? 'sub-categories: ' + c.subCategories.join(', ') : 'no sub-categories'})`
  ).join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[Classifier] No ANTHROPIC_API_KEY — using fallback hardcoded classification");
    return fallbackClassification(categories);
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Classify these ${categories.length} expense categories:\n\n${categoryList}\n\nRespond with JSON array only, no other text.`,
      }],
    });

    const text = response.content.find(b => b.type === "text")?.text ?? "[]";
    // Extract JSON from response (may have markdown code fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("[Classifier] Could not parse LLM response, using fallback");
      return fallbackClassification(categories);
    }

    const parsed: CategoryClassification[] = JSON.parse(jsonMatch[0]);
    console.log(`[Classifier] LLM classified ${parsed.length} categories`);

    const sourceBCategories = new Set<string>();
    const sourceACategories = new Set<string>();
    const skipCategories = new Set<string>();

    for (const item of parsed) {
      if (item.classification === "SOURCE_B") sourceBCategories.add(item.category);
      else if (item.classification === "SOURCE_A") sourceACategories.add(item.category);
      else skipCategories.add(item.category);
    }

    // Log classification
    for (const item of parsed) {
      console.log(`[Classifier]   ${item.classification}: "${item.category}" — ${item.reason}`);
    }

    return { classifications: parsed, sourceBCategories, sourceACategories, skipCategories };
  } catch (error) {
    console.warn("[Classifier] LLM classification failed, using fallback:", (error as Error).message);
    return fallbackClassification(categories);
  }
}

/**
 * Fallback classification using keyword matching.
 * Used when the LLM is not available or fails.
 */
function fallbackClassification(categories: PersonalExpenseCategory[]): ClassificationResult {
  const sourceBKeywords = [
    "officer wages", "s-corp health", "other earnings", "wages", "groom commission",
    "paycheck tips", "cash tips paid out", "day labor", "simple ira", "taxes",
    "payroll taxes", "sick pay", "officer", "employer", "employees",
    "payroll expenses", "united healthcare", "bcbsaz", "dental", "medical", "vision",
  ];
  const skipKeywords = ["reimbursements", "transaction report", "total"];

  const sourceBCategories = new Set<string>();
  const sourceACategories = new Set<string>();
  const skipCategories = new Set<string>();
  const classifications: CategoryClassification[] = [];

  for (const cat of categories) {
    const lower = cat.category.toLowerCase();

    if (skipKeywords.some(kw => lower === kw)) {
      skipCategories.add(cat.category);
      classifications.push({ category: cat.category, classification: "SKIP", reason: "Business/structural" });
    } else if (sourceBKeywords.some(kw => lower.includes(kw))) {
      sourceBCategories.add(cat.category);
      classifications.push({ category: cat.category, classification: "SOURCE_B", reason: "Payroll keyword match" });
    } else {
      sourceACategories.add(cat.category);
      classifications.push({ category: cat.category, classification: "SOURCE_A", reason: "Default: personal add-back" });
    }
  }

  console.log(`[Classifier] Fallback: ${sourceBCategories.size} SOURCE_B, ${sourceACategories.size} SOURCE_A, ${skipCategories.size} SKIP`);
  return { classifications, sourceBCategories, sourceACategories, skipCategories };
}
