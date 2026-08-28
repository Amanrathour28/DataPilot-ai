import asyncio
import sys
import traceback
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

# Force DATABASE_URL to Neon Postgres
import os
os.environ["DATABASE_URL"] = "postgresql+asyncpg://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require"

from app.db.base import AsyncSessionLocal, engine
from app.worker import InvestigationWorker

async def run_detailed_test():
    worker = InvestigationWorker(worker_id="detailed_test_worker")
    target_inv_id = "e2e25512-78ea-4708-a758-368518c08a69"

    print(f"Running investigation {target_inv_id} with full exception reporting...")
    try:
        success = await worker.run_investigation(target_inv_id)
        print(f"run_investigation returned: {success}")
    except Exception as e:
        print("EXCEPTION CAUGHT IN OUTER:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_detailed_test())
