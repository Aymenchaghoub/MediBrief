# 🏥 MediBrief

MediBrief is a multi-tenant clinical monitoring SaaS that helps clinics manage patients, consultations, and AI-assisted summaries from vitals and labs.

## What This Project Includes

- Frontend web app (Next.js, TypeScript, App Router)
- Backend API (Express, TypeScript, Prisma)
- PostgreSQL data model for clinic-scoped healthcare records
- AI summary generation with OpenAI-compatible providers
- Clinic analytics (risk overview + anomaly-focused trends)
- Audit logging and role-based access controls
- Docker setup for local full-stack runs

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript
- Backend: Node.js, Express 5, TypeScript
- Database: PostgreSQL + Prisma ORM
- Auth: JWT + bcrypt
- Validation: Zod
- AI: OpenAI SDK (OpenAI-compatible endpoints)

## Repository Structure

- `frontend/` UI and user flows
- `backend/` API, business logic, Prisma schema
- `docker-compose.yml` local orchestration (frontend + backend + postgres)

---

## Core Product Flows

1. Register clinic admin or sign in
2. Create patients (clinic-scoped)
3. Add consultations
4. Add vitals/lab data (API-supported)
5. Generate AI clinical summaries
6. Review clinic analytics and anomaly indicators
7. Inspect audit trail (admin role)

---

## Multi-Tenant and Security Model

- Every protected API request uses JWT auth
- Tenant context is derived from JWT and enforced server-side
- Patients and related records are isolated by clinic
- Role model:
  - `ADMIN`
  - `DOCTOR`
- API hardening includes:
  - Helmet
  - CORS config
  - Rate limiting
  - Optional HTTPS enforcement in production (`REQUIRE_HTTPS=true`)

---

## Local Setup (Recommended)

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 16+ (or Docker Desktop)

### 1) Start Database

From repository root:

```bash
docker compose up -d postgres
```

### 2) Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npx prisma db push
npm run dev
```

Backend runs at: `http://localhost:4000`

### 3) Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

Required/important keys:

- `NODE_ENV` (`development|test|production`)
- `PORT` (default `4000`)
- `DATABASE_URL`
- `JWT_SECRET` (minimum 32 chars)
- `JWT_EXPIRES_IN` (default `1d`)
- `CORS_ORIGIN` (default `http://localhost:3000`)
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `REQUIRE_HTTPS` (`true|false`)

AI keys:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_HTTP_REFERER` (optional)
- `OPENAI_APP_NAME` (optional)

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_API_URL=http://localhost:4000/api`

---

## AI Provider Configuration

MediBrief uses OpenAI-compatible endpoints.

Example free-tier-friendly config (OpenRouter):

- `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
- `OPENAI_MODEL=google/gemma-3-4b-it:free`

To switch to official OpenAI later, only update env values.

---

## API Documentation (High-Level)

Base URL: `/api`

### Auth

- `POST /auth/register-clinic`
- `POST /auth/login`

### User

- `GET /users/me`

### Patients

- `GET /patients`
- `POST /patients`
- `GET /patients/:id`
- `PUT /patients/:id`
- `DELETE /patients/:id` (`ADMIN` only)

### Vitals

- `POST /vitals`
- `GET /vitals/:patientId`

### Labs

- `POST /labs`
- `GET /labs/:patientId`

### Consultations

- `POST /consultations`
- `GET /consultations/:patientId`

### AI

- `POST /ai/generate-summary/:patientId`

### Analytics

- `GET /analytics/patient/:patientId`
- `GET /analytics/clinic-risk`

### Audit

- `GET /audit` (`ADMIN` only)

---

## Development Commands

### Backend

```bash
npm run dev
npm run build
npm test
npm run prisma:generate
npm run prisma:migrate
```

### Frontend

```bash
npm run dev
npm run build
npm run lint
```

---

## Docker Full-Stack Run

From repository root:

```bash
docker compose up -d --build
```

Then initialize schema (first run):

```bash
cd backend
cp .env.docker .env
npx prisma db push
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Postgres: `localhost:5432`

---

## Testing and Readiness

Current verification status:

- Backend build passes
- Backend tests pass
- Prisma client generation passes
- Backend health endpoint responds (`/health`)
- Frontend lint/build pass

Notes:

- `npm audit` still reports some vulnerabilities in transitive dev tooling chains (not fixed without potentially breaking major upgrades).
- Keep dependencies reviewed before production release.

---

## Production Checklist

- Replace demo/default secrets (`JWT_SECRET`, AI keys)
- Set strict CORS origin
- Enable `REQUIRE_HTTPS=true` behind TLS
- Rotate any previously exposed API keys
- Use managed PostgreSQL backups and monitoring
- Add centralized logging/observability
- Run vulnerability triage before deployment

---

## Compliance and Data Safety

- Use synthetic/non-real patient data for demos
- Enforce least privilege for clinical users
- Keep audit logs enabled for traceability
- Treat AI output as support, not diagnosis

---

## Troubleshooting

### API says unauthorized

- Confirm JWT token exists in browser local storage
- Ensure backend `JWT_SECRET` is stable and not changed during active sessions

### Frontend cannot reach backend

- Verify `NEXT_PUBLIC_API_URL` points to running backend
- Verify backend CORS origin includes frontend URL

### Prisma connection errors

- Confirm Postgres is running and `DATABASE_URL` is correct
- Run `npx prisma db push` after schema changes

### Docker command not found

- Install Docker Desktop and ensure daemon is running

---

## Additional Docs

- Frontend-specific details: `frontend/README.md`
- Backend implementation details: source modules under `backend/src/modules/`
