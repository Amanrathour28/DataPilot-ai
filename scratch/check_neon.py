import asyncio
import asyncpg
import json

URL = "postgresql://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require"

async def check_neon():
    conn = await asyncpg.connect(URL, statement_cache_size=0)
    print("Connected to Neon DB!")

    # Check tables
    tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    print("\nTables:", [t['table_name'] for t in tables])

    # Check investigation_events columns and constraints
    cols = await conn.fetch("SELECT column_name, data_type, is_nullable, column_default, is_identity, identity_generation FROM information_schema.columns WHERE table_name = 'investigation_events';")
    print("\nInvestigation Events columns:")
    for c in cols:
        print(dict(c))

    # Check primary keys / unique constraints on investigation_events
    pks = await conn.fetch("""
        SELECT tc.constraint_type, tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'investigation_events';
    """)
    print("\nInvestigation Events constraints:")
    for p in pks:
        print(dict(p))

    # Check current rows in investigation_events
    rows = await conn.fetch("SELECT seq, id, investigation_id, agent, event_type, message FROM investigation_events ORDER BY seq DESC LIMIT 10;")
    print("\nLast 10 events:")
    for r in rows:
        print(dict(r))

    # Check sequences
    seqs = await conn.fetch("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';")
    print("\nSequences in public:", [s['sequence_name'] for s in seqs])

    # Check pg_class for sequences
    pg_seqs = await conn.fetch("SELECT c.relname FROM pg_class c WHERE c.relkind = 'S';")
    print("pg_class sequences:", [s['relname'] for s in pg_seqs])

    # Check sequence value vs max seq
    max_seq = await conn.fetchval("SELECT MAX(seq) FROM investigation_events;")
    print(f"Max seq in investigation_events: {max_seq}")

    # Check recent investigations
    invs = await conn.fetch("SELECT id, status, objective, failure_reason, locked_by, lock_expires_at, execution_id FROM investigations ORDER BY created_at DESC LIMIT 5;")
    print("\nLast 5 investigations:")
    for i in invs:
        print(dict(i))

    # Check investigation_tasks
    tasks = await conn.fetch("SELECT id, investigation_id, agent, status, step_number, error FROM investigation_tasks ORDER BY created_at DESC LIMIT 10;")
    print("\nLast 10 tasks:")
    for t in tasks:
        print(dict(t))

    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_neon())
