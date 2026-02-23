# MediBrief — Deployment Guide

## Architecture Overview

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Vercel     │────▶│  Render (Node)  │────▶│ Render PG 16 │
│  Next.js UI  │     │  Express API    │     │  PostgreSQL   │
│  (HTTPS)     │     │  BullMQ Worker  │     └──────────────┘
└─────────────┘     │  SSE Streams    │     ┌──────────────┐
                    │                 │────▶│   Upstash     │
                    └─────────────────┘     │   Redis       │
                                            └──────────────┘
```

---

## 1. Database — Render PostgreSQL

1. Go to [render.com](https://render.com) → **New** → **PostgreSQL**
2. Name: `medibrief-db`, Region: Ohio, Plan: Starter
3. Copy the **Internal Database URL** (starts with `postgresql://`)

## 2. Redis — Upstash

1. Go to [upstash.com](https://upstash.com) → **Create Database**
2. Name: `medibrief-redis`, Region: US-East-1, Type: **Regional**
3. Enable **TLS** (default)
4. Copy the **Redis URL** — starts with `rediss://` (double-s = TLS)
5. The app auto-detects TLS from the `rediss://` scheme

## 3. Backend — Render Web Service

### Option A: Blueprint (Recommended)

1. Push this repo to GitHub
2. On Render → **New** → **Blueprint** → connect your repo
3. Render reads `render.yaml` and provisions everything automatically
4. Fill in the synced env vars when prompted:
   - `REDIS_URL` → Upstash Redis URL
   - `CORS_ORIGIN` → Your Vercel URL (e.g., `https://medibrief.vercel.app`)
   - `OPENAI_API_KEY` → (optional) Your OpenAI key

### Option B: Manual

1. **New** → **Web Service** → connect repo, root directory: `backend`
2. Build command: `npm ci && npm run prisma:generate && npm run build`
3. Start command: `npx prisma db push --accept-data-loss && node dist/server.js`
4. Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | Render PostgreSQL Internal URL |
| `REDIS_URL` | Upstash Redis URL (`rediss://...`) |
| `JWT_SECRET` | Generate: `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | `1d` |
| `CORS_ORIGIN` | Your Vercel frontend URL |
| `REQUIRE_HTTPS` | `true` |
| `SWAGGER_ENABLED` | `true` |
| `OPENAI_API_KEY` | *(optional)* |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | `gpt-4o-mini` |

5. Health check path: `/health`

## 4. Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
2. Framework preset: **Next.js** (auto-detected)
3. Root directory: `frontend`
4. Environment variable:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://medibrief-backend.onrender.com/api` |

5. Deploy — Vercel builds and gives you an HTTPS URL

## 5. Post-Deployment Checklist

- [ ] Update `CORS_ORIGIN` on Render to match Vercel URL
- [ ] Verify `/health` returns `{"status":"ok"}` on your Render URL
- [ ] Test registration + login on the Vercel frontend
- [ ] Generate an AI summary to verify Redis queue + BullMQ pipeline
- [ ] Check `/docs` endpoint for Swagger API documentation
- [ ] (Optional) Add a custom domain on Vercel and Render

## 6. Cost Breakdown

| Service | Plan | Monthly Cost |
|---|---|---|
| Vercel (Frontend) | Hobby | **Free** |
| Render (Backend) | Starter | **$7/mo** |
| Render (PostgreSQL) | Starter | **$7/mo** |
| Upstash (Redis) | Free | **Free** (10K commands/day) |
| **Total** | | **~$14/mo** |

> For a demo/interview, the free tiers on Render + Upstash are sufficient. Render's free web service spins down after inactivity (cold start ~30s).

---

## Troubleshooting

**Backend won't start on Render?**
- Check the deploy logs. Ensure `DATABASE_URL` and `REDIS_URL` are set.
- Prisma db push runs on startup — first deploy may take 30-60s.

**CORS errors on frontend?**
- Ensure `CORS_ORIGIN` on Render exactly matches your Vercel URL (no trailing slash).
- Multiple origins: use comma-separated values `https://medibrief.vercel.app,https://custom.domain.com`

**Redis connection refused?**
- Upstash URLs use `rediss://` (TLS). The app auto-detects this.
- Ensure you copied the full URL including password.

**AI summaries show fallback text?**
- Set `OPENAI_API_KEY` on Render. Without it, the app generates a structured fallback summary from the clinical data.
