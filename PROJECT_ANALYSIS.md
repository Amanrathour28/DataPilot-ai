# DataPilot AI — Implementation Analysis & Architecture Reference

This document provides a descriptive and detailed technical analysis of the components, backend routes, services, database models, and frontend views implemented in **DataPilot AI**.

---

## 1. Backend Architecture & Endpoints

### 📊 Analytics & Observability
- **File**: `backend/app/api/routes/analytics.py`
  - **`GET /api/v1/analytics/summary?workspace_id={id}`**:
    - Aggregates investigation metrics: total count, completed, failed, active/running count, and calculated success rate percentage.
    - Aggregates dataset footprints: total datasets, cumulative row count, total file size in MB.
    - Aggregates RAG knowledge base statistics: total documents and total indexed vector chunks.
    - Computes agent swarm telemetry: total agent runs, number of causal findings, validated hypotheses, role distribution breakdown, estimated LLM tokens processed, and estimated analyst hours / cost saved.
  - **`GET /api/v1/analytics/agents-activity?workspace_id={id}`**:
    - Queries the 50 most recent `AgentRun` records across all investigations in the workspace.
    - Returns agent role, status, execution duration in milliseconds, tool calls made (tool name and arguments), error messages, and parent investigation objectives.
- **File**: `backend/app/main.py`
  - Registered `analytics.router` under `/api/v1/analytics`.

---

### 🗄️ Dataset Ingestion, Exploration & SQL Engine
- **File**: `backend/app/services/dataset_service.py`
  - **`save_dataset_file`**: Validates MIME types/extensions (`.csv`, `.xlsx`, `.xls`, `.json`), enforces upload size guards, persists file to disk, and records metadata in PostgreSQL.
  - **`preview_dataset_rows`**: Loads a configurable slice of rows (`limit`, `offset`) using Pandas, cleans `NaN`/`Inf` values for JSON serialization, and returns columns and row records.
  - **`query_dataset_sql`**: Connects an in-memory **DuckDB** instance, registers the file as table `df`, enforces read-only `SELECT` / `WITH` validation guards, executes the query, and returns column headers and rows.
- **File**: `backend/app/api/routes/datasets.py`
  - **`GET /api/v1/datasets/{dataset_id}/preview`**: Exposes paginated tabular preview rows.
  - **`POST /api/v1/datasets/{dataset_id}/query`**: Accepts `{ "query": "SELECT ..." }` and executes ad-hoc SQL against the dataset via DuckDB.
  - **`POST /api/v1/datasets/upload`**: Multipart file upload handler with background profiling triggers.
  - **`GET /api/v1/datasets/{dataset_id}/profile`**: Retrieves statistical profiling results (column types, null counts, distributions, correlations).
  - **`POST /api/v1/datasets/{dataset_id}/reprofile`**: Re-triggers async profiling.

---

### 🧠 Workspace Memory & Domain Context
- **File**: `backend/app/api/routes/memories.py`
- **File**: `backend/app/services/memory_service.py`
  - **`GET /api/v1/memories`**: Retrieves workspace memories with optional category filter (`business_rule`, `domain_knowledge`, `preference`, `context`).
  - **`POST /api/v1/memories`**: Creates a new memory item linked to the workspace and author user ID.
  - **`PATCH /api/v1/memories/{memory_id}`**: Updates memory text, category, or toggles `is_active` state.
  - **`DELETE /api/v1/memories/{memory_id}`**: Removes a memory item.

---

### 🤖 Multi-Agent Investigation Engine
- **File**: `backend/app/services/investigation_service.py`
  - **Graph State Machine**:
    1. **Planning**: Generates step-by-step investigation plan mapped against dataset schemas and active workspace memories.
    2. **Data Analyst**: Writes and executes Python/Pandas code via `app/tools/python_executor.py` to aggregate and segment data.
    3. **Hypothesis Generation & Testing**: Formulates hypotheses and calculates statistical confidence scores.
    4. **Root Cause & RAG Grounding**: Cross-references findings against document embeddings in `pgvector`.
    5. **Critic Verification**: Validates conclusions before final report generation.
  - **Real-Time SSE Streaming**: Async queue registry (`subscribe_to_investigation`, `broadcast_event`) broadcasting live status, tasks, and findings to frontend listeners.
- **File**: `backend/app/api/routes/investigations.py`
  - **`POST /api/v1/investigations`**: Initiates an investigation and schedules background agent execution.
  - **`GET /api/v1/investigations`**: Lists investigations in a workspace.
  - **`GET /api/v1/investigations/{id}`**: Returns investigation details, tasks, agent runs, hypotheses, and findings.
  - **`GET /api/v1/investigations/{id}/stream`**: Server-Sent Events (SSE) stream endpoint.

---

### 📄 Knowledge Base & RAG Engine
- **File**: `backend/app/services/document_service.py`
- **File**: `backend/app/api/routes/documents.py`
  - Document file parsing (PDF, TXT, MD, DOCX), semantic text chunking, embedding generation, and cosine similarity vector search stored in `DocumentChunk` (`pgvector`).

---

## 2. Frontend Architecture & Views

### 🌐 API Service Layer
- **File**: `frontend/src/services/api.js`
  - Axios client with JWT interceptor and global 401 handling.
  - Exported endpoint modules: `authApi`, `workspacesApi`, `datasetsApi` (including `preview` & `query`), `investigationsApi` (including `getStreamUrl`), `documentsApi`, `memoriesApi`, `analyticsApi` (`summary` & `agentsActivity`), and `systemApi` (`health`).

---

### 🖥️ Page Views & Components

#### 1. Workspace Memory View
- **File**: `frontend/src/pages/memory/Memory.jsx`
  - **Category Tabs**: Filter memories by *All*, *Business Rules*, *Domain Knowledge*, *Preferences*, or *Context*.
  - **Search Bar**: Real-time filtering by memory content and category.
  - **Memory Cards**: Displays active status badge, category tag, body text, and last updated date.
  - **Action Controls**: Active/Inactive toggle switch, inline edit button, and delete confirmation.
  - **Create / Edit Modal**: Form to input rule description and select category.

#### 2. Live Agent Swarm Activity Monitor
- **File**: `frontend/src/pages/agents/Agents.jsx`
  - **Agent Mesh Cards**: Architecture breakdown for all 6 specialized agents (Supervisor, Planner, Data Analyst, Hypothesis Agents, Root Cause Agent, Critic) displaying role descriptions, tags, and readiness status.
  - **Live Execution Stream**: Auto-polling (5s interval) of workspace agent runs with status indicators (`COMPLETED`, `RUNNING`, `FAILED`) and execution times.
  - **Interactive Trace Inspector**: Expanding any run reveals formatted tool call names, arguments/code executed, and error traces.
  - **Role Filter Pills**: Quickly filter traces by agent type.

#### 3. Analytics & Observability Dashboard
- **File**: `frontend/src/pages/analytics/Analytics.jsx`
  - **Executive KPI Cards**: Total investigations with success rate %, findings and validated hypotheses count, estimated analyst hours saved, and estimated ROI dollar savings.
  - **Agent Role Run Distribution**: Visual percentage progress bars showing activity split across agent roles.
  - **Data & Knowledge Footprint**: Metric cards for indexed datasets, total rows analyzed, RAG documents, semantic chunks, and active memory rules.

#### 4. Settings & LLM Engine Configuration
- **File**: `frontend/src/pages/settings/SettingsPage.jsx`
  - **Workspace Details Tab**: Form to update workspace name and description.
  - **LLM & Agent Engine Tab**: Provider selector between *Ollama (Local)*, *OpenAI API*, and *Anthropic Claude*. Provides Ollama endpoint URL input, model tag input (`llama3.2`, `mistral`, `qwen2.5`), API key input, and agent temperature slider. Configurations persist to `localStorage`.
  - **System Diagnostics Tab**: Live connectivity status checks for FastAPI Core, PostgreSQL + pgvector, and DuckDB engine.

#### 5. Interactive Dataset Explorer & DuckDB Console
- **File**: `frontend/src/components/datasets/DataExplorer.jsx`
- **File**: `frontend/src/pages/datasets/DatasetDetail.jsx`
  - **Dataset Detail Tabs**: Toggles between **Statistical Profile & Insights** (`ProfileView.jsx`) and **Data Explorer & SQL Runner**.
  - **Data Table Preview**: Sticky header table displaying raw rows with row index numbering, total row count, and column search filter.
  - **DuckDB SQL Console**: Code textarea pre-populated with `SELECT * FROM df LIMIT 25;`, run query button with loading states, error banner display, and interactive tabular result renderer.

#### 6. Application Routing & Layout
- **File**: `frontend/src/App.jsx`
  - Complete routing tree configured:
    - `/dashboard` → `Dashboard.jsx`
    - `/investigations` → `Investigations.jsx`
    - `/investigations/new` → `NewInvestigation.jsx`
    - `/investigations/:id` → `InvestigationDetail.jsx`
    - `/datasets` → `Datasets.jsx`
    - `/datasets/:id` → `DatasetDetail.jsx`
    - `/knowledge` → `Knowledge.jsx`
    - `/agents` → `Agents.jsx`
    - `/analytics` → `Analytics.jsx`
    - `/memory` → `Memory.jsx`
    - `/settings` → `SettingsPage.jsx`
- **File**: `frontend/src/components/layout/Sidebar.jsx`
  - Sidebar with workspace switcher, navigation links, quick "New Investigation" CTA, and user session profile.

---

## 3. Database Schema Overview

| Table | Model File | Key Columns | Purpose |
|---|---|---|---|
| `users` | `backend/app/db/models/user.py` | `id`, `email`, `hashed_password`, `name`, `role` | User accounts and auth |
| `workspaces` | `backend/app/db/models/workspace.py` | `id`, `name`, `slug`, `description` | Multi-tenant tenant boundaries |
| `workspace_members` | `backend/app/db/models/workspace.py` | `workspace_id`, `user_id`, `role` | Workspace authorization mapping |
| `datasets` | `backend/app/db/models/dataset.py` | `id`, `workspace_id`, `file_path`, `row_count`, `status` | Uploaded data files |
| `dataset_profiles` | `backend/app/db/models/dataset.py` | `dataset_id`, `schema_info`, `statistics`, `correlations` | Statistical profile results |
| `documents` | `backend/app/db/models/document.py` | `id`, `workspace_id`, `filename`, `file_path`, `status` | RAG domain knowledge documents |
| `document_chunks` | `backend/app/db/models/document.py` | `document_id`, `chunk_index`, `content`, `embedding` (vector) | Chunked vector embeddings |
| `investigations` | `backend/app/db/models/investigation.py` | `id`, `workspace_id`, `objective`, `status`, `summary` | Investigation sessions |
| `investigation_tasks` | `backend/app/db/models/investigation.py` | `investigation_id`, `task_type`, `description`, `status` | Planned agent tasks |
| `agent_runs` | `backend/app/db/models/investigation.py` | `investigation_id`, `agent_role`, `tool_calls`, `duration_ms` | Individual agent execution steps |
| `hypotheses` | `backend/app/db/models/investigation.py` | `investigation_id`, `statement`, `confidence_score`, `status` | Formulated and tested hypotheses |
| `findings` | `backend/app/db/models/investigation.py` | `investigation_id`, `title`, `description`, `chart_spec` | Validated analytical conclusions |
| `memories` | `backend/app/db/models/memory.py` | `id`, `workspace_id`, `category`, `content`, `is_active` | Persistent business context |
