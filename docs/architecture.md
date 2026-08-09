# Architecture

## Ownership

| Layer | Responsibility |
|--------|----------------|
| SQLite | Case status, tasks, exceptions, timeline, orders (workflow SoT) |
| Mock Zoho | Sync projection via `CrmAdapter` |
| Node API | Validation, transitions, idempotency, due-scan, KPIs, LLM confirm |
| n8n | Optional orchestration; demo path hits Node directly |
| React | Exception cockpit (German UI) |

## Hybrid n8n

Live interview demos call Node webhooks and `/api/demo/scan-due` directly. Exported workflows in `automation/` call the same endpoints for skill demonstration when `docker compose --profile automation` is used.

## LLM boundary

- Extract: propose structured JSON only
- Confirm: human approves before state transition
- Fallback: fixture extractor when Zen key missing or API fails

## Future production

- Zoho OAuth + custom module mapping
- PostgreSQL / EU hosting
- SSO, signed webhooks, monitoring
