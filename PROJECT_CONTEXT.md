# DataPilot AI — Project Context

> **Last Updated:** 2026-08-28 | **Version:** Deep Audit v1.0  
> This document is the authoritative technical context for all future development tasks.  
> Source of truth: actual source code (not documentation or comments).

---

## 1. Project Purpose

DataPilot AI is an **autonomous multi-agent data investigation platform**. It allows business users to:

1. Upload structured datasets (CSV, XLSX, JSON) and documents (PDF, DOCX, TXT, MD).
2. Ask a natural-language business question (e.g., *"Why did Q3 revenue drop 26%?"*).
3. Watch an autonomous pipeline of AI agents analyze the data, generate and test hypotheses, retrieve context from documents, audit findings, and synthesize an executive root-cause report — all with live SSE streaming updates.

**Primary user workflow:**
- Register → Create Workspace → Upload Dataset(s) → Create Investigation → Watch live agent activity → Read executive report.

---

## 2. Complete Architecture

```
FRONTEND (React/Vite)
Vercel Static Hosting | TailwindCSS + Zustand + React Query
Axios (REST API) | EventSource (SSE) | React Router DOM v7

BACKEND (FastAPI / Python 3.11+)
Vercel Python Serverless | Async SQLAlchemy + asyncpg
JWT Auth (HS256) | bcrypt passwords | Background Workers
InvestigationWorker | LLMService | PythonExecutor

PostgreSQL (Neon) | LLM Providers
pgvector extension   | 1. Groq (primary)
13 database tables   | 2. OpenAI (fallback)
SSE event seq store  | 3. Ollama (local)
Durable exec leases  | 4. Keyword Fallback
```

### Background Execution Architecture

| Environment | Worker Mechanism |
|---|---|
| **Local Development** | asyncio.create_task(run_worker_loop(poll_interval=3.0)) launched at FastAPI startup |
| **Vercel (Production)** | Vercel Cron job hits /api/v1/investigations/cron-worker every minute |

> CRITICAL: On Vercel, uploads are stored in /tmp/ which is ephemeral and does NOT persist between serverless invocations. Files uploaded in one request are unavailable to the cron worker executing the investigation.

---

## 3. Technology Stack

### Backend
- Python 3.11+, FastAPI >= 0.111, Uvicorn
- SQLAlchemy 2.0 (async), asyncpg, aiosqlite (fallback)
- Pydantic 2.7+, pydantic-settings
- JWT: python-jose, bcrypt
- HTTP client: httpx (for LLM calls)
- Data analysis: pandas >= 2.2, numpy >= 1.26, openpyxl
- Statistical tests: scipy (optional — falls back to custom math)
- File processing: aiofiles, pypdf (optional), python-docx (optional)
- Database: PostgreSQL 16 with pgvector (local Docker), Neon (production)

### Frontend
- React 19, React Router DOM 7, React Query v5
- Vite 8, TailwindCSS 4, PostCSS
- State: Zustand v5 (auth, workspace)
- Forms: react-hook-form 7
- UI: lucide-react, framer-motion, recharts, clsx
- HTTP: Axios

### Infrastructure
- Frontend hosting: Vercel static (via @vercel/static-build)
- Backend hosting: Vercel Python serverless (@vercel/python)
- Database: Neon PostgreSQL (serverless Postgres)
- Local dev: Docker Compose (postgres:pgvector, redis, backend, frontend)
- Cron: Vercel Cron (1-minute interval)

---

## 4. Frontend Architecture

### Routing (App.jsx)
```
/                    -> Landing page
/login               -> Login
/register            -> Register
[AppLayout wrapper]
  /dashboard         -> Dashboard
  /investigations    -> Investigations list
  /investigations/new -> New investigation form
  /investigations/:id -> Investigation detail (SSE live, report, evidence)
  /datasets          -> Dataset list + upload
  /datasets/:id      -> Dataset detail + column profiler
  /knowledge         -> Document upload + knowledge base
  /agents            -> Agent catalog/info page
  /analytics         -> Workspace analytics
  /memory            -> Business memory rules
  /settings          -> User settings
```

### State Management
- Zustand: authStore.js (JWT token, user object), workspaceStore.js (active workspace)
- React Query: server state for all API data (investigations, datasets, documents, memories)
- Local component state: SSE stream state in InvestigationDetail.jsx

### API Client (services/api.js)
- Single Axios instance with JWT interceptor
- Base URL: VITE_API_URL env -> auto-detect production -> http://localhost:8000
- SSE streaming: uses native EventSource (not Axios) with getStreamUrl() helper
- Token storage: localStorage.datapilot_token OR localStorage.datapilot_auth (Zustand persisted)

### Key Frontend Components
| Component | Description |
|---|---|
| InvestigationDetail.jsx | Most complex — SSE, polling, tab navigation, report rendering |
| AgentReasoningPanel.jsx | Live agent activity feed from SSE |
| EvidenceLedger.jsx | Evidence items with source type badges |
| HypothesisScorecard.jsx | Hypothesis status cards with confidence |
| RootCausePanel.jsx | Root cause ranking + recommended actions |
| AppLayout.jsx | Sidebar navigation wrapper |

---

## 5. Backend Architecture

### Main Application (app/main.py)
- FastAPI lifespan: creates upload dirs, enables pgvector, creates/migrates tables, launches worker (local only)
- Schema migration strategy: raw SQL ALTER TABLE ADD COLUMN IF NOT EXISTS run at every startup (not Alembic)
- CORS: allows all methods from configured origins + *.vercel.app wildcard
- Global exception handlers for HTTP, validation, and generic errors
- Routes prefixed under /api/v1

### API Routes
| Route File | Prefix | Key Endpoints |
|---|---|---|
| auth.py | /api/v1/auth | POST /register, POST /login, GET /me |
| workspaces.py | /api/v1/workspaces | CRUD workspaces, members |
| datasets.py | /api/v1/datasets | POST /upload, GET list/detail/profile/preview/query/relationships/semantic |
| investigations.py | /api/v1/investigations | POST create, GET list/detail/debug, GET /{id}/stream (SSE), POST cron-worker |
| documents.py | /api/v1/documents | POST /upload, GET list/detail/search |
| memories.py | /api/v1/memories | CRUD business memory rules |
| analytics.py | /api/v1/analytics | GET summary, GET agents-activity |

### Authentication
- JWT HS256 tokens (7-day expiry)
- get_current_user dependency in api/dependencies.py
- bcrypt password hashing
- No refresh tokens — relogin required after 7 days
- Issue: No email verification, no rate limiting on login

---

## 6. Database Schema

### Tables and Models

| Table | Primary Key | Key Fields | Notes |
|---|---|---|---|
| users | UUID string | email (unique), hashed_password, is_active, is_verified | is_verified never set to True in code |
| workspaces | UUID string | name, slug (unique), owner_id, is_deleted | Auto-created on register |
| workspace_members | UUID string | workspace_id, user_id, role (OWNER/ADMIN/MEMBER/VIEWER) | |
| datasets | UUID string | workspace_id, file_path, status (UPLOADING/UPLOADED/PROFILING/PROFILED/ERROR), is_deleted | status PROFILING never used |
| dataset_profiles | UUID string | dataset_id (unique), schema_info JSON, column_profiles JSON, quality_report JSON, sample_rows JSON | |
| dataset_relationships | UUID string | source_dataset_id, target_dataset_id, relationship_type | Auto-discovered |
| semantic_dataset_metadata | UUID string | dataset_id (unique), business_description, entities, dimensions, metrics | |
| documents | UUID string | workspace_id, file_path, chunk_count, status (UPLOADED/PROCESSING/INDEXED/ERROR), is_deleted | |
| document_chunks | UUID string | document_id, chunk_index, content, token_count, embedding JSON | Embedding stored as TF vector key-value pairs (NOT pgvector) |
| investigations | UUID string | workspace_id, objective, status, plan JSON, evidence_ledger JSON, root_causes JSON, confidence_breakdown JSON, execution_id, locked_by, lock_expires_at, heartbeat_at | |
| investigation_tasks | UUID string | investigation_id, agent, status, result JSON, retry_count, max_retries, next_retry_at | |
| investigation_events | UUID string (id) + BigInt (seq) | investigation_id, agent, event_type, message, details JSON | Manual max+1 seq to avoid race |
| agent_runs | UUID string | investigation_id, task_id, agent, tool_calls JSON, output_summary | Rarely populated |
| findings | UUID string | investigation_id, statement, confidence, causal_classification, source, evidence JSON | |
| hypotheses | UUID string | investigation_id, title, status (PROPOSED/TESTING/SUPPORTED/PARTIALLY_SUPPORTED/REJECTED/INSUFFICIENT_EVIDENCE), confidence, statistical_results JSON | |
| evidence_items | UUID string | investigation_id, claim, source_type (dataset/statistical/document/calculation), source_name, statistical_metrics JSON, document_citation JSON | |
| critic_reviews | UUID string | investigation_id, round_number, verdict (PASS/REINVESTIGATE/REQUEST_MORE_EVIDENCE/DOWNGRADE_CONFIDENCE), critique_notes | |
| memories | UUID string | workspace_id, user_id, category (PROFILE/PREFERENCE/INTEREST/GOAL/WORK_CONTEXT), content | |

### Key Database Characteristics
- All primary keys are UUID strings (not integers)
- Soft deletes via is_deleted flag (datasets, workspaces, documents, investigations)
- investigation_events.seq uses Identity(always=False, start=1000) — race condition workaround uses manual MAX(seq)+1
- Execution lease locking: execution_id, locked_by, lock_expires_at on investigations
- Migration: raw SQL ALTER TABLE on every startup (fragile, no Alembic)

---

## 7. Agent Architecture

### Planning Agent
- Source: worker.py lines 240-336, llm_service.py generate_plan()
- Input: Investigation objective + dataset schemas from DatasetProfile
- Output: JSON plan with ordered task list
- LLM usage: YES — calls llm.generate_plan()
- DB reads: Dataset (PROFILED, not deleted), DatasetProfile
- DB writes: investigation.plan, creates InvestigationTask rows
- BUG: Variable name mismatch — builds schema_context_list (line 270) but passes schema_context (undefined) at line 294. NameError caught by LLMService fallback.
- Status: FUNCTIONAL WITH BUG

### Data Analyst Agent
- Source: worker.py lines 729-818, llm_service.py generate_code()
- Input: Investigation objective + real dataset file paths + schema
- Output: Python analysis code + execution result + hardcoded findings/evidence
- LLM usage: YES — calls llm.generate_code()
- Code execution: PythonExecutor.execute_code() — subprocess sandbox, 10s timeout
- DB reads: Dataset (PROFILED), DatasetProfile
- DB writes: Finding (4 hardcoded), EvidenceItem (4 hardcoded)
- BUG (line 746): References cols and dtypes variables never defined in data_analyst scope.
- DATA FIDELITY ISSUE: Even when code executes successfully, the 4 findings written to DB are 100% hardcoded Q2/Q3 revenue numbers. Actual code execution result is completely discarded.
- Status: PARTIALLY BROKEN — LLM code generation works, findings are demo data

### Hypothesis Agent
- Source: worker.py lines 821-868, llm_service.py generate_hypotheses()
- Input: Previous Finding rows from DB + investigation objective
- Output: 3 hypotheses written to Hypothesis table
- LLM usage: YES — calls llm.generate_hypotheses()
- DB reads: Finding (for this investigation)
- DB writes: Hypothesis rows (3 created)
- Fallback: If LLM returns < 3 hypotheses, uses hardcoded revenue/enterprise scenario
- Status: FUNCTIONAL but findings context may be hardcoded data

### Hypothesis Tester Agent
- Source: worker.py lines 871-943
- Input: All Hypothesis rows for investigation
- Output: Updated hypothesis status/confidence, EvidenceItem rows per hypothesis
- LLM usage: NO — purely position-based: idx=0 SUPPORTED, idx=1 SUPPORTED, rest REJECTED
- DB reads: Hypothesis (for this investigation)
- DB writes: Updates Hypothesis.status/confidence/statistical_results, creates EvidenceItem rows
- COMPLETELY HARDCODED: Statistical test results are hardcoded constants. Always: Welch t-test p=0.0006, Cohen's d=0.72; Chi-Square p=0.0001, Cramer's V=0.38; t-test p=0.418 for rejection. NO actual statistical computation performed.
- Status: MOCK IMPLEMENTATION

### RAG Agent
- Source: worker.py lines 946-1003
- Input: All Document records in workspace
- Output: EvidenceItem rows for matched documents
- LLM usage: NO
- "RAG" implementation: Iterates documents; matching condition is always true when docs exist (due to `or len(docs) > 0`). Returns ALL documents regardless of relevance.
- Vector search: NOT used. document_service.search_workspace_documents() exists but isn't called by RAG agent.
- DB reads: Document (not deleted, in workspace)
- DB writes: EvidenceItem rows (up to 2)
- Status: PARTIALLY IMPLEMENTED — documents read but retrieval is not semantic

### Critic Agent
- Source: worker.py lines 1005-1034 (task-level) + lines 426-465 (pipeline-level)
- Input: Hardcoded context strings (not actual findings from DB)
- Output: CriticReview row + inv.critic_reviews JSON
- LLM usage: YES — calls llm.critic_evaluate() with static context strings
- DATA FIDELITY ISSUE: Context passed to LLM is hardcoded "Verified 4 quantitative dataset findings", not actual content of DB findings.
- Status: FUNCTIONAL but with synthetic context — runs TWICE (once as task, once at pipeline level)

### Report Agent
- Source: worker.py lines 467-703, llm_service.py generate_root_cause_report()
- Input: All Finding, Hypothesis, EvidenceItem from DB (REAL data used here)
- Output: Markdown report string stored in investigation.summary
- LLM usage: YES — calls llm.generate_root_cause_report() with actual DB content
- Fallback: If LLM output doesn't contain "Executive Summary", overwrites with 70-line hardcoded report (lines 517-596) with specific revenue figures for hypothetical scenario
- DB reads: Finding, Hypothesis, EvidenceItem (real data from DB)
- DB writes: Atomic UPDATE setting status=COMPLETED, summary, confidence_score=0.92, root_causes (hardcoded snapshot), confidence_breakdown (hardcoded), evidence_ledger
- HARDCODED: confidence_score always 0.92, root_causes always same 3 items
- Status: FUNCTIONAL but relies heavily on hardcoded fallbacks

---

## 8. Investigation Workflow (Real State Machine)

```
QUEUED (created by API, status="QUEUED")
  |
  v (worker acquires lease)
PLANNING (Planning Agent: objective + schemas -> task list)
  |
  v (plan stored, tasks created)
ANALYZING (Data Analyst task: LLM code gen + execution)
  |
  v
TESTING (Hypothesis Agent + Hypothesis Tester tasks)
  |
  v
RETRIEVING (RAG Agent task) [varies by plan]
  |
  v (pipeline-level, always runs)
VERIFYING (Critic Agent: audit evidence)
  |
  v
REPORTING (Report Agent: synthesize markdown report)
  |
  v (atomic UPDATE)
COMPLETED

FAILED (any stage — terminal, no retry of investigation)
CANCELLED (via API — terminal)
PAUSED / REINVESTIGATING (statuses in model, not implemented in worker)
```

Valid states: PENDING, PLANNING, ANALYZING, TESTING, RETRIEVING, VERIFYING, REPORTING, REINVESTIGATING, COMPLETED, FAILED, PAUSED, CANCELLED

---

## 9. Background Execution Architecture

### Local Development
- asyncio.create_task(run_worker_loop(poll_interval=3.0)) at startup
- Polls DB every 3s for PENDING/stale RUNNING investigations
- VERIFIED FROM CODE — works correctly locally

### Production (Vercel)
- Cron fires every minute -> /cron-worker endpoint -> InvestigationWorker -> up to 5 investigations
- Critical constraints:
  1. Vercel free tier: 60s execution timeout. Full pipeline may exceed this.
  2. File uploads to /tmp/ — ephemeral. Cron worker cannot access files from previous request.
  3. No Redis — in-memory subscribers don't work in serverless.
  4. CRON_SECRET is optional — endpoint is publicly accessible without it.

---

## 10. Real-Time Event Architecture (SSE)

### Event Generation
- InvestigationWorker.record_event() writes to investigation_events table
- Sequence: manual MAX(seq)+1 to avoid PostgreSQL Identity generator conflicts
- Each event: id (evt_hex12), seq (monotonic int), investigation_id, agent, event_type, message, details JSON

### SSE Stream Endpoint
```
GET /api/v1/investigations/{id}/stream?last_event_id={seq}
```
- Cursor-based: queries WHERE seq > cursor every 1.5 seconds
- Closes stream when status is COMPLETED/FAILED/CANCELLED and no new events
- Sends id: {seq} in SSE format for Last-Event-ID reconnection

### Frontend SSE (InvestigationDetail.jsx)
- Opens EventSource when investigation is running
- Deduplication: seenEventIdsRef Set prevents duplicate events
- Cursor tracking: lastEventIdRef for reconnection
- Polls REST API every 3 seconds in parallel for full state sync
- Closes EventSource when terminal status detected

### Known SSE Issues
- EventSource cannot send custom headers — JWT auth fails in production
- getStreamUrl() builds URL without auth token — stream returns 401
- Old investigation_service.py has unused in-memory broadcast system

---

## 11. RAG Architecture

### Document Ingestion
1. Upload -> document_service.save_document_file() -> saved to disk
2. Background task -> process_document_background() -> extract text -> chunk (500 chars, 60 overlap) -> TF-IDF vector
3. DocumentChunk.embedding stores TF term-frequency as [(word, weight)] list (JSON)
4. Status: UPLOADED -> PROCESSING -> INDEXED

### Vector Search (FUNCTIONAL but unused by agents)
- document_service.search_workspace_documents() implements cosine similarity over TF vectors
- Called by /documents/search API endpoint only
- NOT called by RAG agent in investigation pipeline

### pgvector
- Extension enabled at startup but NOT used
- Embeddings are in JSON columns, not pgvector vector columns
- The setup is aspirational

---

## 12. LLM Architecture

### Provider Chain (priority order)
1. Groq — if GROQ_API_KEY set. Model: llama-3.3-70b-versatile. 45s timeout.
2. OpenAI — if OPENAI_API_KEY set. Model: gpt-4o-mini. 30s timeout.
3. Ollama — local, http://localhost:11434. Model: llama3.2. 15s timeout.
4. Keyword Fallback — deterministic templates based on objective keywords (churn, revenue).

### LLM Methods
| Method | Format | Fallback |
|---|---|---|
| generate_plan() | JSON | _generate_fallback_response()["planner_plan"] |
| generate_code() | Python code | _generate_fallback_response()["analyst_code"] |
| generate_hypotheses() | JSON list | _generate_fallback_response()["hypotheses"] |
| critic_evaluate() | JSON | Static PASS verdict |
| generate_root_cause_report() | Markdown | Hardcoded report (in worker.py) |

### JSON Parsing
- All JSON responses use json.loads() with try/except fallback
- Code responses: strips ```python``` fences

---

## 13. API Architecture

### All Key Endpoints
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/workspaces
POST   /api/v1/workspaces
PATCH  /api/v1/workspaces/{id}

POST   /api/v1/datasets/upload?workspace_id=
GET    /api/v1/datasets?workspace_id=
GET    /api/v1/datasets/{id}/profile
GET    /api/v1/datasets/{id}/preview
POST   /api/v1/datasets/{id}/query
GET    /api/v1/datasets/relationships?workspace_id=

POST   /api/v1/investigations?workspace_id=
GET    /api/v1/investigations/{id}
GET    /api/v1/investigations/{id}/stream  <- SSE
GET    /api/v1/investigations/{id}/debug
POST   /api/v1/investigations/cron-worker  <- Vercel Cron trigger

POST   /api/v1/documents/upload?workspace_id=
POST   /api/v1/documents/search?workspace_id=

GET    /api/v1/memories?workspace_id=
POST   /api/v1/memories?workspace_id=

GET    /api/v1/analytics/summary?workspace_id=

GET    /health
GET    /api/v1/system/sync-schema
```

---

## 14. Deployment Architecture

### Frontend (Vercel)
- URL: https://datapilot-final-pearl.vercel.app
- Build: vite build -> /frontend/dist/ -> Vercel static
- Config: frontend/vercel.json -> SPA fallback to index.html
- Env: VITE_API_URL set in Vercel dashboard

### Backend (Vercel Serverless)
- URL: https://datapilot-backend-five.vercel.app (hardcoded in api.js)
- Entry: api/index.py -> imports from backend/app/main.py
- Config: Root vercel.json routes /api/* to Python lambda
- Env variables needed: DATABASE_URL, SECRET_KEY, GROQ_API_KEY, CRON_SECRET

### Database (Neon PostgreSQL)
- NullPool used in serverless to avoid persistent connections
- statement_cache_size=0 for asyncpg Neon compatibility
- Connection string: must be postgresql+asyncpg:// format (auto-converted)

### Cron (Vercel Cron)
- Schedule: every minute (* * * * *)
- URL: /api/v1/investigations/cron-worker
- Optional auth via CRON_SECRET

---

## 15. Known Issues (All Verified from Code)

### CRITICAL

1. NameError in Planning Agent (worker.py:294): schema_context_list defined at line 270, but schema_context (undefined) passed to llm.generate_plan(). Always falls back to LLM template.

2. NameError in Data Analyst Agent (worker.py:746): cols and dtypes variables referenced but not defined in data_analyst scope.

3. Hardcoded findings (worker.py:762-790): All 4 findings written to DB are template strings about hypothetical Q2/Q3 revenue. Actual code execution result is discarded.

4. Hardcoded statistical tests (worker.py:877-941): Hypothesis Tester returns static p-values. Always: first=SUPPORTED p=0.0006, second=SUPPORTED p=0.0001, rest=REJECTED p=0.418.

5. SSE authentication broken: /stream endpoint requires Authorization header. Native EventSource cannot set custom headers. getStreamUrl() doesn't include token. Stream returns 401 in production.

6. Ephemeral /tmp storage on Vercel: Uploaded files go to /tmp/uploads/. Cron worker lambda cannot access files from different lambda invocation.

7. Hardcoded confidence score: confidence_score always set to 0.92 (worker.py:681).

### HIGH PRIORITY

8. Duplicate worker execution: Both ensure_worker_running() (asyncio task) and background_tasks.add_task() called on investigation create.

9. RAG agent doesn't use vector search: search_workspace_documents() exists but never called by RAG agent. Uses filename matching only.

10. investigation_service.py (979 lines) partially orphaned: Full old agent pipeline unused in current flow. Creates confusion.

11. Report Agent hardcoded fallback (worker.py:517-596): If LLM output lacks "Executive Summary", 70-line hardcoded report with specific revenue numbers is used regardless of actual data.

12. statistical_service.py never wired to agents: Real Welch t-test, Mann-Whitney, Chi-square implementations exist but Hypothesis Tester doesn't call them.

### MEDIUM PRIORITY

13. No token in SSE URL — stream endpoint unreachable in production.

14. Missing route implementations: pause, resume, cancel, replay called from frontend but may not be fully implemented.

15. No rate limiting on login, register, or investigation creation.

16. is_verified never set to True — email verification flow doesn't exist.

17. Redis referenced but not used — in-memory queue fails in serverless.

18. DatasetRelationship and SemanticDatasetMetadata not in models/__init__.py import.

---

## 16. Technical Debt

1. Dual investigation pipeline: worker.py and investigation_service.py both implement agent pipelines.
2. No Alembic migrations: Schema changes via raw SQL on startup.
3. Hardcoded demo data throughout worker.py: Core value proposition (real data analysis) undermined.
4. pgvector installed but not used: Document embeddings are TF vectors in JSON, not pgvector columns.
5. No structured logging/observability: No trace IDs, no Sentry, no metrics.
6. statistical_service.py not connected to agent pipeline.
7. investigation_service.py in-memory subscriber system doesn't work serverless.
8. Confidence score always 0.92.
9. No data validation on investigation objective.
10. Frontend SSE auth gap: Critical path (live updates) has no authentication.

---

## 17. Production Readiness Status

| Subsystem | Status | Notes |
|---|---|---|
| User auth (register/login/JWT) | Production-ready | bcrypt + HS256, 7-day tokens |
| Workspace management | Production-ready | CRUD, soft delete, members |
| Dataset upload | Functional (local) | /tmp ephemeral issue on Vercel |
| Dataset profiling | Production-ready | Real pandas analysis, column stats |
| Document upload + chunking | Production-ready | Text extraction, TF embedding |
| Document search API | Functional | TF cosine similarity works |
| Business memory | Production-ready | CRUD memory rules |
| Investigation creation | Production-ready | DB write + worker trigger |
| Planning Agent | Functional but buggy | NameError caught by fallback |
| Data Analyst Agent | MOCK/DEMO | Code executes but findings hardcoded |
| Hypothesis Agent | Functional | LLM-driven, fallback templates |
| Hypothesis Tester | MOCK/DEMO | 100% hardcoded statistics |
| RAG Agent | Partially implemented | Document read, no real vector search |
| Critic Agent | Functional but synthetic | LLM critique on static context |
| Report Agent | Functional but risky fallback | LLM + 70-line hardcoded fallback |
| SSE streaming | BROKEN in production | No auth token in EventSource URL |
| Production file storage | BROKEN | /tmp ephemeral on Vercel |
| Background execution (local) | Production-ready | asyncio worker loop |
| Background execution (Vercel) | Untested | Cron configured, 60s timeout risk |
| Statistical service | Production-ready (unused) | statistical_service.py is real but not wired |
| pgvector integration | Not implemented | Enabled but not used |
| Analytics API | Functional | Real DB aggregations |
| Database migrations | Fragile | Raw SQL ALTER TABLE on startup |
| Frontend UI | Functional | Rich design, good UX |
| Docker Compose (local) | Production-ready | Full stack |
| Vercel deployment | Partially working | File storage and SSE auth broken |

---

## 18. Files to Know Well

| File | Importance | Notes |
|---|---|---|
| backend/app/worker.py | CRITICAL | Entire agent pipeline — 1080 lines |
| backend/app/services/llm_service.py | CRITICAL | LLM integration + keyword fallbacks |
| backend/app/api/routes/investigations.py | CRITICAL | SSE stream, cron endpoint, create |
| backend/app/main.py | HIGH | Startup, migrations, worker launch |
| frontend/src/pages/investigations/InvestigationDetail.jsx | HIGH | SSE + polling + full investigation UI |
| backend/app/services/statistical_service.py | MEDIUM | Real stats — needs wiring to agents |
| backend/app/services/document_service.py | MEDIUM | RAG chunking + TF search |
| backend/app/services/profiling_service.py | MEDIUM | Dataset profiling — real pandas |
| backend/app/db/models/investigation.py | MEDIUM | All investigation-related models |
| frontend/src/services/api.js | MEDIUM | All API calls from frontend |
