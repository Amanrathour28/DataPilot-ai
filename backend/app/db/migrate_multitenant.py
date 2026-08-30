import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, text, func, inspect
from app.db.base import AsyncSessionLocal, engine, Base
import app.db.models  # Ensure all models are registered with Base.metadata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("datapilot.multitenant_migration")


def slugify(name: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", name.lower()).strip()
    return re.sub(r"[-\s]+", "-", cleaned)[:60]


async def run_multitenant_migration():
    """Idempotently ensures all multi-tenant tables, columns, and relations exist,

    and migrates existing single-user data cleanly into organizations and workspaces.
    """
    logger.info("Starting multi-tenant database migration...")

    # 1. Create any missing tables defined in Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Checked/created all SQLAlchemy metadata tables.")

    # 2. Add missing columns to existing tables if on SQLite
    async with AsyncSessionLocal() as db:
        bind = db.bind or getattr(db.sync_session, "bind", None)
        is_sqlite = bind and bind.dialect.name == "sqlite" if bind else True

        if is_sqlite:
            # Check users table columns
            u_cols_res = await db.execute(text("PRAGMA table_info(users)"))
            u_cols = [r[1] for r in u_cols_res.fetchall()]
            if "auth_provider" not in u_cols:
                logger.info("Adding auth_provider column to users table...")
                await db.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(32) DEFAULT 'email'"))
                await db.commit()
            if "google_id" not in u_cols:
                logger.info("Adding google_id column to users table...")
                await db.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
                await db.commit()

            # Check workspaces table columns
            ws_cols_res = await db.execute(text("PRAGMA table_info(workspaces)"))
            ws_cols = [r[1] for r in ws_cols_res.fetchall()]
            if "organization_id" not in ws_cols:
                logger.info("Adding organization_id column to workspaces table...")
                await db.execute(text("ALTER TABLE workspaces ADD COLUMN organization_id VARCHAR(36)"))
                await db.commit()

            # Check datasets table columns
            ds_cols_res = await db.execute(text("PRAGMA table_info(datasets)"))
            ds_cols = [r[1] for r in ds_cols_res.fetchall()]
            if "raw_data" not in ds_cols:
                logger.info("Adding raw_data column to datasets table...")
                await db.execute(text("ALTER TABLE datasets ADD COLUMN raw_data TEXT"))
                await db.commit()

            # Check investigations table columns
            inv_cols_res = await db.execute(text("PRAGMA table_info(investigations)"))
            inv_cols = [r[1] for r in inv_cols_res.fetchall()]
            if "organization_id" not in inv_cols:
                logger.info("Adding organization_id column to investigations table...")
                await db.execute(text("ALTER TABLE investigations ADD COLUMN organization_id VARCHAR(36)"))
                await db.commit()
            if "visibility" not in inv_cols:
                logger.info("Adding visibility column to investigations table...")
                await db.execute(text("ALTER TABLE investigations ADD COLUMN visibility VARCHAR(20) DEFAULT 'WORKSPACE'"))
                await db.commit()
            if "assigned_to" not in inv_cols:
                logger.info("Adding assigned_to column to investigations table...")
                await db.execute(text("ALTER TABLE investigations ADD COLUMN assigned_to VARCHAR(36)"))
                await db.commit()

        # 3. Migrate existing Users into default Organizations
        from app.db.models.user import User
        from app.db.models.organization import Organization, OrganizationMember, OrganizationRole
        from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceMemberRole
        from app.db.models.investigation import Investigation, InvestigationMember
        from app.db.models.collaboration import AuditLog

        users_res = await db.execute(select(User))
        all_users = users_res.scalars().all()
        logger.info(f"Auditing {len(all_users)} user(s) for organization provisioning...")

        for user in all_users:
            # Check if user already has an organization membership
            mem_res = await db.execute(
                select(OrganizationMember).where(OrganizationMember.user_id == user.id)
            )
            existing_mem = mem_res.scalar_one_or_none()

            if not existing_mem:
                org_name = f"{user.name.split()[0]}'s Organization" if user.name else "Personal Organization"
                org_slug = f"{slugify(org_name)}-{user.id[:6]}"

                new_org = Organization(
                    id=str(uuid.uuid4()),
                    name=org_name,
                    slug=org_slug,
                    created_by=user.id,
                )
                db.add(new_org)
                await db.flush()

                new_mem = OrganizationMember(
                    id=str(uuid.uuid4()),
                    organization_id=new_org.id,
                    user_id=user.id,
                    role=OrganizationRole.OWNER,
                    status="ACTIVE",
                )
                db.add(new_mem)

                # Link all user's workspaces without an organization_id
                ws_res = await db.execute(
                    select(Workspace).where(Workspace.owner_id == user.id)
                )
                user_workspaces = ws_res.scalars().all()
                for ws in user_workspaces:
                    if not ws.organization_id:
                        ws.organization_id = new_org.id

                # Link user's investigations without an organization_id
                inv_res = await db.execute(
                    select(Investigation).where(Investigation.created_by == user.id)
                )
                user_invs = inv_res.scalars().all()
                for inv in user_invs:
                    if not inv.organization_id:
                        inv.organization_id = new_org.id

                    # Ensure InvestigationMember owner record exists
                    inv_mem_res = await db.execute(
                        select(InvestigationMember).where(
                            InvestigationMember.investigation_id == inv.id,
                            InvestigationMember.user_id == user.id,
                        )
                    )
                    if not inv_mem_res.scalar_one_or_none():
                        db.add(InvestigationMember(
                            id=str(uuid.uuid4()),
                            investigation_id=inv.id,
                            user_id=user.id,
                            role="OWNER",
                        ))

                # Log audit trail
                audit = AuditLog(
                    id=str(uuid.uuid4()),
                    organization_id=new_org.id,
                    user_id=user.id,
                    user_email=user.email,
                    user_name=user.name,
                    action="organization.provisioned",
                    resource_type="organization",
                    resource_id=new_org.id,
                    metadata_json={"migration": True, "user_id": user.id},
                )
                db.add(audit)
                await db.commit()
                logger.info(f"Provisioned Organization '{new_org.name}' ({new_org.id}) for user '{user.email}'")

        # 4. Ensure all orphan workspaces and investigations are assigned
        orphans_ws = await db.execute(select(Workspace).where(Workspace.organization_id == None))
        for ows in orphans_ws.scalars().all():
            # Find owner's organization
            mem = await db.execute(
                select(OrganizationMember).where(OrganizationMember.user_id == ows.owner_id)
            )
            m = mem.scalar_one_or_none()
            if m:
                ows.organization_id = m.organization_id
        await db.commit()

        orphans_inv = await db.execute(select(Investigation).where(Investigation.organization_id == None))
        for oinv in orphans_inv.scalars().all():
            # Get workspace's organization
            ws_res = await db.execute(select(Workspace).where(Workspace.id == oinv.workspace_id))
            ws = ws_res.scalar_one_or_none()
            if ws and ws.organization_id:
                oinv.organization_id = ws.organization_id
        await db.commit()

    logger.info("Multi-tenant database migration completed successfully with zero data loss!")


if __name__ == "__main__":
    asyncio.run(run_multitenant_migration())
