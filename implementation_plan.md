# Implementation Plan - Production Dataset Preview & DuckDB SQL Console Fix

## 1. Problem Summary & Root Causes

### Problem 1: Dataset Preview Shows 0 Rows
- **Root Cause 1 (`NameError: DatasetProfile`)**: In `backend/app/services/dataset_service.py`, `DatasetProfile` was missing from `from app.db.models.dataset import Dataset, DatasetStatus`. When running in serverless (where disk files in `/tmp` are ephemeral), the fallback to `DatasetProfile` immediately raised `NameError: name 'DatasetProfile' is not defined`, returning HTTP 500.
- **Root Cause 2 (Ephemeral File Loss on Serverless & 10-Row Sample Limitation)**: Uploaded files were written only to ephemeral `/tmp` filesystem and `profiling_service.py` only saved 10 sample rows (`head(10)`). When disk files disappeared in serverless, previews were either missing or truncated to 10 rows.
- **Root Cause 3 (UI Error Handling)**: `DataExplorer.jsx` did not handle preview API errors gracefully, defaulting to empty arrays and showing `"No rows available to preview."` instead of surfacing actionable error states.

### Problem 2: DuckDB SQL Console Returns "Network Error"
- **Root Cause 1 (`ModuleNotFoundError: duckdb`)**: `duckdb` was not listed in root `requirements.txt` or `backend/requirements.txt`. On Vercel serverless deployment, `import duckdb` raised `ModuleNotFoundError: No module named 'duckdb'`, returning HTTP 500.
- **Root Cause 2 (In-Memory Fallback & SQL Registration)**: When disk files disappear on serverless, DuckDB needs to load directly from persisted database content (`raw_data` or `sample_rows`) and register aliases (`df`, `dataset`, `table`).
- **Root Cause 3 (Frontend Error Parsing & Status Mapping)**: `DataExplorer.jsx` and `api.js` lacked HTTP status-specific diagnostics (401, 403, 404, 422, 500, 503).

---

## 2. Proposed Technical Changes

### Backend Changes

1. **`requirements.txt` & `backend/requirements.txt`**:
   - Add `duckdb>=1.0.0`
   - Add `scipy>=1.13.0`
   - Add `duckdb-engine>=0.13.0` (optional/standalone)

2. **`backend/app/db/models/dataset.py` & Database Migrations**:
   - Import `DatasetProfile` in `dataset_service.py`.
   - Add `raw_data: Mapped[str | None]` column to `Dataset` model to persist raw tabular CSV/JSON text directly in PostgreSQL for small/medium datasets (<10MB), ensuring 100% data preservation across serverless re-deployments and cold starts.
   - Add database auto-migration in `main.py` for `ALTER TABLE datasets ADD COLUMN IF NOT EXISTS raw_data TEXT;`.

3. **`backend/app/services/dataset_service.py`**:
   - Fix imports: `from app.db.models.dataset import Dataset, DatasetProfile, DatasetStatus`.
   - Update `save_dataset_file`: If file is text/CSV/JSON, also store text content in `dataset.raw_data`.
   - Update `preview_dataset_rows`:
     - Prioritize disk file if present.
     - Fallback to `dataset.raw_data` (parse via `StringIO`).
     - Fallback to `DatasetProfile.sample_rows`.
     - Return structured response: `columns`, `rows`, `total_rows`, `limit`, `offset`.
     - Explicit error responses with HTTP 404 / 403 / 422 / 500.
   - Update `query_dataset_sql`:
     - Initialize DuckDB connection.
     - Load dataset into `df` DataFrame from disk, `dataset.raw_data`, or `profile.sample_rows`.
     - Register `df` in DuckDB.
     - Execute query, format results, catch `duckdb.Error` and return structured HTTP 422 for invalid SQL (e.g. syntax error).
     - Add detailed logging (dataset_id, workspace_id, query, row count, execution time).

4. **`backend/app/services/profiling_service.py`**:
   - Increase `sample_rows` capacity to 500 rows if raw data is unavailable.
   - Ensure clean JSON serialization for timestamps, floats, NaNs, and infinities.

### Frontend Changes

1. **`frontend/src/components/datasets/DataExplorer.jsx`**:
   - Add robust error handling for Data Table Preview (show error card with retry button on 404/500).
   - Add robust error handling for DuckDB SQL Console (handle 401, 403, 404, 422, 500, and show structured SQL syntax error messages).
   - Ensure `columns` and `rows` render cleanly with type badges and pagination.

2. **`frontend/src/services/api.js`**:
   - Refine `getBaseUrl` and error response interceptors.

---

## 3. Verification Plan

### Automated & Live API Tests
1. **Live Test Preview**: Call `GET /api/v1/datasets/{id}/preview` on live backend and verify HTTP 200 with columns and rows.
2. **Live Test SQL**:
   - `SELECT * FROM df LIMIT 25;` $\to$ verify rows returned.
   - `SELECT COUNT(*) AS total_rows FROM df;` $\to$ verify scalar aggregation.
   - `SELECT * FROM df WHERE 1 = 0;` $\to$ verify empty result set handled cleanly.
   - `SELEC invalid syntax;` $\to$ verify structured 422 SQL error returned.
3. **Workspace Authorization Test**: Verify user cannot access or query dataset from another workspace.
4. **End-to-End Test Suite**: Run full python test script validating all 4 tests.
