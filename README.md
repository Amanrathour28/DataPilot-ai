# DataPilot AI

**An Autonomous Multi-Agent Data Investigation & Evidence Platform**

DataPilot AI empowers organizations to upload structured business data (`CSV`, `Excel`, `JSON`) and unstructured contextual documents (`PDF`, `DOCX`, `TXT`, `MD`), then ask open-ended, complex business questions. Specialized autonomous AI agents formulate analytical agendas, write and execute safe data queries, conduct deterministic statistical tests with p-values and effect sizes, ground findings against domain knowledge via RAG vector search, log every fact in an **Evidence Ledger**, pass strict Critic audits, and produce calibrated, evidence-backed root-cause reports.

---

## 🏛️ System Architecture

```text
                             ┌──────────────────────────────────────┐
                             │       User Business Question         │
                             └──────────────────┬───────────────────┘
                                                ▼
                             ┌──────────────────────────────────────┐
                             │           Supervisor Agent           │
                             │  (Manages State & Execution Graph)   │
                             └──────────────────┬───────────────────┘
                                                ▼
                             ┌──────────────────────────────────────┐
                             │       Investigation Planner          │
                             │  (Deconstructs question, maps schema,│
                             │   generates ordered step agenda)     │
                             └──────────────────┬───────────────────┘
                                                ▼
     ┌──────────────────────────────────────────┴──────────────────────────────────────────┐
     ▼                                          ▼                                          ▼
┌─────────────────────────┐        ┌─────────────────────────┐        ┌─────────────────────────┐
│   Data Analyst Agent    │        │  Hypothesis Generator   │        │   Knowledge / RAG       │
│ (DuckDB / Pandas Safe   │        │ (Proposes testable      │        │ (pgvector semantic doc  │
│  execution with AST/    │        │  causal explanations &  │        │  retrieval with chunk   │
│  timeout sandbox)       │        │  variables)             │        │  citations)             │
└────────────┬────────────┘        └────────────┬────────────┘        └────────────┬────────────┘
             │                                  │                                  │
             └──────────────────────────────────┼──────────────────────────────────┘
                                                ▼
                             ┌──────────────────────────────────────┐
                             │      Statistical Testing Engine      │
                             │  (Deterministic SciPy / Stats:       │
                             │   t-test, chi2, mann-whitney,        │
                             │   effect size, correlation, CI)      │
                             └──────────────────┬───────────────────┘
                                                ▼
                             ┌──────────────────────────────────────┐
                             │           Evidence Ledger            │
                             │  (Aggregates claims, dataset proof,  │
                             │   p-values, document excerpts,       │
                             │   detects contradictions)            │
                             └──────────────────┬───────────────────┘
                                                ▼
                             ┌──────────────────────────────────────┐
                             │         Root Cause Analyzer          │
                             │  (Ranks: Primary, Contributing,      │
                             │   Correlated, Rejected, Insufficient)│
                             └──────────────────┬───────────────────┘
                                                ▼
                             ┌──────────────────────────────────────┐
                             │       Critic / Verifier Agent        │
                             │  (Audits evidence, validates causal  │
                             │   claims, checks contradictions)     │
                             └──────────────────┬───────────────────┘
                                                ▼
                                         ┌──────────────┐
                           ┌─────────────┤ Valid Claim? ├─────────────┐
                           │ PASS        └──────────────┘ REINVESTIGATE│
                           ▼                                          ▼
             ┌───────────────────────────┐             ┌───────────────────────────┐
             │ Final Report Generation   │             │ Re-investigation Loop     │
             │ (Executive summary, charts│             │ (Dynamic task injection,  │
             │  evidence chains, actions)│             │  uncertainty logging)     │
             └───────────────────────────┘             └───────────────────────────┘
```

---

## ⚡ Core Upgraded Capabilities

1. **Deterministic Statistical Testing Layer**:
   - Computes exact p-values, Welch's t-tests, Mann-Whitney U tests, Chi-Square contingency tables, Pearson/Spearman correlations, and Cohen's *d* effect sizes using `SciPy` and `NumPy`.
2. **Traceable Evidence Ledger**:
   - Every numerical claim is linked to specific queries, exact dataset values, statistical metrics, or document chunk citations.
3. **Calibrated Confidence Framework**:
   - Mathematical confidence calibration: Statistical Evidence (35%), Dataset Coverage (20%), Evidence Consistency (15%), Document Support (10%), Critic Validation (10%), Contradiction Penalty (-10%).
4. **Correlation vs. Causation Hierarchy**:
   - Classifies every finding into `OBSERVATION`, `CORRELATION`, `STRONG_ASSOCIATION`, `LIKELY_CONTRIBUTING_FACTOR`, `CAUSAL_EVIDENCE`, or `INSUFFICIENT_EVIDENCE`.
5. **Dataset Intelligence & Relationship Discovery**:
   - Discovers candidate primary keys and foreign keys between datasets with join confidence scores and value overlap metrics.
   - Infers semantic business metadata (entities, dimensions, metrics, time columns).
6. **Safe Analytical Code Execution**:
   - AST validation blocks unauthorized system calls (`subprocess`, `eval`, `socket`) with execution timeouts and memory safeguards.
7. **Investigation Replay & Reproducibility**:
   - Historical investigation state snapshots, replay runs preserving context diffs, and human-in-the-loop pause/resume/cancel controls.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS v4, Lucide Icons, TanStack Query |
| **Backend** | FastAPI, Python 3.10+, SQLAlchemy 2.0 (async), Pydantic v2 |
| **Analytics & OLAP** | DuckDB in-memory engine, Pandas, NumPy, SciPy |
| **Database & Vector** | PostgreSQL 16 with `pgvector` extension |
| **Agent Streaming** | Server-Sent Events (SSE) with AsyncIO Queues |
| **LLM Reasoning** | Ollama (local/free), OpenAI, or Anthropic Claude |

---

## 🚀 Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🌐 Production Deployment Guide (Vercel + Neon)

Deploy the complete platform to production using **Neon PostgreSQL** and **Vercel**.

```mermaid
graph LR
    User([User Browser]) --> Frontend[Vercel Frontend React SPA]
    Frontend --> Backend[Vercel Backend FastAPI Serverless]
    Backend --> Neon[(Neon PostgreSQL + pgvector)]
    Backend -.-> OpenAI[OpenAI / Groq API]
```

### Step 1: Set Up Neon PostgreSQL
1. Sign up at [neon.tech](https://neon.tech) (Free tier available).
2. Create a new project named `datapilot`.
3. In the Neon Dashboard, go to **Connection Details**:
   - Select **Pooled connection** (recommended for serverless).
   - Copy the connection string (e.g., `postgresql://neondb_owner:password@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`).

---

### Step 2: Deploy Backend to Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New... > Project**.
2. Select your **`DataPilot-ai`** repository and click **Import**.
3. Under **Project Settings**:
   - **Project Name**: `datapilot-backend` (or your choice)
   - **Framework Preset**: `Other`
   - **Root Directory**: Click `Edit` and choose **`backend`**
4. Under **Environment Variables**, add the following:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require` | Your Neon connection string |
| `SECRET_KEY` | *(Generate a 32+ character random secret)* | e.g. `openssl rand -hex 32` |
| `APP_ENV` | `production` | Production mode |
| `DEBUG` | `false` | Disable debug logs in prod |
| `ALLOWED_ORIGINS` | `https://your-frontend-project.vercel.app` | Your frontend Vercel URL |
| `OPENAI_API_KEY` | `sk-...` *(Optional)* | For GPT-4o-mini agent reasoning |
| `GROQ_API_KEY` | `gsk_...` *(Optional)* | For fast free-tier agent reasoning |

5. Click **Deploy**.
6. Once deployed, copy your Backend URL (e.g. `https://datapilot-backend.vercel.app`). Test it by visiting `https://datapilot-backend.vercel.app/docs`.

---

### Step 3: Deploy Frontend to Vercel
1. In Vercel, click **Add New... > Project**.
2. Select the same **`DataPilot-ai`** repository and click **Import**.
3. Under **Project Settings**:
   - **Project Name**: `datapilot` (or your choice)
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and choose **`frontend`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://datapilot-backend.vercel.app` | The backend URL from Step 2 (NO trailing slash) |

5. Click **Deploy**.
6. Open your live frontend URL!

---

### 🛡️ Production Verification Checklist

- [x] **CORS Configuration**: Wildcard regex automatically allows `https://*.vercel.app` preview and production domains.
- [x] **Serverless Database Pooling**: Database engine handles connection pooling and SSL mode automatically.
- [x] **Ephemeral Storage**: Serverless uploads write to `/tmp/uploads` to prevent read-only filesystem errors.
- [x] **SPA Routing**: `vercel.json` rewrite rules ensure direct navigation and refresh on sub-routes work without 404s.
