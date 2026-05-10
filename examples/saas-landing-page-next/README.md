# saas-landing-page-next

This directory was **assembled by `scripts/assemble-saas-landing-page.mjs`** from the AI-organisation pipeline's generated outputs. **Do not edit files in place** — every `.ts`, `.tsx`, `.json`, `.mjs`, and `.css` here was written by the pipeline and is overwritten on the next assembly run. The corresponding REPORT.md (with full agent JSON, decisions, and verification result) for each contributing task lives in [`./_reports/`](./_reports/).

## Run it

```bash
npm install
npm run dev
# then open http://localhost:3000
```

Try the form. Submit `founder@indie.com`, then submit it again — the second submission should return `status: 'duplicate'` and surface as "Looks like you're already on the list…".

## Provenance

Every file in this directory traces back to one of these AI-org pipeline runs:

- **t-signup-storage-1** — Drizzle schema
  - Report: [_reports/t-signup-storage-1.REPORT.md](./_reports/t-signup-storage-1.REPORT.md)
- **t-signup-storage-2** — Next.js Route Handler + storage adapter
  - Report: [_reports/t-signup-storage-2.REPORT.md](./_reports/t-signup-storage-2.REPORT.md)
- **t-landing-page-1** — Next.js + Tailwind project skeleton
  - Report: [_reports/t-landing-page-1.REPORT.md](./_reports/t-landing-page-1.REPORT.md)
- **t-landing-page-3** — Landing page UI
  - Report: [_reports/t-landing-page-3.REPORT.md](./_reports/t-landing-page-3.REPORT.md)

To regenerate any file, re-run its pipeline:

```bash
node scripts/run-pipeline.ts --scenario fixtures/scenarios/saas-landing-page --task <taskId>
node scripts/assemble-saas-landing-page.mjs
```

## Storage

`lib/db/client.ts` ships with an in-memory Map adapter so the demo runs with zero database setup. The Drizzle schema in `lib/db/schema/signups.ts` remains the source of truth for the row shape (the adapter imports `type Signup` from it). To upgrade to real Postgres, follow the inline notes at the top of `lib/db/client.ts`.
