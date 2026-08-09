import type { FastifyInstance } from "fastify";
import type { CaseService } from "../domain/caseService.js";

export function registerKpiRoutes(app: FastifyInstance, service: CaseService) {
  app.get("/api/kpis", async () => service.getKpis());

  app.get("/api/kpis/export.csv", async (_req, reply) => {
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", "attachment; filename=kpis.csv");
    return service.exportKpisCsv();
  });
}
