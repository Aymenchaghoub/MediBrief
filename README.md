# 🏥 MediBrief – AI-Powered Clinical Summary SaaS

MediBrief is a multi-tenant medical tracking platform with AI-generated clinical summaries and trend analysis.

## Architecture

- **Frontend**: Next.js App Router (`frontend/`)
- **Backend API**: Node.js + Express + Prisma (`backend/`)
- **Database**: PostgreSQL
- **AI service**: OpenAI-compatible integration (to implement in Phase 5)
- **File storage**: S3/Supabase (to implement)

## Multi-Tenant Strategy

- Every core entity is scoped by `clinic_id`.
- Backend middleware enforces tenant context from JWT payload.
- API routes are partitioned into auth and protected tenant routes.

## Security Baseline

- JWT authentication (in progress)
- Password hashing with `bcrypt` (in progress)
- Tenant isolation middleware scaffolded
- Role middleware scaffolded (`ADMIN | DOCTOR`)
- Input validation planned with `zod`
- Audit log model included

## GDPR and Clinical Data Notes

- GDPR awareness: process minimization and access controls are mandatory.
- Use encrypted PostgreSQL storage at rest.
- **Do not use real patient data in development/demo**.
- Use synthetic datasets only.

## Project Structure

- `backend/`: Express API, Prisma schema, modular domains
- `frontend/`: Next.js app with dashboard routes and shared libs

## Quick Start

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run build
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:3000`  
Backend default: `http://localhost:4000`

## Current Status (Phase 0/1 bootstrap)

- ✅ Monorepo scaffolded (`frontend` + `backend`)
- ✅ Prisma medical schema created
- ✅ Express modular API skeleton created
- ✅ Next.js dashboard route skeleton created
- ✅ Build validation passed on backend and frontend

## Roadmap

1. Project setup, schema, auth, tenant structure
2. Patients CRUD + role checks + clinic isolation
3. Vitals + charts + lab results
4. Consultations + timeline UI
5. AI integration + structured prompts + summary storage
6. Analytics dashboard + risk flags + anomaly detection
7. Audit logs + security hardening + refactor
8. Docker + deployment + final README/demo
