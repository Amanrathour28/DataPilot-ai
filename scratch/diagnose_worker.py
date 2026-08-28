import asyncio
import asyncpg
import sys
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.base import AsyncSessionLocal, engine
from app.worker import InvestigationWorker

async def test_worker_on_investigation():
    # Fix the sequence first in DB
    conn = await asyncpg.connect("postgresql://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require", statement_cache_size=0)
    
    seq_name = await conn.fetchval("SELECT pg_get_serial_sequence('investigation_events', 'seq');")
    print("pg_get_serial_sequence result:", seq_name)

    curr_val = await conn.fetchval("SELECT last_value FROM investigation_events_seq_seq;")
    max_val = await conn.fetchval("SELECT MAX(seq) FROM investigation_events;")
    print(f"investigation_events_seq_seq last_value: {curr_val}, max seq in table: {max_val}")

    # Update sequence to max + 100
    new_val = await conn.fetchval(f"SELECT setval('investigation_events_seq_seq', {max(max_val or 0, 1000)} + 100, true);")
    print("Updated sequence to:", new_val)

    # Let's inspect the last 5 investigations in DB
    invs = await conn.fetch("SELECT id, workspace_id, status, objective FROM investigations WHERE status NOT IN ('COMPLETED', 'FAILED') ORDER BY created_at DESC LIMIT 5;")
    print(f"\nFound {len(invs)} uncompleted investigations:")
    for i in invs:
        print(dict(i))

    await conn.close()

    if invs:
        target_inv_id = invs[0]['id']
        print(f"\n--- RUNNING InvestigationWorker on {target_inv_id} ---")
        worker = InvestigationWorker(worker_id="test_local_worker")
        success = await worker.run_investigation(target_inv_id)
        print(f"Result for {target_inv_id}: success = {success}")

        # Check DB status after run
        conn = await asyncpg.connect("postgresql://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require", statement_cache_size=0)
        inv_after = await conn.fetchrow("SELECT id, status, failure_reason, confidence_score, summary FROM investigations WHERE id = $1;", target_inv_id)
        print("Investigation after run:", dict(inv_after))

        tasks_after = await conn.fetch("SELECT id, agent, status, step_number, error, duration_ms FROM investigation_tasks WHERE investigation_id = $1 ORDER BY step_number ASC;", target_inv_id)
        print(f"\nTasks ({len(tasks_after)}):")
        for t in tasks_after:
            print(dict(t))

        evts_after = await conn.fetch("SELECT seq, agent, event_type, message FROM investigation_events WHERE investigation_id = $1 ORDER BY seq ASC;", target_inv_id)
        print(f"\nEvents ({len(evts_after)}):")
        for e in evts_after:
            print(dict(e))

        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_worker_on_investigation())
