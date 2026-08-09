import "./loadEnv.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDatabase, seedIfEmpty } from "./db/index.js";
import { MockZohoCrmAdapter } from "./adapters/crm/mockZohoCrmAdapter.js";
import { createLlmExtractor } from "./adapters/llm/zenExtractor.js";
import { CaseService } from "./domain/caseService.js";
import { config } from "./config.js";
import { registerCaseRoutes } from "./routes/cases.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerKpiRoutes } from "./routes/kpis.js";
import { registerDemoRoutes } from "./routes/demo.js";

const db = createDatabase();
seedIfEmpty(db);

const crm = new MockZohoCrmAdapter();
const llm = createLlmExtractor();
const caseService = new CaseService(db, crm, llm);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  llmConfigured: Boolean(process.env.OPENCODE_ZEN_API_KEY),
}));

registerCaseRoutes(app, caseService);
registerWebhookRoutes(app, caseService);
registerKpiRoutes(app, caseService);
registerDemoRoutes(app, caseService, db);

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  console.error(err);
  process.exit(1);
});
