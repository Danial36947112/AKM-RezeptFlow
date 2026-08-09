import type { CrmAdapter, CrmCase, CrmTaskInput, PrescriptionCaseInput, TimelineEvent } from "./types.js";

/**
 * Production Zoho CRM adapter skeleton.
 * Map domain operations to Zoho custom modules after tenant schema discovery.
 */
export class ZohoCrmAdapter implements CrmAdapter {
  constructor(_oauthToken?: string) {
    void _oauthToken;
  }

  async findCaseByExternalId(_externalId: string): Promise<CrmCase | null> {
    throw new Error("ZohoCrmAdapter not implemented — use MockZohoCrmAdapter for MVP");
  }

  async upsertPrescriptionCase(_input: PrescriptionCaseInput): Promise<CrmCase> {
    throw new Error("ZohoCrmAdapter not implemented");
  }

  async createTask(_input: CrmTaskInput): Promise<{ id: string }> {
    throw new Error("ZohoCrmAdapter not implemented");
  }

  async appendTimelineEvent(_caseId: string, _event: TimelineEvent): Promise<void> {
    throw new Error("ZohoCrmAdapter not implemented");
  }
}
