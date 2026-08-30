import asyncio
import os
import sys
import uuid
import pandas as pd

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
settings.database_url = "sqlite+aiosqlite:///./test_pipeline.db"

from app.db.base import AsyncSessionLocal, init_db, engine
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.db.models.dataset import Dataset, DatasetProfile
from app.db.models.investigation import Investigation, InvestigationTask, InvestigationEvent
from app.worker import InvestigationWorker, utcnow
from sqlalchemy import select


async def reproduce_pipeline():
    print("=" * 60)
    print("REPRODUCING INVESTIGATION PIPELINE EXECUTION")
    print("=" * 60)

    # Recreate tables in test db
    import app.db.models
    from app.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Create or find a test workspace & user
        u_res = await db.execute(select(User).limit(1))
        user = u_res.scalar_one_or_none()
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email="test_worker@datapilot.ai",
                hashed_password="dummy",
                name="Test Worker",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        w_res = await db.execute(select(Workspace).where(Workspace.owner_id == user.id).limit(1))
        ws = w_res.scalar_one_or_none()
        if not ws:
            ws = Workspace(
                id=str(uuid.uuid4()),
                name="Test Worker Workspace",
                slug="test-worker-workspace",
                owner_id=user.id,
            )
            db.add(ws)
            await db.commit()
            await db.refresh(ws)

        # Create a test dataset
        csv_path = os.path.abspath("test_worker_dataset.csv")
        df = pd.DataFrame({
            "quarter": ["Q1", "Q1", "Q2", "Q2"],
            "region": ["East", "West", "East", "West"],
            "revenue": [50000.0, 60000.0, 45000.0, 70000.0]
        })
        df.to_csv(csv_path, index=False)

        ds = Dataset(
            id=str(uuid.uuid4()),
            workspace_id=ws.id,
            uploaded_by=user.id,
            name="test_worker_dataset.csv",
            original_filename="test_worker_dataset.csv",
            file_path=csv_path,
            file_extension=".csv",
            mime_type="text/csv",
            file_size_bytes=len(df.to_csv().encode("utf-8")),
            status="PROFILED",
            row_count=len(df),
            column_count=len(df.columns),
        )
        db.add(ds)
        await db.commit()
        await db.refresh(ds)

        # Create an investigation
        inv = Investigation(
            id=str(uuid.uuid4()),
            workspace_id=ws.id,
            created_by=user.id,
            objective="Why did revenue change from Q1 to Q2 across regions?",
            status="QUEUED",
        )
        db.add(inv)
        await db.commit()
        await db.refresh(inv)
        print(f"Created Investigation: {inv.id} for Workspace: {ws.id}")

    # Now run worker.run_investigation
    worker = InvestigationWorker(worker_id="test_worker_runner")
    print("\nRunning worker.run_investigation...")
    success = await worker.run_investigation(inv.id)
    print(f"\nworker.run_investigation returned: {success}")

    # Inspect the final state in DB
    async with AsyncSessionLocal() as db:
        inv_res = await db.execute(select(Investigation).where(Investigation.id == inv.id))
        final_inv = inv_res.scalar_one_or_none()
        print(f"\nFinal Investigation Status: {final_inv.status}")
        print(f"Final Last Completed Stage: {final_inv.last_completed_stage}")
        print(f"Final Confidence Score: {final_inv.confidence_score}")
        print(f"Final Locked By: {final_inv.locked_by}")
        print(f"Final Lock Expires At: {final_inv.lock_expires_at}")
        print(f"Final Failure Reason: {final_inv.failure_reason}")

        tasks_res = await db.execute(
            select(InvestigationTask)
            .where(InvestigationTask.investigation_id == inv.id)
            .order_by(InvestigationTask.step_number.asc())
        )
        tasks = tasks_res.scalars().all()
        print(f"\nTasks in DB ({len(tasks)} tasks):")
        for t in tasks:
            print(f"  - Step {t.step_number} [{t.agent}]: status={t.status}, error={t.error}, duration={t.duration_ms}ms")

        ev_res = await db.execute(
            select(InvestigationEvent)
            .where(InvestigationEvent.investigation_id == inv.id)
            .order_by(InvestigationEvent.seq.asc())
        )
        events = ev_res.scalars().all()
        print(f"\nEvents logged ({len(events)} events):")
        for e in events:
            print(f"  - [{e.seq}] {e.agent} ({e.event_type}): {e.message[:80]}...")


if __name__ == "__main__":
    asyncio.run(reproduce_pipeline())
