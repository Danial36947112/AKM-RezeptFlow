import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync, existsSync } from "node:fs";
import { createDatabase, loadSeed, type SeedData } from "../src/db/index.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MockZohoCrmAdapter } from "../src/adapters/crm/mockZohoCrmAdapter.js";
import { FixtureExtractor } from "../src/adapters/llm/zenExtractor.js";
import { CaseService } from "../src/domain/caseService.js";
import { canTransition } from "../src/domain/stateMachine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed: SeedData = JSON.parse(
  readFileSync(join(__dirname, "../../data/seed.json"), "utf-8"),
);

const testDbPath = join(__dirname, "../../data/test-rezeptflow.db");
let activeDb: ReturnType<typeof createDatabase> | null = null;

function createService() {
  if (activeDb) {
    activeDb.close();
    activeDb = null;
  }
  process.env.DATABASE_PATH = testDbPath;
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
  const db = createDatabase();
  activeDb = db;
  loadSeed(db, seed);
  const crm = new MockZohoCrmAdapter(join(__dirname, "../../data/mock-zoho-test"));
  return new CaseService(db, crm, new FixtureExtractor());
}

describe("stateMachine", () => {
  it("allows NEW to INCOMPLETE", () => {
    expect(canTransition("NEW", "INCOMPLETE")).toBe(true);
  });

  it("blocks DELIVERED to ORDERED", () => {
    expect(canTransition("DELIVERED", "ORDERED")).toBe(false);
  });
});

describe("CaseService", () => {
  let service: CaseService;

  beforeEach(() => {
    service = createService();
  });

  afterEach(() => {
    if (activeDb) {
      activeDb.close();
      activeDb = null;
    }
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  it("ignores duplicate webhook via idempotency key", async () => {
    const payload = {
      sourceEventId: "AKM-DUP-TEST",
      patientRef: "P1",
      physicianRef: "PR1",
      deliveryRef: "D1",
      materialRef: "M1",
      fieldEmployeeRef: "F1",
      idempotencyKey: "dup-key-1",
    };
    const first = await service.handlePrescriptionRequest(payload);
    const second = await service.handlePrescriptionRequest(payload);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("marks incomplete requests", async () => {
    const result = await service.handlePrescriptionRequest({
      sourceEventId: "AKM-INCOMPLETE-TEST",
      patientRef: "P1",
      deliveryRef: "D1",
      materialRef: "M1",
      fieldEmployeeRef: "F1",
      idempotencyKey: "incomplete-key",
    });
    expect(result.case?.case.status).toBe("INCOMPLETE");
  });

  it("aggregates KPIs", () => {
    const kpis = service.getKpis();
    expect(kpis.openCount).toBeGreaterThan(0);
    expect(kpis.byStage).toBeDefined();
    expect(kpis.automationRate).toBeGreaterThanOrEqual(0);
  });

  it("extracts from fixture text", async () => {
    const proposal = await service.extractFromText(
      "case-004",
      "Original für AKM-DEMO-004 erhalten",
    );
    expect(proposal.intent).toBe("ORIGINAL_PRESCRIPTION_RECEIVED");
    expect(proposal.source).toBe("fixture");
  });

  it("completes an incomplete case when missing fields are filled", () => {
    const before = service.getCaseById("AKM-DEMO-006");
    expect(before?.case.status).toBe("INCOMPLETE");

    const after = service.updateMissingData(
      "AKM-DEMO-006",
      { deliveryRef: "LIEF-DEMO-FIX" },
      before!.case.version,
    );

    expect(after?.case.status).toBe("REQUEST_READY");
    expect(after?.case.delivery_ref).toBe("LIEF-DEMO-FIX");
    expect(after?.missingFields).toEqual([]);
    expect(after?.exceptions.filter((ex) => !ex.resolved_at)).toHaveLength(0);
  });

  it("assigns a case owner without changing status", () => {
    const before = service.getCaseById("AKM-DEMO-004")!;
    const after = service.assignOwner("AKM-DEMO-004", "Tim KRS", before.case.version);

    expect(after?.case.owner).toBe("Tim KRS");
    expect(after?.case.status).toBe(before.case.status);
  });

  it("acknowledges an exception without changing case status", () => {
    const before = service.getCaseById("AKM-DEMO-004")!;
    const open = before.exceptions.find((ex) => !ex.resolved_at) as { id: string };
    expect(open).toBeDefined();

    const after = service.acknowledgeException(
      "AKM-DEMO-004",
      open.id,
      before.case.version,
    );

    expect(after?.case.status).toBe(before.case.status);
    expect(after?.exceptions.find((ex) => ex.id === open.id)?.resolved_at).toBeTruthy();
  });
});
