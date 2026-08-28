import asyncio
import asyncpg
import json

URL = "postgresql://neondb_owner:npg_lMXoRTL37dtA@ep-lucky-sunset-axd8ck84-pooler.c-4.us-east-2.aws.neon.tech/neondb?ssl=require"

async def main():
    conn = await asyncpg.connect(URL, statement_cache_size=0)
    datasets = await conn.fetch("SELECT id, workspace_id, name, status, file_path, row_count, column_count FROM datasets ORDER BY created_at DESC LIMIT 10;")
    print("=== DATASETS ===")
    for d in datasets:
        print(dict(d))
    
    profiles = await conn.fetch("SELECT dataset_id, schema_info, sample_rows FROM dataset_profiles ORDER BY profiled_at DESC LIMIT 5;")
    print("=== PROFILES ===")
    for p in profiles:
        print(f"\n--- Dataset {p['dataset_id']} ---")
        if p['sample_rows']:
            print(f"Sample rows count: {len(p['sample_rows'])}")
            print("First 3 rows:")
            print(json.dumps(p['sample_rows'][:3], indent=2))
        if p['schema_info']:
            print("Schema info:", json.dumps(p['schema_info'], indent=2))
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
