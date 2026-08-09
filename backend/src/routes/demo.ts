import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { CaseService } from "../domain/caseService.js";
import { loadSeed, type AppDatabase, type SeedData } from "../db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function registerDemoRoutes(
  app: FastifyInstance,
  service: CaseService,
  db: AppDatabase,
) {
  app.post("/api/demo/reset", async () => {
    const seedPath = join(__dirname, "../../../data/seed.json");
    const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as SeedData;
    loadSeed(db, seed);
    return { ok: true, message: "Demo dataset restored" };
  });

  app.post("/api/demo/scan-due", async () => service.scanDueCases());

  app.post("/api/demo/create-event", async (req) => {
    const body = (req.body as { template?: "happy-path" | "incomplete" }) ?? {};
    return service.createDemoEvent(body.template ?? "happy-path");
  });
}
