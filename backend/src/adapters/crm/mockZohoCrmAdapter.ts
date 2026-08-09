import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type {
  CrmAdapter,
  CrmCase,
  CrmTaskInput,
  PrescriptionCaseInput,
  TimelineEvent,
} from "./types.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function resolveDataPath(raw: string | undefined, fallback: string): string {
  const path = raw ?? fallback;
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

export class MockZohoCrmAdapter implements CrmAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath
      ? basePath
      : resolveDataPath(process.env.MOCK_ZOHO_PATH, "data/mock-zoho");
    mkdirSync(this.basePath, { recursive: true });
    mkdirSync(join(this.basePath, "cases"), { recursive: true });
    mkdirSync(join(this.basePath, "tasks"), { recursive: true });
    mkdirSync(join(this.basePath, "timeline"), { recursive: true });
  }

  async findCaseByExternalId(externalId: string): Promise<CrmCase | null> {
    const path = join(this.basePath, "cases", `${externalId}.json`);
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return {
      id: data.id,
      externalId: data.externalId,
      status: data.status,
      patientRef: data.patientRef,
    };
  }

  async upsertPrescriptionCase(input: PrescriptionCaseInput): Promise<CrmCase> {
    const existing = await this.findCaseByExternalId(input.externalId);
    const id = existing?.id ?? `zoho-${input.externalId}`;
    const record = {
      id,
      externalId: input.externalId,
      status: input.status,
      patientRef: input.patientRef,
      physicianRef: input.physicianRef,
      deliveryRef: input.deliveryRef,
      materialRef: input.materialRef,
      fieldEmployeeRef: input.fieldEmployeeRef,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(
      join(this.basePath, "cases", `${input.externalId}.json`),
      JSON.stringify(record, null, 2),
    );
    return {
      id,
      externalId: input.externalId,
      status: input.status,
      patientRef: input.patientRef,
    };
  }

  async createTask(input: CrmTaskInput): Promise<{ id: string }> {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task = { id, ...input, createdAt: new Date().toISOString() };
    writeFileSync(join(this.basePath, "tasks", `${id}.json`), JSON.stringify(task, null, 2));
    return { id };
  }

  async appendTimelineEvent(caseId: string, event: TimelineEvent): Promise<void> {
    const path = join(this.basePath, "timeline", `${caseId}.jsonl`);
    const line = JSON.stringify(event) + "\n";
    if (existsSync(path)) {
      writeFileSync(path, readFileSync(path, "utf-8") + line);
    } else {
      writeFileSync(path, line);
    }
  }
}
