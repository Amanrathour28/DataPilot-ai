import asyncio
import sys
from pathlib import Path
sys.path.insert(0, 'backend')

from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models.investigation import Investigation, InvestigationTask, AgentRun, Finding, Hypothesis

async def audit():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Investigation).order_by(Investigation.created_at.desc()).limit(15))
        invs = res.scalars().all()
        print(f"Found {len(invs)} recent investigations:")
        for inv in invs:
            print(f"\n--- Investigation ID: {inv.id} ---")
            print(f"Status: {inv.status}")
            print(f"Objective: {inv.objective}")
            print(f"Summary: {inv.summary}")
            t_res = await db.execute(select(InvestigationTask).where(InvestigationTask.investigation_id == inv.id))
            tasks = t_res.scalars().all()
            print(f"Tasks ({len(tasks)}):")
            for t in tasks:
                print(f"  - Step {t.step_number} [{t.agent}] Status: {t.status} | Objective: {t.objective[:50]}")
            f_res = await db.execute(select(Finding).where(Finding.investigation_id == inv.id))
            findings = f_res.scalars().all()
            print(f"Findings ({len(findings)}): {[f.statement[:40] for f in findings]}")
            h_res = await db.execute(select(Hypothesis).where(Hypothesis.investigation_id == inv.id))
            hyps = h_res.scalars().all()
            print(f"Hypotheses ({len(hyps)}): {[h.title[:40] for h in hyps]}")

if __name__ == "__main__":
    asyncio.run(audit())
