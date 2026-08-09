# Repository Guidelines

RezeptFlow is an npm workspaces monorepo: a Fastify workflow API and a React/Vite German KRS cockpit around prescription/material exceptions. It is a researched prototype (synthetic data only), not an official AKM product.

## Project Structure & Module Organization

- `backend/src/domain` — status machine, case service (SoT for workflow state)
- `backend/src/adapters` — `CrmAdapter` / Mock Zoho projection; LLM extractor (OpenCode Zen + fixture fallback)
- `backend/src/routes` — REST, webhooks, KPIs, demo helpers
- `frontend/src/pages` — three screens only: Leitstand, Falldetail (incl. LLM panel), Kennzahlen
- `data/` — SQLite DB path, `seed.json`, webhook/LLM fixtures (resolve paths from repo root via `.env`)
- `automation/` — exported n8n workflows; optional `docker compose --profile automation`
- `docs/`, `demo/` — architecture, Zoho mapping, demo script
- OpenSpec under `openspec/` is for later changes; the MVP was built without an OpenSpec change cycle

**Ownership:** SQLite owns case/timeline/tasks; Mock Zoho is a sync projection; live demos call Node directly (n8n is optional).

## Build, Test, and Development Commands

```bash
npm install
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:5173 — open this for the UI
npm run build
npm run test --workspace=backend
npm run test --workspace=backend -- tests/caseService.test.ts
docker compose up --build
docker compose --profile automation up --build
```

Copy `.env.example` → `.env`. Leave `frontend/.env` `VITE_API_URL` empty locally so Vite proxies `/api` to the backend. Set `OPENCODE_ZEN_API_KEY` for live LLM; fixture fallback runs without it. Never commit `.env`.

## Coding Style & Naming Conventions

- TypeScript ESM (`"type": "module"`); backend `strict: true`
- No ESLint/Prettier config in-repo — match existing Fastify/React patterns
- German UI copy; English README/docs
- Domain statuses are uppercase enums (`AWAITING_ORIGINAL`); adapters stay replaceable behind interfaces

## Testing Guidelines

Vitest in `backend/tests/` (`vitest run`). Cover state transitions, webhook idempotency, KPI aggregation, and extract/confirm. Tests use an isolated SQLite file and close the DB after each case.

## Commit & Pull Request Guidelines

No commits on `master` yet — no established message convention. Prefer short, imperative messages focused on why (e.g. `fix env load so Zen key is available`). Keep secrets out of PRs; document demo impact in the PR body when changing seed data or the interview path.
