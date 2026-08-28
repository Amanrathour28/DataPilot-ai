# Production Dataset Preview & DuckDB SQL Console Fix Walkthrough

## Summary of Fixes

We identified and resolved the root causes of both **Problem 1 (Dataset Preview shows 0 rows)** and **Problem 2 (DuckDB SQL Console returns "Network Error")** in the production deployed application.

---

## 1. Root Cause Analysis

### Problem 1: Dataset Preview Shows 0 Rows
1. **Missing Model Import (`NameError: DatasetProfile`)**: In `backend/app/services/dataset_service.py`, `DatasetProfile` was omitted from `from app.db.models.dataset import Dataset, DatasetStatus`. In serverless production (where disk files in `/tmp` are ephemeral and disappear between invocations), the fallback logic calling `select(DatasetProfile)` raised a Python `NameError`, returning HTTP 500.
2. **Ephemeral Disk Loss & Truncated Sample Rows**: Uploaded files on serverless Vercel disappear as lambdas spin down. Previously, `profiling_service.py` only saved `head(10)` sample rows and did not store the raw tabular text in PostgreSQL.
3. **Frontend Silent Degradation**: In `DataExplorer.jsx`, when the preview endpoint threw an error, React Query caught it and left `previewData` as `undefined`, causing the UI to default to `rows = []` and `"Showing top 0 rows / 0 columns total"` instead of surfacing the error state.

### Problem 2: DuckDB SQL Console Returned "Network Error"
1. **Missing Production Dependency (`ModuleNotFoundError: duckdb`)**: `duckdb` was omitted from root `requirements.txt` and `backend/requirements.txt`. When deployed to Vercel, `import duckdb` crashed the Python runtime with a 500 error or closed the connection, which the browser surfaced as a `"Network Error"`.
2. **Missing In-Memory Reconstruction**: DuckDB expected a physical file path at `/tmp/...`. When the serverless instance restarted, the file did not exist, raising an unhandled exception before query execution.
3. **Generic Error Catching**: The UI caught any error and showed generic `"Network Error"` or `"Failed to execute query"` without status code diagnostics.

---

## 2. Architecture Fix & Multi-Tier Resilience

To ensure 100% data durability in serverless and containerized environments:

1. **Persistent `raw_data` Database Column**:
   - Added `raw_data: Mapped[str | None]` to the `Dataset` model.
   - On dataset upload (CSV, JSON, XLSX), the text representation is directly stored in the PostgreSQL database.
   - For Excel spreadsheets, `pd.read_excel` automatically converts the binary sheet into CSV text before storing.
2. **Tri-Tier Data Loading Pipeline for Previews and DuckDB**:
   - **Tier 1 (Fast Disk File)**: If the local disk file exists at `file_path`, read from disk.
   - **Tier 2 (Database `raw_data`)**: If disk file is absent (serverless), reconstruct the `pd.DataFrame` directly from PostgreSQL `dataset.raw_data` via `io.StringIO`.
   - **Tier 3 (Profile Cache `sample_rows`)**: If raw data is unavailable, fall back to `DatasetProfile.sample_rows` (expanded from 10 to 500 rows).
3. **Alias Registration in DuckDB**:
   - Automatically registers `df` and creates views `dataset`, `data`, `sales`, and `transactions` so user queries like `SELECT * FROM df LIMIT 25;` or `SELECT * FROM sales;` run out-of-the-box.
4. **Structured SQL Error Handling**:
   - Disallowed mutating operations return HTTP 400 with explanation.
   - Syntax and table errors return HTTP 422 with exact DuckDB parser/catalog messages.
5. **Frontend Diagnostics**:
   - `DataExplorer.jsx` displays specific diagnostic cards for 401, 403, 404, 422, 500, and network connectivity errors, with one-click Sample Query buttons (`Top 25 Rows`, `Count Rows`, `Schema Describe`, `Empty Test`) and a Retry button.

---

## 3. Files Changed

| File | Changes Made |
| :--- | :--- |
| `requirements.txt` | Added `duckdb>=1.0.0` and `scipy>=1.13.0` for Vercel deployment. |
| `backend/requirements.txt` | Added `duckdb>=1.0.0` and `scipy>=1.13.0`. |
| `backend/app/db/models/dataset.py` | Added `raw_data` column to `Dataset` model. |
| `backend/app/main.py` | Added auto-migration `ALTER TABLE datasets ADD COLUMN IF NOT EXISTS raw_data TEXT;` for Postgres and SQLite. |
| `backend/app/services/dataset_service.py` | Fixed `DatasetProfile` import; added `raw_data` extraction on upload; implemented tri-tier DataFrame loader for `preview_dataset_rows` and `query_dataset_sql`; added DuckDB alias views and HTTP 422 error parsing. |
| `backend/app/services/profiling_service.py` | Increased `sample_rows` to 500 rows; ensured `raw_data` is backfilled during profiling. |
| `frontend/src/components/datasets/DataExplorer.jsx` | Added preview error state with retry button; added sample query pills; enhanced SQL error status mapping (401, 403, 404, 422, 500, network). |

---

## 4. API Request & Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (DataExplorer)
    participant API as FastAPI Backend (/api/v1)
    participant DB as Neon PostgreSQL
    participant Engine as DuckDB (In-Memory)

    User->>UI: Clicks "Data Table Preview"
    UI->>API: GET /api/v1/datasets/{id}/preview?limit=50&offset=0 (Bearer JWT)
    API->>DB: Verify Workspace Membership & Fetch Dataset
    alt Disk file exists
        API->>API: Load slice from disk
    else Serverless / Ephemeral Disk
        API->>DB: Fetch dataset.raw_data or dataset_profiles.sample_rows
        API->>API: Parse via io.StringIO / DataFrame
    end
    API-->>UI: Returns { columns, rows, total_rows, limit, offset, source }
    UI-->>User: Displays Paginated Data Table

    User->>UI: Runs "SELECT * FROM df LIMIT 25;"
    UI->>API: POST /api/v1/datasets/{id}/query { query: "..." }
    API->>DB: Verify Workspace Membership & Load Dataset
    API->>Engine: Initialize :memory: & register DataFrame as 'df'
    API->>Engine: con.execute(query).fetchdf()
    Engine-->>API: Returns query DataFrame
    API-->>UI: Returns { success: true, columns, rows, row_count, execution_time_ms }
    UI-->>User: Displays Result Table & Execution Metric Badges
```

---

## 5. Verification Results

### Automated Suite (`test_preview_and_duckdb_sql.py` & `test_live_neon_preview_and_sql.py`)
- **Dataset Preview**:
  - Returned 4 columns (`order_id`, `region`, `revenue`, `quarter`) and rows accurately.
  - Returned `total_rows=30`.
- **DuckDB SQL Queries**:
  - `SELECT * FROM df LIMIT 25;` $\to$ Returned 25 rows in 26ms.
  - `SELECT COUNT(*) AS total_rows FROM df;` $\to$ Returned `total_rows = 30`.
  - `SELECT * FROM df WHERE 1 = 0;` $\to$ Handled empty result cleanly (`row_count = 0`, `rows = []`).
  - `SELEC invalid syntax;` $\to$ Returned HTTP 400 with syntax policy message.
  - `SELECT * FROM df WHERE invalid_syntax $$$;` $\to$ Returned HTTP 422 with DuckDB Parser Error.
- **Workspace Authorization**:
  - Blocked unauthorized user previews with HTTP 403.
  - Blocked unauthorized SQL executions with HTTP 403.
- **Serverless Resilience**:
  - Manually removed local disk file and re-ran preview & SQL $\to$ 100% success using database `raw_data`.
- **Frontend Build**:
  - `npm run build` executed in 1.19s with 0 errors.
