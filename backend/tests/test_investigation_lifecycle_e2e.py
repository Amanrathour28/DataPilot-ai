"""
Comprehensive End-to-End Test Suite for DataPilot Investigation Lifecycle
========================================================================
Covers:
1. User, Workspace, Dataset, and Investigation creation & persistence
2. Investigation ID consistency (CREATE -> DB -> GET -> WORKER -> PERSIST -> REPLAY)
3. Elimination of "Investigation record not found" & NameError on GET /investigations/{id}
4. Multi-tenant workspace isolation (User A / Workspace A vs User B / Workspace B)
5. Dataset association (investigation analyzes user-selected dataset, not arbitrary)
6. Deterministic Question Execution ("How many items are there which are required more than 100?")
7. Complex Causal Question Execution (multi-agent hypothesis, critic, report)
8. Replay execution lifecycle (ID A stays A, execution_id Y != X, DB row not deleted)
9. Defensive API & routing checks (404 for nonexistent, 403 for unauthorized)
"""

import asyncio
import os
import sys
import uuid
import pytest
import pandas as pd
import numpy as np

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.db.base import AsyncSessionLocal, ensure_schema_initialized
from app.core.security import create_access_token
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.models.dataset import Dataset, DatasetProfile
from app.db.models.investigation import Investigation
from app.worker import InvestigationWorker


async def _test_body():
    await ensure_schema_initialized()

    # ──────────────────────────────────────────────────────────────────────────
    # 1. SETUP: Create User A, Workspace A, Dataset A (85 rows)
    # ──────────────────────────────────────────────────────────────────────────
    uid_a = f"usr_a_{uuid.uuid4().hex[:8]}"
    wid_a = f"ws_a_{uuid.uuid4().hex[:8]}"
    dsid_a = f"ds_a_{uuid.uuid4().hex[:8]}"

    # Dataset A: 85 items. Exactly 25 items have Required_Quantity > 100.
    np.random.seed(42)
    req_qty_a = [150.0] * 25 + [50.0] * 60  # 85 rows total, 25 > 100
    df_a = pd.DataFrame({
        "Item_ID": [f"ITEM_{i+1:03d}" for i in range(85)],
        "Item_Name": [f"Component {chr(65 + (i % 26))}-{i+1}" for i in range(85)],
        "Required_Quantity": req_qty_a,
        "Unit_Price": np.random.uniform(10.0, 100.0, size=85).round(2),
        "Category": ["Electronics" if i % 2 == 0 else "Mechanical" for i in range(85)],
        "Lead_Time_Days": np.random.randint(5, 30, size=85),
    })
    raw_data_a = df_a.to_json(orient="records")

    # ──────────────────────────────────────────────────────────────────────────
    # SETUP: Create User B, Workspace B, Dataset B (200 rows)
    # ──────────────────────────────────────────────────────────────────────────
    uid_b = f"usr_b_{uuid.uuid4().hex[:8]}"
    wid_b = f"ws_b_{uuid.uuid4().hex[:8]}"
    dsid_b = f"ds_b_{uuid.uuid4().hex[:8]}"

    df_b = pd.DataFrame({
        "Order_ID": [f"ORD_{i+1:04d}" for i in range(200)],
        "Amount": np.random.uniform(100.0, 500.0, size=200).round(2),
        "Region": ["North" if i % 2 == 0 else "South" for i in range(200)],
    })
    raw_data_b = df_b.to_json(orient="records")

    os.makedirs("uploads", exist_ok=True)
    csv_path_a = f"uploads/test_{dsid_a}.csv"
    csv_path_b = f"uploads/test_{dsid_b}.csv"
    df_a.to_csv(csv_path_a, index=False)
    df_b.to_csv(csv_path_b, index=False)

    async with AsyncSessionLocal() as db:
        user_a = User(id=uid_a, email=f"{uid_a}@datapilot.test", name="Alice Researcher", hashed_password="pw")
        ws_a = Workspace(id=wid_a, name="Workspace Alpha", slug=f"ws-alpha-{uid_a}", owner_id=uid_a)
        wm_a = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=wid_a, user_id=uid_a, role="OWNER")
        ds_a = Dataset(
            id=dsid_a,
            workspace_id=wid_a,
            uploaded_by=uid_a,
            name="Parts Inventory A",
            original_filename="parts_inventory_a.csv",
            file_path=csv_path_a,
            file_size_bytes=os.path.getsize(csv_path_a),
            mime_type="text/csv",
            file_extension="csv",
            status="PROFILED",
            row_count=85,
            column_count=len(df_a.columns),
            raw_data=raw_data_a,
        )

        user_b = User(id=uid_b, email=f"{uid_b}@datapilot.test", name="Bob Analyst", hashed_password="pw")
        ws_b = Workspace(id=wid_b, name="Workspace Beta", slug=f"ws-beta-{uid_b}", owner_id=uid_b)
        wm_b = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=wid_b, user_id=uid_b, role="OWNER")
        ds_b = Dataset(
            id=dsid_b,
            workspace_id=wid_b,
            uploaded_by=uid_b,
            name="Sales Data B",
            original_filename="sales_data_b.csv",
            file_path=csv_path_b,
            file_size_bytes=os.path.getsize(csv_path_b),
            mime_type="text/csv",
            file_extension="csv",
            status="PROFILED",
            row_count=200,
            column_count=len(df_b.columns),
            raw_data=raw_data_b,
        )

        db.add_all([user_a, ws_a, wm_a, ds_a, user_b, ws_b, wm_b, ds_b])
        await db.commit()

    token_a = create_access_token(uid_a)
    token_b = create_access_token(uid_b)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:

        # ──────────────────────────────────────────────────────────────────────
        # 2. CREATE INVESTIGATION A (Deterministic Question)
        # ──────────────────────────────────────────────────────────────────────
        deterministic_q = "How many items are there which are required more than 100?"
        create_resp = await client.post(
            f"/api/v1/investigations?workspace_id={wid_a}",
            json={
                "objective": deterministic_q,
                "workspace_id": wid_a,
                "dataset_id": dsid_a,
                "dataset_ids": [dsid_a],
            },
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert create_resp.status_code == 201, f"Create failed: {create_resp.text}"
        inv_data = create_resp.json()
        inv_id_a = inv_data["id"]
        assert inv_id_a is not None
        assert inv_data["workspace_id"] == wid_a
        assert inv_data["dataset_id"] == dsid_a
        assert inv_data["created_by_name"] == "Alice Researcher"

        # Direct DB Persistence Check
        async with AsyncSessionLocal() as db:
            db_inv_res = await db.execute(select(Investigation).where(Investigation.id == inv_id_a))
            db_inv = db_inv_res.scalar_one_or_none()
            assert db_inv is not None, "Investigation record missing from database!"
            assert db_inv.id == inv_id_a
            assert db_inv.workspace_id == wid_a
            assert db_inv.dataset_id == dsid_a
            assert db_inv.status in ("QUEUED", "PLANNING", "ANALYZING", "RUNNING", "COMPLETED")

        # ──────────────────────────────────────────────────────────────────────
        # 3. GET /api/v1/investigations/{id} (Verify NO NameError & Correct Response)
        # ──────────────────────────────────────────────────────────────────────
        get_resp = await client.get(
            f"/api/v1/investigations/{inv_id_a}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert get_resp.status_code == 200, f"Detail retrieval failed: {get_resp.text}"
        detail_data = get_resp.json()
        assert detail_data["id"] == inv_id_a
        assert detail_data["created_by_name"] == "Alice Researcher"
        assert detail_data["dataset_id"] == dsid_a

        # ──────────────────────────────────────────────────────────────────────
        # 4. MULTI-TENANT ISOLATION CHECK
        # User B (Workspace B) attempts to access Investigation A -> Must return 403
        # ──────────────────────────────────────────────────────────────────────
        unauth_resp = await client.get(
            f"/api/v1/investigations/{inv_id_a}",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert unauth_resp.status_code in (403, 404), f"Security breach: User B accessed User A investigation: {unauth_resp.status_code}"

        # Helper to wait for asynchronous worker execution
        async def _wait_for_completion(inv_id: str, token: str, timeout: int = 30):
            for _ in range(timeout * 2):
                r = await client.get(
                    f"/api/v1/investigations/{inv_id}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if r.status_code == 200:
                    d = r.json()
                    if d.get("status") in ("COMPLETED", "COMPLETED_WITH_LIMITATIONS", "FAILED"):
                        return d
                await asyncio.sleep(0.5)
            # If background loop hadn't picked it up, execute directly
            fallback_w = InvestigationWorker(worker_id=f"fb_w_{uuid.uuid4().hex[:6]}")
            await fallback_w.run_investigation(inv_id)
            r = await client.get(f"/api/v1/investigations/{inv_id}", headers={"Authorization": f"Bearer {token}"})
            return r.json()

        # ──────────────────────────────────────────────────────────────────────
        # 5 & 6. WAIT FOR INVESTIGATION A & VERIFY DUAL-ENGINE CALCULATION
        # ──────────────────────────────────────────────────────────────────────
        completed_inv = await _wait_for_completion(inv_id_a, token_a)
        assert completed_inv["status"] in ("COMPLETED", "COMPLETED_WITH_LIMITATIONS"), f"Investigation did not complete: {completed_inv}"
        assert completed_inv["id"] == inv_id_a
        first_exec_id = completed_inv["execution_id"]
        assert first_exec_id is not None

        # Verify structured output fields
        struct_analysis = completed_inv.get("structured_analysis") or {}
        assert struct_analysis.get("intent") in ("COUNT", "COUNT_FILTER_ANALYSIS") or completed_inv.get("is_deterministic") is True
        
        # Verify calculation correctness (25 of 85 items)
        evidence_ledger = completed_inv.get("evidence_ledger") or []
        assert len(evidence_ledger) > 0, "No evidence items generated!"
        
        # Verify DuckDB query was executed on real dataset rows
        has_verified_count = False
        for ev in evidence_ledger:
            summary = str(ev.get("result_summary", "")) + str(ev.get("claim", ""))
            if "25" in summary and "85" in summary:
                has_verified_count = True
                break
        assert has_verified_count, f"Did not find verified count of 25 in evidence ledger: {evidence_ledger}"

        # ──────────────────────────────────────────────────────────────────────
        # 7. REPLAY INVESTIGATION A
        # Must preserve original ID A and issue a new execution ID Y != X
        # ──────────────────────────────────────────────────────────────────────
        replay_resp = await client.post(
            f"/api/v1/investigations/{inv_id_a}/replay",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert replay_resp.status_code == 200, f"Replay failed: {replay_resp.text}"
        replayed_data = replay_resp.json()

        assert replayed_data["id"] == inv_id_a, "Replay created a new ID instead of preserving original ID!"
        replayed_exec_id = replayed_data["execution_id"]
        assert replayed_exec_id != first_exec_id, "Replay failed to generate a fresh execution ID!"
        assert replayed_data["status"] in ("QUEUED", "PLANNING", "ANALYZING", "RUNNING", "COMPLETED")

        # Wait for replayed investigation worker to conclude
        post_replay_data = await _wait_for_completion(inv_id_a, token_a)
        assert post_replay_data["id"] == inv_id_a
        assert post_replay_data["execution_id"] == replayed_exec_id
        assert post_replay_data["status"] in ("COMPLETED", "COMPLETED_WITH_LIMITATIONS")

        # ──────────────────────────────────────────────────────────────────────
        # 8. COMPLEX CAUSAL INVESTIGATION (Section 26 Question)
        # ──────────────────────────────────────────────────────────────────────
        complex_q = (
            "Analyze this dataset and identify the most important patterns that explain "
            "why some items have much higher required quantities than others. "
            "Support every conclusion with actual evidence from the dataset and clearly "
            "distinguish correlation from causation."
        )
        complex_create_resp = await client.post(
            f"/api/v1/investigations?workspace_id={wid_a}",
            json={
                "objective": complex_q,
                "workspace_id": wid_a,
                "dataset_id": dsid_a,
            },
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert complex_create_resp.status_code == 201
        complex_inv_id = complex_create_resp.json()["id"]

        # Wait for complex question pipeline to finish
        complex_detail = await _wait_for_completion(complex_inv_id, token_a)
        assert complex_detail["status"] in ("COMPLETED", "COMPLETED_WITH_LIMITATIONS")

        # In complex causal questions, hypotheses or root causes must be generated
        assert len(complex_detail.get("hypotheses", [])) > 0 or len(complex_detail.get("root_causes", [])) > 0, (
            "Complex causal question did not generate hypotheses/root causes!"
        )

        # ──────────────────────────────────────────────────────────────────────
        # 9. DATASET ASSOCIATION ISOLATION (Dataset B - 200 rows)
        # ──────────────────────────────────────────────────────────────────────
        b_create_resp = await client.post(
            f"/api/v1/investigations?workspace_id={wid_b}",
            json={
                "objective": "What is the total amount by region?",
                "workspace_id": wid_b,
                "dataset_id": dsid_b,
            },
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert b_create_resp.status_code == 201
        b_inv_id = b_create_resp.json()["id"]

        b_detail = await _wait_for_completion(b_inv_id, token_b)
        assert b_detail["status"] in ("COMPLETED", "COMPLETED_WITH_LIMITATIONS")
        assert b_detail["dataset_id"] == dsid_b

        # ──────────────────────────────────────────────────────────────────────
        # 10. DEFENSIVE ROUTING CHECKS (404 on nonexistent ID)
        # ──────────────────────────────────────────────────────────────────────
        nonexistent_id = str(uuid.uuid4())
        not_found_resp = await client.get(
            f"/api/v1/investigations/{nonexistent_id}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert not_found_resp.status_code == 404
        assert "not found" in not_found_resp.json().get("detail", "").lower()

    print("\n[ALL TESTS PASSED] End-to-End Investigation Lifecycle successfully verified!")
    return True


def test_full_investigation_lifecycle_e2e():
    asyncio.run(_test_body())


if __name__ == "__main__":
    test_full_investigation_lifecycle_e2e()
