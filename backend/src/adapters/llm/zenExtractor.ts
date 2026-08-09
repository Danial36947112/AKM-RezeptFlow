import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractionProposal } from "../../domain/types.js";
import type { LlmExtractor } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE_MAP: Record<string, Partial<ExtractionProposal>> = {
  original: {
    intent: "ORIGINAL_PRESCRIPTION_RECEIVED",
    confidence: 0.92,
    requiresHumanReview: true,
  },
  delivery: {
    intent: "CONFIRM_DELIVERY",
    confidence: 0.88,
    requiresHumanReview: true,
  },
};

export class FixtureExtractor implements LlmExtractor {
  async extract(text: string, caseExternalId?: string): Promise<ExtractionProposal> {
    const lower = text.toLowerCase();
    let template = FIXTURE_MAP.original;
    if (lower.includes("geliefert") || lower.includes("delivered")) {
      template = FIXTURE_MAP.delivery;
    }

    const caseRef =
      caseExternalId ??
      text.match(/AKM-DEMO-\d{3}|DEMO-\d{3}/i)?.[0]?.toUpperCase() ??
      null;

    return {
      caseReference: caseRef,
      intent: template.intent ?? "ORIGINAL_PRESCRIPTION_RECEIVED",
      deliveryDestination: null,
      confidence: template.confidence ?? 0.9,
      requiresHumanReview: template.requiresHumanReview ?? true,
      evidence: "Fixture-Extraktion (Zen nicht verfügbar oder Fallback aktiv)",
      source: "fixture",
    };
  }
}

export class ZenExtractor implements LlmExtractor {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private fallback: FixtureExtractor;

  constructor() {
    this.apiKey = process.env.OPENCODE_ZEN_API_KEY ?? "";
    this.baseUrl = process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1";
    this.model = process.env.OPENCODE_ZEN_MODEL ?? "deepseek-v4-flash-free";
    this.fallback = new FixtureExtractor();
  }

  async extract(text: string, caseExternalId?: string): Promise<ExtractionProposal> {
    if (!this.apiKey) {
      return this.fallback.extract(text, caseExternalId);
    }

    try {
      const systemPrompt = `You extract structured administrative data from German healthcare admin text.
Return ONLY valid JSON with keys: caseReference, intent, deliveryDestination, confidence, requiresHumanReview, evidence.
intent must be one of: ORIGINAL_PRESCRIPTION_RECEIVED, CONFIRM_DELIVERY, PLACE_ORDER, CANCEL.
confidence is 0-1. requiresHumanReview is boolean. evidence is a short German quote from the text.`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Case hint: ${caseExternalId ?? "unknown"}\n\nText:\n${text}`,
            },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn(
          `[llm] Zen HTTP ${response.status}; falling back to fixture. ${errText.slice(0, 200)}`,
        );
        return this.fallback.extract(text, caseExternalId);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[llm] Zen returned no JSON; falling back to fixture");
        return this.fallback.extract(text, caseExternalId);
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractionProposal>;
      return {
        caseReference: parsed.caseReference ?? caseExternalId ?? null,
        intent: parsed.intent ?? "ORIGINAL_PRESCRIPTION_RECEIVED",
        deliveryDestination: parsed.deliveryDestination ?? null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
        requiresHumanReview: parsed.requiresHumanReview ?? true,
        evidence: parsed.evidence ?? content.slice(0, 120),
        source: "zen",
      };
    } catch (err) {
      console.warn("[llm] Zen request failed; falling back to fixture", err);
      return this.fallback.extract(text, caseExternalId);
    }
  }
}

export function createLlmExtractor(): LlmExtractor {
  return new ZenExtractor();
}

export function loadFixtureText(name: string): string {
  const path = join(__dirname, "../../../../data/llm-fixtures", `${name}.txt`);
  return readFileSync(path, "utf-8");
}
