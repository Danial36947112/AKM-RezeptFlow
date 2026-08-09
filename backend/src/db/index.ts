import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

export type AppDatabase = DatabaseSync;

export function getRepoRoot(): string {
  return repoRoot;
}

export function getDbPath(): string {
  const raw = process.env.DATABASE_PATH;
  if (!raw) return join(repoRoot, "data/rezeptflow.db");
  return isAbsolute(raw) ? raw : resolve(repoRoot, raw);
}

export function createDatabase(): AppDatabase {
  const path = getDbPath();
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prescription_cases (
      id TEXT PRIMARY KEY,
      external_id TEXT UNIQUE NOT NULL,
      patient_ref TEXT,
      physician_ref TEXT,
      delivery_ref TEXT,
      material_ref TEXT,
      field_employee_ref TEXT,
      status TEXT NOT NULL,
      owner TEXT,
      at_risk INTEGER NOT NULL DEFAULT 0,
      next_action_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES prescription_cases(id),
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      idempotency_key TEXT UNIQUE,
      payload TEXT NOT NULL DEFAULT '{}',
      occurred_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follow_up_tasks (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES prescription_cases(id),
      type TEXT NOT NULL,
      owner TEXT,
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_orders (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES prescription_cases(id),
      supplier_ref TEXT,
      status TEXT NOT NULL,
      ordered_at TEXT,
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES prescription_cases(id),
      reason TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      resolved_at TEXT,
      resolution TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cases_status ON prescription_cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_next_action ON prescription_cases(next_action_at);
    CREATE INDEX IF NOT EXISTS idx_events_case ON workflow_events(case_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_case ON exceptions(case_id);
  `);
}

export function seedIfEmpty(db: AppDatabase): void {
  const count = db.prepare("SELECT COUNT(*) as c FROM prescription_cases").get() as { c: number };
  if (count.c > 0) return;

  const seedPath = join(dirname(getDbPath()), "seed.json");
  if (!existsSync(seedPath)) return;

  const seed = JSON.parse(readFileSync(seedPath, "utf-8"));
  loadSeed(db, seed);
}

export function loadSeed(db: AppDatabase, seed: SeedData): void {
  const pastDue = new Date(Date.now() - 2 * 3600_000).toISOString();
  const futureDue = new Date(Date.now() + 8 * 3600_000).toISOString();

  const runTx = () => {
    db.exec("DELETE FROM workflow_events");
    db.exec("DELETE FROM follow_up_tasks");
    db.exec("DELETE FROM material_orders");
    db.exec("DELETE FROM exceptions");
    db.exec("DELETE FROM prescription_cases");

    const insertCase = db.prepare(`
      INSERT INTO prescription_cases (
        id, external_id, patient_ref, physician_ref, delivery_ref, material_ref,
        field_employee_ref, status, owner, at_risk, next_action_at, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of seed.cases) {
      let nextAction = c.next_action_at;
      if (c.at_risk && nextAction) nextAction = pastDue;
      if (
        !c.at_risk &&
        nextAction &&
        c.status !== "DELIVERED" &&
        c.status !== "CANCELLED"
      ) {
        const created = new Date(c.created_at).getTime();
        if (Date.now() - created < 24 * 3600_000) nextAction = futureDue;
      }
      insertCase.run(
        c.id,
        c.external_id,
        c.patient_ref,
        c.physician_ref,
        c.delivery_ref,
        c.material_ref,
        c.field_employee_ref,
        c.status,
        c.owner,
        c.at_risk ? 1 : 0,
        nextAction,
        c.version ?? 1,
        c.created_at,
        c.updated_at,
      );
    }

    const insertEvent = db.prepare(`
      INSERT INTO workflow_events (id, case_id, event_type, source, idempotency_key, payload, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of seed.events ?? []) {
      insertEvent.run(
        e.id,
        e.case_id,
        e.event_type,
        e.source,
        e.idempotency_key,
        e.payload,
        e.occurred_at,
      );
    }

    const insertTask = db.prepare(`
      INSERT INTO follow_up_tasks (id, case_id, type, owner, due_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of seed.tasks ?? []) {
      insertTask.run(t.id, t.case_id, t.type, t.owner, t.due_at, t.status, t.created_at);
    }

    const insertOrder = db.prepare(`
      INSERT INTO material_orders (id, case_id, supplier_ref, status, ordered_at, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const o of seed.orders ?? []) {
      insertOrder.run(
        o.id,
        o.case_id,
        o.supplier_ref,
        o.status,
        o.ordered_at,
        o.delivered_at,
      );
    }

    const insertEx = db.prepare(`
      INSERT INTO exceptions (id, case_id, reason, severity, resolved_at, resolution, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ex of seed.exceptions ?? []) {
      insertEx.run(
        ex.id,
        ex.case_id,
        ex.reason,
        ex.severity,
        ex.resolved_at,
        ex.resolution,
        ex.created_at,
      );
    }
  };

  db.exec("BEGIN");
  try {
    runTx();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export interface SeedData {
  cases: Array<{
    id: string;
    external_id: string;
    patient_ref: string | null;
    physician_ref: string | null;
    delivery_ref: string | null;
    material_ref: string | null;
    field_employee_ref: string | null;
    status: string;
    owner: string | null;
    at_risk: boolean;
    next_action_at: string | null;
    version?: number;
    created_at: string;
    updated_at: string;
  }>;
  events?: Array<{
    id: string;
    case_id: string;
    event_type: string;
    source: string;
    idempotency_key: string | null;
    payload: string;
    occurred_at: string;
  }>;
  tasks?: Array<{
    id: string;
    case_id: string;
    type: string;
    owner: string | null;
    due_at: string | null;
    status: string;
    created_at: string;
  }>;
  orders?: Array<{
    id: string;
    case_id: string;
    supplier_ref: string | null;
    status: string;
    ordered_at: string | null;
    delivered_at: string | null;
  }>;
  exceptions?: Array<{
    id: string;
    case_id: string;
    reason: string;
    severity: string;
    resolved_at: string | null;
    resolution: string | null;
    created_at: string;
  }>;
}
