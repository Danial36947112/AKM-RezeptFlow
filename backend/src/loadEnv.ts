import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// backend/src -> repo root; backend/dist -> repo root
const repoRoot = resolve(here, "../..");
loadEnv({ path: resolve(repoRoot, ".env") });
