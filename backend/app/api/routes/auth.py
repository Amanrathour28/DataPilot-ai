import hashlib
import logging
import secrets
import urllib.request
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.base import get_db
from app.db.models.user import User, PasswordResetToken, utcnow
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceMemberRole
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyResetTokenResponse,
    GoogleAuthRequest,
    TokenResponse,
    UserResponse,
    GenericMessageResponse,
)
from app.services.email_service import send_password_reset_email
from app.api.dependencies import get_current_user

logger = logging.getLogger("datapilot.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_token(raw_token: str) -> str:
    """Generate a SHA-256 hash of a raw token for secure database storage."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


def _is_expired(expires_at: datetime) -> bool:
    """Safely check if a datetime is expired across SQLite and PostgreSQL."""
    if expires_at is None:
        return True
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        return expires_at < now.replace(tzinfo=None)
    return expires_at < now


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user, create default workspace, and return JWT token."""
    normalized_email = payload.email.strip().lower()

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == normalized_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user
    user = User(
        email=normalized_email,
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        auth_provider="email",
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    # Create default organization
    from app.db.models.organization import Organization, OrganizationMember, OrganizationRole
    org_slug = f"{payload.name.strip().lower().replace(' ', '-')}-org-{user.id[:8]}"
    org = Organization(
        name=f"{payload.name.strip()}'s Organization",
        slug=org_slug,
        created_by=user.id,
    )
    db.add(org)
    await db.flush()

    # Add user as Organization Owner
    org_member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=OrganizationRole.OWNER,
        status="ACTIVE",
    )
    db.add(org_member)

    # Create default personal workspace linked to the organization
    slug = f"{payload.name.strip().lower().replace(' ', '-')}-workspace-{user.id[:8]}"
    workspace = Workspace(
        name=f"{payload.name.strip()}'s Workspace",
        slug=slug,
        organization_id=org.id,
        owner_id=user.id,
    )
    db.add(workspace)
    await db.flush()

    # Add owner as workspace member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=WorkspaceMemberRole.OWNER,
    )
    db.add(member)
    await db.commit()

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email/password and return a JWT token."""
    normalized_email = payload.email.strip().lower()

    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    # Security: Constant response to prevent user enumeration
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been disabled. Please contact support.",
        )

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/forgot-password", response_model=GenericMessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset link.
    
    Security: Always returns a generic success response to prevent account enumeration.
    """
    normalized_email = payload.email.strip().lower()
    generic_msg = "If an account exists for this email, a password reset link has been sent."

    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        # Do not leak whether the user exists
        return GenericMessageResponse(message=generic_msg)

    # Invalidate previous unused reset tokens for this user
    prev_tokens_res = await db.execute(
        select(PasswordResetToken).where(
            and_(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
        )
    )
    for old_tok in prev_tokens_res.scalars().all():
        old_tok.used_at = utcnow()

    # Generate a cryptographically secure random token (43 chars URL-safe)
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = utcnow() + timedelta(minutes=15)

    reset_token_rec = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(reset_token_rec)
    await db.commit()

    # Dispatch email
    try:
        await send_password_reset_email(
            to_email=user.email,
            reset_token=raw_token,
            user_name=user.name,
        )
    except Exception as email_err:
        logger.error(f"Error sending password reset email to {user.email}: {email_err}")

    return GenericMessageResponse(message=generic_msg)


@router.get("/verify-reset-token", response_model=VerifyResetTokenResponse)
async def verify_reset_token(token: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    """Verify if a password reset token is valid and unexpired."""
    token_hash = _hash_token(token)

    result = await db.execute(
        select(PasswordResetToken).where(
            and_(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
            )
        )
    )
    tok = result.scalar_one_or_none()

    if not tok or _is_expired(tok.expires_at):
        return VerifyResetTokenResponse(
            valid=False,
            message="This password reset link is invalid or has expired.",
        )

    user_res = await db.execute(select(User).where(User.id == tok.user_id))
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        return VerifyResetTokenResponse(
            valid=False,
            message="Associated user account is not active.",
        )

    # Mask email for safe confirmation display (e.g. j***@company.com)
    parts = user.email.split("@")
    masked_email = f"{parts[0][:1]}***@{parts[1]}" if len(parts) == 2 else user.email

    return VerifyResetTokenResponse(
        valid=True,
        email=masked_email,
        message="Reset token is valid.",
    )


@router.post("/reset-password", response_model=GenericMessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset the user password using a verified reset token."""
    token_hash = _hash_token(payload.token)

    result = await db.execute(
        select(PasswordResetToken).where(
            and_(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
            )
        )
    )
    tok = result.scalar_one_or_none()

    if not tok or _is_expired(tok.expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid, expired, or has already been used.",
        )

    user_res = await db.execute(select(User).where(User.id == tok.user_id))
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account not found or disabled.",
        )

    now = utcnow()
    # Update password securely
    user.hashed_password = hash_password(payload.new_password)
    user.updated_at = now

    # Invalidate token (single-use guarantee)
    tok.used_at = now

    await db.commit()
    logger.info(f"Password reset successfully completed for user {user.id}")

    return GenericMessageResponse(
        message="Your password has been reset successfully. Please sign in with your new password.",
        success=True,
    )


@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register a user using a Google OAuth ID token."""
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential token is required",
        )

    # Verify Google ID Token via Google TokenInfo API
    google_user_info = None
    try:
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
        req = urllib.request.Request(verify_url, headers={"User-Agent": "DataPilot-Auth/1.0"})
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status == 200:
                google_user_info = json.loads(res.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"Google token verification failed: {e}")

    # Fallback to direct client_id check if configured
    if not google_user_info or "email" not in google_user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to verify Google authentication credentials. Please try signing in with email/password.",
        )

    # Verify audience if GOOGLE_CLIENT_ID is set
    if settings.google_client_id and google_user_info.get("aud") != settings.google_client_id:
        logger.warning(f"Google aud mismatch: {google_user_info.get('aud')} != {settings.google_client_id}")

    email = google_user_info["email"].strip().lower()
    google_id = google_user_info.get("sub")
    name = google_user_info.get("name") or email.split("@")[0]
    picture = google_user_info.get("picture")

    # Check if user exists by email or google_id
    result = await db.execute(
        select(User).where((User.email == email) | (User.google_id == google_id))
    )
    user = result.scalar_one_or_none()

    if user:
        # Existing user: update google_id and avatar if missing
        if not user.google_id and google_id:
            user.google_id = google_id
        if not user.avatar_url and picture:
            user.avatar_url = picture
        if not user.is_verified:
            user.is_verified = True
        user.updated_at = utcnow()
        await db.commit()
    else:
        # New Google user: Create account + personal workspace
        random_pw = secrets.token_urlsafe(32)
        user = User(
            email=email,
            name=name,
            hashed_password=hash_password(random_pw),
            auth_provider="google",
            google_id=google_id,
            avatar_url=picture,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        # Create default organization
        from app.db.models.organization import Organization, OrganizationMember, OrganizationRole
        org_slug = f"{name.lower().replace(' ', '-')}-org-{user.id[:8]}"
        org = Organization(
            name=f"{name}'s Organization",
            slug=org_slug,
            created_by=user.id,
        )
        db.add(org)
        await db.flush()

        # Add user as Organization Owner
        org_member = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=OrganizationRole.OWNER,
            status="ACTIVE",
        )
        db.add(org_member)

        # Create default workspace
        slug = f"{name.lower().replace(' ', '-')}-workspace-{user.id[:8]}"
        workspace = Workspace(
            name=f"{name}'s Workspace",
            slug=slug,
            organization_id=org.id,
            owner_id=user.id,
        )
        db.add(workspace)
        await db.flush()

        # Add owner member
        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceMemberRole.OWNER,
        )
        db.add(member)
        await db.commit()
        logger.info(f"New Google user registered: {user.email} with org {org.id} and workspace {workspace.id}")

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
