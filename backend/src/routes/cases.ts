import type { FastifyInstance } from "fastify";
import type { CaseService } from "../domain/caseService.js";

export function registerCaseRoutes(app: FastifyInstance, service: CaseService) {
  app.get("/api/cases", async (req) => {
    const q = req.query as Record<string, string>;
    return service.listCases({
      status: q.status,
      atRisk: q.atRisk === "true",
      exception: q.exception === "true",
      owner: q.owner,
    });
  });

  app.get("/api/cases/due", async () => service.getDueCases());

  app.get("/api/cases/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = service.getCaseById(id);
    if (!detail) return reply.status(404).send({ error: "Case not found" });
    return detail;
  });

  app.patch("/api/cases/:id/missing-data", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { version: number; data: Record<string, string> };
    try {
      return service.updateMissingData(id, body.data, body.version);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post("/api/cases/:id/transitions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { eventType: string; version: number };
    try {
      return service.applyTransition(id, body.eventType, body.version);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post("/api/cases/:id/extract", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text: string };
    try {
      return await service.extractFromText(id, body.text);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post("/api/cases/:id/extract/confirm", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      version: number;
      proposal: import("../domain/types.js").ExtractionProposal;
    };
    try {
      return service.confirmExtraction(id, body.proposal, body.version);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });
}
