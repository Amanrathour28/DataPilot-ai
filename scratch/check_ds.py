import asyncio
import asyncpg

URL = "postgresql://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require"

async def check_ds():
    conn = await asyncpg.connect(URL, statement_cache_size=0)
    datasets = await conn.fetch("SELECT id, workspace_id, name, status, file_path, row_count FROM datasets ORDER BY created_at DESC LIMIT 5;")
    print("Recent datasets:")
    for d in datasets:
        print(dict(d))
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_ds())
