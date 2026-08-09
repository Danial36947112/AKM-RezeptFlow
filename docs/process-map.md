# Process map

```
Feldmitarbeiter → KRS → Arztpraxis → Original → Großhändler → Lieferung
```

| Phase | Status | Typical trigger |
|--------|--------|-----------------|
| Intake | NEW / INCOMPLETE | Webhook prescription request |
| Ready | REQUEST_READY | Admin fields complete |
| Original | AWAITING_ORIGINAL | Request sent to practice |
| Order prep | READY_TO_ORDER | Original received |
| Fulfillment | ORDERED → SHIPPED → DELIVERED | Wholesaler events + human confirm |

`at_risk` is a flag overlay when escalation thresholds are exceeded — not a separate status.

## Exception types

- Missing administrative references
- Overdue original or wholesaler confirmation
- Duplicate webhook (ignored via idempotency)
