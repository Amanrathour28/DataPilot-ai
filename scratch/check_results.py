import asyncio
import asyncpg
import json

URL = "postgresql://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require"

async def check_results():
    conn = await asyncpg.connect(URL, statement_cache_size=0)
    inv_id = "d5a946c2-d62a-4e18-b3f8-56bc36243f76"

    inv = await conn.fetchrow("SELECT id, status, failure_reason, confidence_score, last_completed_stage, summary FROM investigations WHERE id = $1;", inv_id)
    print("\nINVESTIGATION STATUS:", dict(inv))

    tasks = await conn.fetch("SELECT id, agent, status, step_number, error, duration_ms FROM investigation_tasks WHERE investigation_id = $1 ORDER BY step_number ASC;", inv_id)
    print(f"\nTASKS ({len(tasks)}):")
    for t in tasks:
        print(dict(t))

    findings = await conn.fetch("SELECT id, statement, confidence FROM findings WHERE investigation_id = $1;", inv_id)
    print(f"\nFINDINGS ({len(findings)}):")
    for f in findings:
        print(dict(f))

    hyps = await conn.fetch("SELECT id, title, status, confidence FROM hypotheses WHERE investigation_id = $1;", inv_id)
    print(f"\nHYPOTHESES ({len(hyps)}):")
    for h in hyps:
        print(dict(h))

    evts = await conn.fetch("SELECT seq, agent, event_type, message FROM investigation_events WHERE investigation_id = $1 ORDER BY seq ASC;", inv_id)
    print(f"\nEVENTS ({len(evts)}):")
    for e in evts:
        print(dict(e))

    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_results())
