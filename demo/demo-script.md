# Demo script

## Setup

```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

Optional: `OPENCODE_ZEN_API_KEY` in `.env` for live LLM (fixture fallback works without).

## Live path (~6 min)

| Time | Action |
|------|--------|
| 0:00 | Problem slide: field → KRS → practice → original → wholesaler → delivery |
| 0:45 | Architecture: Zoho boundary, Node SoT, n8n optional, synthetic data |
| 1:20 | Open **AKM-DEMO-004** — show aged exception + timeline |
| 2:00 | **Demo-Ereignis erzeugen** — new case in Leitstand |
| 2:30 | Open **AKM-DEMO-006** — add Lieferziel-Referenz, save |
| 3:00 | **LLM** on DEMO-004: paste text → analysieren → bestätigen |
| 3:45 | Transitions: Bestellung → Versand → Lieferung bestätigen |
| 4:30 | **Kennzahlen** — KPI change, CSV export mention |
| 5:15 | Show CrmAdapter + zoho-mapping.md |
| 5:45 | Validation questions for interviewer |

## Recording backup

Record 60–90s: trigger demo event → fix field → LLM confirm → KPI screen.

See `demo/recording-notes.md`.
