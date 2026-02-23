# MediBrief — 3-Minute Demo Script

> A guided walkthrough for interviews and presentations. Hit every technical highlight in under 3 minutes.

---

## 🎯 Opening (15 seconds)

> "MediBrief is a multi-tenant clinical monitoring SaaS I built full-stack. It uses Next.js, Express, PostgreSQL, and Redis to give healthcare clinics real-time AI-powered patient insights — all with HIPAA-grade security architecture."

---

## 1️⃣ The UI/UX — Real-Time AI Streaming (60 seconds)

### Show It

1. **Login** as the admin → Dashboard loads instantly
2. Navigate to **AI Clinical Summary**
3. Select a patient → Click **"Generate New Summary"**
4. Point out the **skeleton loader** with live status updates (Queued → Processing)
5. Watch the summary **stream in character-by-character** with Markdown rendering
6. Scroll through the formatted output — headers, bullet points, risk flags

### Explain It

> "When you click Generate, the frontend fires a POST to queue an async BullMQ job, then opens an **SSE (Server-Sent Events) connection** to stream status updates in real-time. I chose SSE over WebSockets because it's unidirectional — perfect for LLM text generation — lighter to implement, and works over standard HTTP with automatic reconnection. The summary renders as Markdown with a typewriter animation, just like ChatGPT."

### Bonus Points

- Click **Export .pdf** to show jsPDF export
- Show the **Previous Summaries** history panel

---

## 2️⃣ The Security — JWT + Multi-Tenant Isolation (45 seconds)

### Show It

1. **Open DevTools → Network tab**
2. Make any API request (e.g., load patients)
3. Click the request → **Headers tab** → Point to `Authorization: Bearer <JWT>`
4. Switch to **patient portal** (different login) — show different token scope

### Explain It

> "Every API request carries a JWT with claims for user ID, clinic ID, and role. The **tenant middleware** extracts the clinic ID and injects it into every database query — so Clinic A can never see Clinic B's data. On top of that, I implemented **PostgreSQL Row-Level Security** as a database-level safety net, rate limiting at three tiers — global, auth-specific, and AI-specific — and a strict CORS policy that validates origins against a whitelist."

### Bonus Points

> "I also built **role-based access control** — ADMIN, DOCTOR, and PATIENT each have different API scopes. The patient portal uses a completely separate auth flow with invite tokens."

---

## 3️⃣ The Medical AI Pipeline — Anonymization + Compliance (60 seconds)

### Show It

1. Navigate to the **AI Summary** and point to a generated summary
2. Open the **README** → scroll to **Compliance Architecture** section
3. Point out the HIPAA and GDPR tables
4. Show the **PHI Data Flow** diagram

### Explain It

> "Before any patient data reaches the LLM, it passes through an **anonymization layer**. The system strips all PHI — names, dates of birth, IDs — and replaces them with clinical tokens. The AI only sees anonymized vitals trends, lab values, and symptom keywords. This is critical because you **never want raw patient data hitting a third-party API**."

> "I built the compliance architecture around two frameworks: **HIPAA** for US healthcare and **GDPR** for European data protection. The system implements soft-delete for the right-to-erasure, a full audit trail for every data access, and PHI scrubbing in the audit logs themselves — so even the audit records don't contain raw patient data."

### Bonus Points

> "The audit dashboard lets clinic admins see exactly who accessed what and when — with pagination and filtering. Every action from registration to AI generation is logged."

---

## 🏁 Closing (15 seconds)

> "The full stack is deployed on Vercel, Render, and Upstash — with Docker Compose for local development, a CI-ready test suite of 117 E2E assertions and 38 unit tests, and comprehensive API documentation via Swagger. Happy to dive deeper into any layer."

---

## 💡 Anticipated Questions & Answers

### "Why Express instead of Next.js API routes?"

> "Separation of concerns. The backend runs an independent BullMQ worker for async AI jobs and SSE streams — things that don't fit the serverless model of Next.js API routes. In production, the backend can scale independently from the frontend."

### "How do you handle the AI being down?"

> "Graceful degradation. If no OpenAI key is configured or the API is unreachable, the system generates a **structured fallback summary** from the clinical data alone — vital sign trends, lab flags, risk calculations — all computed locally. The user always gets value."

### "What about horizontal scaling?"

> "The BullMQ queue is the key. You can spin up multiple workers consuming from the same Redis queue. PostgreSQL RLS ensures data isolation regardless of which server handles the request. The SSE streams use Redis PubSub, so any server can push events to any connected client."

### "How did you test this?"

> "Three layers: 38 Vitest unit tests for business logic (analytics, anonymizer, security middleware), 117 E2E API integration tests that exercise every endpoint from registration to portal, and Playwright browser tests for critical UI flows."
