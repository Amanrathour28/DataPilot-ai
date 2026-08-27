# DataPilot AI — Complete Deep Audit

> Analysis performed: 2026-08-28 | Source of truth: Actual source code inspection

---

## 1. Executive Summary

DataPilot AI is an ambitious autonomous multi-agent data investigation platform built with FastAPI, React, PostgreSQL (Neon), and a serverless Vercel deployment. The architecture demonstrates genuine engineering sophistication — durable execution leases, SSE event streaming, cursor-based reconnection, retry logic with backoff, atomic terminal state transitions, and a real statistical testing library.

**However, the core value proposition is currently compromised by a critical implementation gap**: the agent pipeline that should analyze real user-uploaded data instead returns hardcoded demo results from a hypothetical Q2/Q3 revenue scenario. Every investigation — regardless of what data the user uploads — produces nearly identical findings, statistical test results, and confidence scores.

**Production readiness score: 4/10**

The infrastructure is genuinely solid. The data intelligence is mostly fake.

---

## 2. Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      VERCEL STATIC (Frontend)                                   │
│  React 19 + Vite 8 + TailwindCSS 4                                              │
│                                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐   │
│  │ Landing  │  │ Auth Pages   │  │  Investigations  │  │ Datasets/Documents  │   │
│  │ /login   │  │ /register    │  │  list/new/detail │  │ /knowledge /agents  │   │
│  └──────────┘  └──────────────┘  └────────────────┘  └─────────────────────┘   │
│                                                                                  │
│  State: Zustand (auth, workspace) + React Query (server state)                  │
│  API: Axios + JWT interceptor → BASE_URL/api/v1                                 │
│  SSE: native EventSource (BROKEN in production — no auth headers)               │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ HTTPS REST
                                        │ EventSource (SSE) ← AUTH BROKEN
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    VERCEL PYTHON SERVERLESS (Backend)                            │
│  FastAPI 0.111 + uvicorn | api/index.py → backend/app/main.py                   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ API Routes (/api/v1)                                                      │   │
│  │  /auth      /workspaces    /datasets    /investigations    /documents      │   │
│  │  /memories  /analytics     /system      cron-worker (SSE)                 │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────────┐     │
│  │  InvestigationWorker             │  │  Services                         │     │
│  │  (worker.py — 1080 lines)        │  │  llm_service.py (Groq/OpenAI/     │     │
│  │                                  │  │    Ollama/Fallback)               │     │
│  │  Stages:                         │  │  profiling_service.py (real)      │     │
│  │  1. Planning Agent (LLM)         │  │  document_service.py (TF RAG)     │     │
│  │  2. Data Analyst (LLM+Exec)      │  │  statistical_service.py (REAL,    │     │
│  │  3. Hypothesis Agent (LLM)       │  │    but not wired to agents!)      │     │
│  │  4. Hypothesis Tester (MOCK)     │  │  evidence_service.py              │     │
│  │  5. RAG Agent (partial)          │  │  dataset_relationship_service.py  │     │
│  │  6. Critic Agent (LLM)           │  │  semantic_dataset_service.py      │     │
│  │  7. Report Agent (LLM+hardcode)  │  │  memory_service.py                │     │
│  │                                  │  └───────────────────────────────────┘     │
│  │  Execution Lease: DB-locked      │                                            │
│  │  Retry: max 2, backoff 5/15s     │  ┌───────────────────────────────────┐     │
│  └─────────────────────────────────┘  │  Tools                            │     │
│                                        │  python_executor.py (subprocess    │     │
│  Worker trigger:                       │    sandbox, AST security check)   │     │
│  - Local: asyncio.create_task()        └───────────────────────────────────┘     │
│  - Vercel: GET/POST /cron-worker                                                 │
│    (fired by Vercel Cron every minute)                                          │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ asyncpg / NullPool
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         NEON POSTGRESQL (Database)                               │
│                                                                                  │
│  users | workspaces | workspace_members | datasets | dataset_profiles           │
│  dataset_relationships | semantic_dataset_metadata | documents | document_chunks │
│  investigations | investigation_tasks | investigation_events (seq cursor)        │
│  agent_runs | findings | hypotheses | evidence_items | critic_reviews | memories │
│                                                                                  │
│  pgvector enabled — NOT used (embeddings stored as JSON TF vectors)             │
│  Execution leases: execution_id, locked_by, lock_expires_at, heartbeat_at      │
└─────────────────────────────────────────────────────────────────────────────────┘

LLM Providers (via httpx):
  Groq (primary) → llama-3.3-70b-versatile
  OpenAI (fallback) → gpt-4o-mini
  Ollama (local) → llama3.2
  Keyword Fallback → deterministic templates
```

---

## 3. Agent-by-Agent Analysis

| Agent | Real LLM? | Uses Real Data? | Writes Real Results? | Status |
|---|---|---|---|---|
| **Planning Agent** | YES | YES (schema) | YES (task list) | Buggy (NameError) |
| **Data Analyst** | YES (code gen) | YES (reads file) | ❌ NO (hardcoded findings) | Partially Broken |
| **Hypothesis Agent** | YES | YES (reads findings) | Partial | Functional |
| **Hypothesis Tester** | NO | ❌ NO | ❌ NO (hardcoded stats) | Mock |
| **RAG Agent** | NO | YES (reads docs) | Partial (generic text) | Partial |
| **Critic Agent** | YES | ❌ NO (static context) | YES (CriticReview) | Functional/Synthetic |
| **Report Agent** | YES | YES (reads DB) | YES (but hardcoded fallback) | Functional |

### Detailed Agent Assessment

**Planning Agent**: LLM-driven planning works when a Groq/OpenAI key is configured. There's a NameError (schema_context_list vs schema_context) that falls through to the LLM fallback. The fallback templates are actually good — they produce realistic investigation plans for churn and revenue scenarios.

**Data Analyst**: The LLM code generation and subprocess execution are REAL and impressive engineering. The Python executor has an AST security scanner, timeout protection, and output parsing. BUT: after executing the code, the result is thrown away and 4 hardcoded findings are written to DB instead. This is the single biggest deception in the codebase.

**Hypothesis Tester**: Completely static. First hypothesis is always SUPPORTED with Welch t-test p=0.0006, Cohen's d=0.72. Second is always SUPPORTED with Chi-square p=0.0001. Rest are always REJECTED with p=0.418. These look real but are constants in the source code. The statistical_service.py has actual scipy-powered tests that are never called.

**RAG Agent**: A good skeleton. It correctly reads documents from the workspace. But the `or len(docs) > 0` condition makes every document match any query. The document content is never actually read or used — the evidence items say "Validated business policies aligned with Q3 market dynamics" regardless of document content.

**Report Agent**: The most honest agent. It reads real Finding, Hypothesis, and EvidenceItem rows from DB and passes them to the LLM. The LLM generates a real contextual report. But if the LLM output doesn't contain "Executive Summary", a 70-line hardcoded report with specific dollar figures replaces it. The confidence_score is always 0.92 regardless.

---

## 4. Data Flow Analysis

### What ACTUALLY happens when a user submits an investigation:

```
User enters objective: "Why did Q3 revenue decline?"
        ↓
API: Creates Investigation(status="QUEUED") in DB
     Triggers InvestigationWorker (asyncio task + BackgroundTask — DUAL trigger)
        ↓
Worker acquires execution lease (atomic DB UPDATE — SOLID)
        ↓
Planning Stage:
  - Reads workspace datasets from DB ✓
  - Tries to build schema_context from DatasetProfile... but variable name bug ✗
  - Falls to LLMService.generate_plan() — NameError caught by LLM fallback
  - LLM fallback returns a keyword-matched template plan ✓ (works)
  - Creates InvestigationTask rows for each agent ✓
        ↓
Data Analyst Stage:
  - Reads dataset file paths from DB ✓
  - Calls LLM to generate pandas analysis code ✓ (real LLM call)
  - Executes code via PythonExecutor subprocess ✓ (real execution)
  - DISCARDS execution result ✗
  - Writes 4 HARDCODED findings to DB ✗ (about Q2/Q3 revenue decline)
  - Writes 4 HARDCODED EvidenceItems to DB ✗
        ↓
Hypothesis Agent Stage:
  - Reads the 4 (hardcoded) findings from DB
  - Calls LLM.generate_hypotheses() with those findings ✓
  - If LLM returns <3 hypotheses, uses hardcoded enterprise/revenue templates ✗
  - Writes ~3 Hypothesis rows to DB (mix of real LLM + hardcoded)
        ↓
Hypothesis Tester Stage:
  - Reads hypotheses from DB ✓
  - NEVER calls statistical_service.py ✗
  - Assigns SUPPORTED/REJECTED by array index (0=SUPPORTED, 1=SUPPORTED, rest=REJECTED) ✗
  - Writes hardcoded statistical test results (p=0.0006, p=0.0001, p=0.418) ✗
  - Writes EvidenceItems with those fake stats ✗
        ↓
RAG Agent Stage:
  - Reads all Documents from workspace ✓
  - Uses trivial filename matching (always matches if docs exist) ✗
  - Does NOT call document_service.search_workspace_documents() ✗
  - Writes generic "Validated business policies" EvidenceItems ✗
        ↓
Critic Agent Stage (pipeline-level):
  - Calls LLM.critic_evaluate() with HARDCODED context strings ✗
  ("Verified 4 quantitative dataset findings" — not actual findings)
  - LLM generates critique based on phantom data ✗
  - Writes CriticReview(verdict="PASS") to DB
        ↓
Report Agent Stage:
  - Reads REAL Finding, Hypothesis, EvidenceItem rows from DB ✓
  - Calls LLM.generate_root_cause_report() with real content ✓
  - If LLM output lacks "Executive Summary": uses 70-line hardcoded report ✗
  - Writes investigation.summary = report ✓
  - Sets confidence_score = 0.92 (hardcoded) ✗
  - Sets root_causes = hardcoded 3-item snapshot ✗
        ↓
COMPLETED state (atomic UPDATE — SOLID)
        ↓
SSE events delivered to frontend from investigation_events table ✓
  (But EventSource fails with 401 in production — auth header gap)
        ↓
Frontend renders: report (LLM-generated), evidence ledger,
hypotheses scorecard, root causes panel ✓
```

### Summary of Real vs. Fake Data
| Data Point | Real or Fake? |
|---|---|
| Investigation objective | Real (user input) |
| Dataset schemas in plan | Real (from DatasetProfile) |
| Generated analysis code | Real (LLM-generated) |
| Code execution result | Real (but discarded) |
| Findings written to DB | FAKE (hardcoded strings) |
| Hypotheses titles | Mix (LLM + hardcoded templates) |
| Statistical test values | FAKE (hardcoded p-values) |
| Document evidence | Fake generic text |
| LLM executive report | Real (based on fake inputs) |
| Confidence score | FAKE (always 0.92) |
| Root causes snapshot | FAKE (hardcoded 3 items) |

---

## 5. Database Architecture

### Schema Overview

```
users (1) ←── workspace_members ───→ (M) workspaces
                                          |
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                       datasets       documents      investigations
                          |               |               |
                   dataset_profiles   document_chunks  ┌──┼──────────────────┐
                   dataset_rels       (TF embedding)   │  ▼                  │
                   semantic_meta                     inv_tasks          inv_events
                                                    (retry/lease)      (seq cursor)
                                                        |
                                           ┌────────────┤
                                           ▼            ▼
                                        findings    hypotheses
                                           |            |
                                    evidence_items  critic_reviews
                                    agent_runs
                                    memories
```

### Production Readiness Notes
- UUID string PKs — no integer sequences, no overflow risk
- All timestamps are timezone-aware (UTC)
- Soft deletes prevent accidental data loss
- Execution leases prevent duplicate worker execution
- investigation_events uses DB Identity sequence with manual MAX+1 fallback
- No Alembic — startup migrations via raw ALTER TABLE (fragile)
- pgvector enabled but not used for any real vector indexing

---

## 6. Production Deployment Analysis

### What Works in Production
| Feature | Production Status |
|---|---|
| Frontend serving | ✅ VERIFIED — Vercel static works |
| Auth (register/login) | ✅ VERIFIED — JWT on Neon |
| Workspace/Dataset CRUD | ✅ VERIFIED — REST API works |
| Dataset profiling | ⚠️ UNTESTED — BackgroundTask in serverless may not complete |
| Investigation creation | ✅ VERIFIED — DB write works |
| Investigation execution | ⚠️ UNTESTED — Cron trigger configured |
| SSE streaming | ❌ BROKEN — EventSource auth fails |
| File analysis | ❌ BROKEN — /tmp ephemeral, files lost |
| Analytics | ✅ LIKELY WORKS — pure DB queries |

### Critical Production Issues

**Issue 1: /tmp file storage** (BREAKING)
```python
# config.py line 57:
upload_dir: str = "/tmp/uploads" if (os.getenv("VERCEL") ...) else "uploads"
```
Files uploaded by user go to `/tmp/uploads`. Cron worker runs in a separate lambda invocation. `/tmp` is per-invocation ephemeral. Analysis code that tries to `pd.read_csv(file_path)` will fail with FileNotFoundError.

**Issue 2: SSE Authentication** (BREAKING)
```javascript
// api.js line 107:
getStreamUrl: (id, lastEventId) => `${BASE_URL}/api/v1/investigations/${id}/stream...`
```
No `?token=` param appended. Backend requires `Authorization: Bearer` header. Native `EventSource` can't set headers. All SSE connections return HTTP 401.

**Issue 3: Vercel 60s timeout**
Full investigation pipeline (multiple LLM calls at 45s each + code execution) can easily exceed 60s. If the cron invocation times out, the investigation lease remains locked until expiry (120s).

**Issue 4: Cron security**
`CRON_SECRET` is optional. Without it, anyone can hit `/api/v1/investigations/cron-worker` to trigger investigation execution on behalf of any pending investigation.

---

## 7. UI/UX Analysis

### Strengths
- Premium dark theme (slate/indigo palette) — genuinely impressive aesthetics
- Investigation lifecycle stepper with animated current stage
- Agent Reasoning Panel with live activity feed
- Evidence Ledger with source type categorization
- Hypothesis Scorecard with confidence indicators
- Root Cause Panel with ranked explanations and actions
- Markdown report rendering with proper formatting
- Skeleton loading states on all major views
- React Query cache with 3s polling during active investigations
- SSE deduplication via seenEventIdsRef Set
- Error boundaries on all routes

### Weaknesses / Issues
- **Demo data always visible**: Every investigation shows the same $330,300 revenue decline numbers regardless of what data was actually uploaded. Immediately suspicious to anyone who runs two investigations.
- **SSE connection shows "reconnecting" in production**: EventSource fails with 401, enters retry loop, flashes reconnecting indicator
- **Pause/Resume/Cancel/Replay buttons**: Frontend implements these fully but backend routes may not be fully implemented
- **Empty states**: Some pages lack proper empty state UX (e.g., first-time no-investigation view)
- **No investigation progress %**: No way to know how far along the 6-stage pipeline is
- **Agents page (/agents)**: Static informational page — no live agent status
- **Analytics page**: Shows real DB aggregations which is good, but charts may be empty for new users
- **Mobile responsiveness**: Mostly handled via Tailwind responsive classes but investigation detail is complex

---

## 8. Verified Issues

### 🔴 Critical (Production-Breaking or Core Value Compromised)

| # | Issue | File | Line | Impact |
|---|---|---|---|---|
| C1 | NameError: schema_context_list vs schema_context | worker.py | 270, 294 | Planning Agent NameError — falls back to templates |
| C2 | NameError: cols/dtypes undefined in data_analyst scope | worker.py | 746 | Schema context always empty for code generation |
| C3 | Hardcoded findings — execution result discarded | worker.py | 762-818 | All findings are fake Q2/Q3 revenue data |
| C4 | Hardcoded statistical tests — scipy never called | worker.py | 877-941 | All statistics are demo constants |
| C5 | SSE auth: EventSource cannot send JWT header | investigations.py, api.js | 378, 107 | SSE returns 401 in production |
| C6 | Ephemeral /tmp storage — files lost between invocations | config.py | 57 | Analysis code cannot read uploaded files on Vercel |
| C7 | Hardcoded confidence_score = 0.92 | worker.py | 681 | Every investigation always reports 92% confidence |

### 🟠 High Priority

| # | Issue | File | Impact |
|---|---|---|---|
| H1 | Dual worker trigger (asyncio + BackgroundTask) | investigations.py:173-174 | Redundant tasks, potential race |
| H2 | RAG agent doesn't call search_workspace_documents() | worker.py:946-1003 | Document content never read |
| H3 | Hardcoded fallback report in Report Agent | worker.py:517-596 | Wrong report shown when LLM fails |
| H4 | Critic Agent uses static context strings | worker.py:1010-1011 | Critique is not investigation-specific |
| H5 | statistical_service.py never wired to agents | worker.py | Real scipy tests unused |
| H6 | investigation_service.py 979-line orphan | investigation_service.py | Dead code creates confusion |
| H7 | Hardcoded root_causes snapshot on completion | worker.py:605-638 | Root causes don't reflect actual data |

### 🟡 Medium Priority

| # | Issue | Impact |
|---|---|---|
| M1 | No SSE token in query param | Live updates broken in production |
| M2 | No rate limiting on auth endpoints | Brute force vulnerability |
| M3 | is_verified field never set | Email verification UI unusable |
| M4 | DatasetRelationship/SemanticDatasetMetadata not in models/__init__.py | Table creation may fail |
| M5 | No data validation on objective text | XSS/injection risk |
| M6 | CRON_SECRET optional | Public cron trigger exposure |
| M7 | PythonExecutor no memory/CPU limits | Resource exhaustion possible |

---

## 9. Production Readiness Score: 4/10

| Dimension | Score | Rationale |
|---|---|---|
| Infrastructure & Architecture | 8/10 | Solid — durable leases, SSE cursor, retry, atomic state, NullPool |
| Data Intelligence (Core Value) | 1/10 | Agent outputs are hardcoded demo data |
| Authentication & Security | 6/10 | JWT/bcrypt solid; no rate limiting, SSE auth gap |
| Frontend UX | 7/10 | Premium design, good error states; shows fake data |
| Production Deployment | 4/10 | Cron works, but files ephemeral and SSE broken |
| Code Quality | 5/10 | Good patterns, but hardcoded data, dead code, NameErrors |
| Observability | 3/10 | Basic logging, debug endpoint, no metrics/tracing |
| Testing | 2/10 | QA scripts exist but don't test agent output accuracy |
| **OVERALL** | **4/10** | **Infrastructure impressive, intelligence fake** |

---

## 10. Top 10 Improvements for Resume & Interviews

These are ranked by impact on authenticity, impressiveness, and interview-worthiness:

---

### #1 — Wire Real Data Through the Entire Agent Pipeline ⭐⭐⭐⭐⭐
**Fix the core deception**: Replace all 4 hardcoded findings in the Data Analyst with actual analysis of the user's data. Use the code execution result (`res`) that's already being computed and discarded.

**Interview impact**: "I implemented an agent that actually executes LLM-generated pandas code on real user data and uses the results to drive downstream hypothesis generation." This becomes a real claim.

Implementation: Parse `res["output"]` from PythonExecutor. Use the real metrics to generate findings via LLM summarization instead of hardcoded strings.

---

### #2 — Connect statistical_service.py to Hypothesis Tester ⭐⭐⭐⭐⭐
**Replace mock statistics with real scipy tests**: The `statistical_service.py` has real Welch t-test, Mann-Whitney U, Chi-square, and correlation analysis. Wire it to the Hypothesis Tester instead of the hardcoded constants.

**Interview impact**: "I implemented statistically rigorous hypothesis testing using Welch's t-test for revenue cohort comparisons with real Cohen's d effect size computation." This is a real data science claim that few portfolio projects make.

---

### #3 — Fix SSE Authentication ⭐⭐⭐⭐
**Add token to stream URL**: Modify `getStreamUrl()` to append `?token=<jwt>` and update the backend to accept token from query param.

**Interview impact**: This fixes live updates in production — the biggest visible UX failure.

---

### #4 — Use Real RAG for Document Retrieval ⭐⭐⭐⭐
**Connect search_workspace_documents() to RAG agent**: Replace filename matching with actual TF cosine similarity search. Pass the top-3 matching document chunks' content (not just titles) to the evidence items and to the LLM.

**Interview impact**: "I built a document RAG system with chunking, TF-IDF vectorization, and cosine similarity retrieval that informs agent decision-making." Currently it's a skeleton — make it real.

---

### #5 — Fix the NameErrors in worker.py ⭐⭐⭐
Fix C1 (`schema_context_list` → `schema_context`) and C2 (`cols`/`dtypes` undefined). These are simple bugs that cause the planning and data analyst stages to silently fall back to templates.

**Interview impact**: These indicate the code was never run end-to-end with real data — a red flag in code review.

---

### #6 — Add Persistent File Storage (S3/Cloudflare R2) ⭐⭐⭐⭐
Replace `/tmp` ephemeral storage with S3-compatible storage (AWS S3, Cloudflare R2, or Supabase Storage). Files uploaded in one serverless invocation need to be accessible in the cron worker invocation.

**Interview impact**: Demonstrates understanding of serverless architecture constraints. "I migrated from ephemeral /tmp to object storage to support cross-invocation file access in our serverless deployment."

---

### #7 — Compute Dynamic Confidence Scores ⭐⭐⭐
Replace hardcoded `confidence_score = 0.92` with actual computation based on: average evidence confidence, hypothesis support ratio, statistical effect sizes, critic verdict. Write a `compute_confidence_score(findings, hypotheses, evidence, critic_review)` function.

**Interview impact**: "The system computes a calibrated confidence score from evidence quality, statistical rigor (effect sizes), and critic audit verdict rather than using a fixed value."

---

### #8 — Add Alembic Migrations ⭐⭐⭐
Replace the startup ALTER TABLE approach with proper Alembic. Set up `alembic init`, generate initial migration from current models, and document the workflow.

**Interview impact**: "I migrated from ad-hoc startup ALTER TABLE scripts to Alembic-managed schema migrations." Basic software engineering hygiene that interviewers check.

---

### #9 — Implement Real-Time Progress Tracking ⭐⭐⭐
Add a progress percentage computed from completed tasks vs total tasks. Emit a `progress` SSE event type. Display a progress bar on the investigation detail page.

**Interview impact**: Shows end-to-end thinking about user experience during long-running async operations.

---

### #10 — Add Observability (Sentry + Structured Logs) ⭐⭐⭐
Integrate Sentry for error tracking (free tier). Add correlation IDs to all log lines. Add a timing decorator to agent methods. Create a simple metrics endpoint.

**Interview impact**: "I added distributed tracing and structured logging to the investigation pipeline so we can diagnose failures across serverless invocations." Shows production thinking.

---

## How to Present This on a Resume

**With current state**: "Built a multi-agent AI investigation platform with FastAPI, React, PostgreSQL, and LLM integration (Groq). Features include durable execution leases, cursor-based SSE streaming, and an autonomous agent pipeline."

**After implementing improvements #1-5**: "Built an autonomous data investigation platform where LLM-generated pandas code analyzes user-uploaded CSV files, produces statistically rigorous findings via Welch's t-test and Chi-square testing, and synthesizes evidence into executive reports. Architected with durable execution leases, cursor-based SSE event streaming, and a multi-agent pipeline on Vercel serverless + Neon PostgreSQL."

The second version is defensible in an interview. The first version would fail under scrutiny.
