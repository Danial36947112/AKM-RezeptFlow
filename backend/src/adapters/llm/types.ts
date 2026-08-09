import type { ExtractionProposal } from "../../domain/types.js";

export interface LlmExtractor {
  extract(text: string, caseExternalId?: string): Promise<ExtractionProposal>;
}
