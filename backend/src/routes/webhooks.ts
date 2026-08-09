import type { FastifyInstance } from "fastify";
import type { CaseService } from "../domain/caseService.js";

export function registerWebhookRoutes(app: FastifyInstance, service: CaseService) {
  app.post("/webhooks/prescription-requests", async (req, reply) => {
    try {
      const result = await service.handlePrescriptionRequest(
        req.body as import("../domain/types.js").PrescriptionRequestPayload,
      );
      return reply.status(result.duplicate ? 200 : 201).send(result);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });

  app.post("/webhooks/order-status", async (req, reply) => {
    const secret = (req.headers["x-webhook-secret"] as string) ?? undefined;
    try {
      const result = await service.handleOrderStatus(
        req.body as import("../domain/types.js").OrderStatusPayload,
        secret,
      );
      return reply.status(result.duplicate ? 200 : 201).send(result);
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message });
    }
  });
}
