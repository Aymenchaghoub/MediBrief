# MediBrief Frontend

Premium dark-mode SaaS frontend for MediBrief, built with Next.js App Router and TypeScript.

## Features

- Authentication workspace (clinic register + login)
- Guarded dashboard routes with token-based session checks
- Patients module with list + create flow
- Consultations module with patient timeline + create flow
- Analytics module with clinic risk and anomaly visibility
- AI summary generation with export to `.txt` and `.pdf`
- Toast notifications for success/error feedback

## Routes

- `/` landing page
- `/auth` authentication workspace
- `/dashboard` overview KPI dashboard
- `/dashboard/patients` patients registry + create form
- `/dashboard/consultations` consultations timeline + create form
- `/dashboard/analytics` clinic and patient analytics
- `/dashboard/ai-summary` AI summary generation and exports

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## Notes

- Frontend expects backend auth + domain APIs to be running.
- Remaining npm audit highs are from ESLint dependency chain and require a major lint stack upgrade (`npm audit fix --force`).
