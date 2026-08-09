# RezeptFlow

Internal exception-management cockpit for the administrative journey from dressing-material prescription request to confirmed delivery. Built as a researched prototype for AKM-style KRS operations — **not** an official AKM product.

## Problem

Prescription and material-supply handoffs span field wound managers, KRS staff, physician practices, and wholesalers. Cases can age silently between milestones. RezeptFlow makes each milestone an event on one timeline, automates predictable steps, and surfaces only exceptions that need human action.

## Architecture

- **React/Vite** — German KRS cockpit (3 screens)
- **Fastify + Node SQLite** — workflow source of truth, validation, idempotency, KPIs
- **Mock Zoho adapter** — CRM sync projection with replaceable boundary
- **n8n** (optional profile) — exported workflows; live demo does not depend on n8n
- **OpenCode Zen** — LLM extraction (`deepseek-v4-flash-free`) with fixture fallback

```
Webhook/UI → Node API → SQLite (SoT) → React UI
                ↓
         Mock Zoho projection
                ↓
         LLM extractor (Zen / fixture)
```

## Quick start

```bash
cp .env.example .env
npm install
```

Start **both** processes in separate terminals (Windows does not support the old combined `&` script):

```bash
npm run dev:backend    # http://localhost:3001  — API
npm run dev:frontend   # http://localhost:5173  — UI
```

Open **http://localhost:5173** in the browser. Port 3001 is the API only — it will not show the UI.

Optional: set `OPENCODE_ZEN_API_KEY` in `.env` for live LLM (fixture fallback works without it). Vite reads `VITE_*` from `frontend/.env` if you create one; leave `VITE_API_URL` empty locally so the Vite proxy to the backend is used.

### Docker

```bash
docker compose up --build
# Optional n8n:
docker compose --profile automation up --build
```

## Demo script (5–7 min)

1. Open **AKM-DEMO-004** (aged exception)
2. **Demo-Ereignis erzeugen** (happy path)
3. Fix missing field on **AKM-DEMO-006**
4. **LLM:** paste synthetic “original received” text → confirm
5. Simulate order/delivery transitions
6. Open **Kennzahlen** — show KPI change
7. Show `CrmAdapter` / `docs/zoho-mapping.md`

Backup: 60–90s screen recording if live demo fails.

## Synthetic data only

All patient/partner references are fictional. No real health data. GDPR production use would require legal review, access controls, and approved processors.

## Tests

```bash
npm run test --workspace=backend
```

## Out of scope (phase 1)

Live Zoho, Power BI, SSO, clinical validation, real wholesaler/fax integration.

## Docs

- [Architecture](docs/architecture.md)
- [Process map](docs/process-map.md)
- [Zoho mapping](docs/zoho-mapping.md)
- [Assumptions](docs/assumptions.md)
- [Privacy](docs/privacy.md)
- [Demo script](demo/demo-script.md)
- [n8n hybrid path](automation/README.md)
