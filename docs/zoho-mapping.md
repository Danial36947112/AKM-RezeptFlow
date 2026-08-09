# Zoho mapping (illustrative)

MVP uses `MockZohoCrmAdapter`. Production would map:

| Domain | Illustrative Zoho target |
|--------|--------------------------|
| Patient reference | Contact / custom patient module |
| Prescription workflow | Custom `Prescription_Cases` module |
| Physician practice | Account / Contact |
| Employee task | Zoho Task |
| Timeline | Notes / related list or external event store |
| Material order | Custom order module |

## Adapter contract

```typescript
interface CrmAdapter {
  findCaseByExternalId(externalId: string): Promise<CrmCase | null>;
  upsertPrescriptionCase(input: PrescriptionCaseInput): Promise<CrmCase>;
  createTask(input: CrmTaskInput): Promise<{ id: string }>;
  appendTimelineEvent(caseId: string, event: TimelineEvent): Promise<void>;
}
```

See `backend/src/adapters/crm/` and `ZohoCrmAdapter` skeleton for production swap.
