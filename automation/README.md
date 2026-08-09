# n8n automation

Exported workflows call the RezeptFlow Node API. They are **optional** for the live interview demo.

## Import

1. `docker compose --profile automation up`
2. Open http://localhost:5678 (default `admin` / `admin`)
3. Import JSON files from this folder

## Workflows

| File | Trigger | Node API |
|------|---------|----------|
| `new-prescription-request.json` | Webhook | `POST /webhooks/prescription-requests` |
| `waiting-case-scanner.json` | Schedule | `GET /api/cases/due` → `POST /api/demo/scan-due` |
| `order-status-webhook.json` | Webhook | `POST /webhooks/order-status` |

## Hybrid demo path

The scripted demo uses the React UI and direct API calls. n8n proves orchestration skill without making the interview dependent on n8n uptime.

Set `WEBHOOK_URL=http://backend:3001` in compose for n8n → API routing.
