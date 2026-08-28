# Authentication System Improvements & Completion Implementation Plan

We will enhance the DataPilot AI authentication system with end-to-end email validation, password hardening, Google OAuth authentication, and a cryptographically secure Password Reset workflow with an extensible email service abstraction.

## User Review Required

> [!IMPORTANT]
> - **Google OAuth**: Integrates with Google OAuth 2.0. If `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` are not configured yet, the UI provides clean fallbacks and instructions without breaking existing email/password logins.
> - **Email Delivery**: Implements an email service abstraction supporting Console (local/dev logging), SMTP, Resend, and SendGrid without requiring mandatory third-party credentials during development.
> - **Existing Users**: Existing users and workspace relationships are 100% preserved.

---

## Proposed Changes

### 1. Database Models & Schema Migrations
#### [MODIFY] [`backend/app/db/models/user.py`](file:///c:/Users/amanr/Desktop/DataPilot/backend/app/db/models/user.py)
- Add `PasswordResetToken` ORM model:
  - `id`: UUID String(36)
  - `user_id`: String(36), index=True
  - `token_hash`: String(64), index=True (SHA-256 hashed token)
  - `expires_at`: DateTime(timezone=True)
  - `used_at`: DateTime(timezone=True), nullable=True
  - `created_at`: DateTime(timezone=True)
- Add Google OAuth ID / provider tracking fields to `User` model (`google_id: Mapped[str | None]`, `auth_provider: Mapped[str] = "email"`).

#### [MODIFY] [`backend/app/main.py`](file:///c:/Users/amanr/Desktop/DataPilot/backend/app/main.py)
- Add auto-migrations for both Postgres (`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id ...`, `CREATE TABLE IF NOT EXISTS password_reset_tokens ...`) and SQLite.

---

### 2. Backend Authentication & Email Services
#### [MODIFY] [`backend/app/core/config.py`](file:///c:/Users/amanr/Desktop/DataPilot/backend/app/core/config.py)
- Add settings for:
  - `google_client_id: Optional[str]`
  - `google_client_secret: Optional[str]`
  - `google_redirect_uri: Optional[str]`
  - `email_provider: str = "console"`
  - `email_api_key: Optional[str] = None`
  - `email_from: str = "DataPilot AI <noreply@datapilot.ai>"`
  - `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`
  - `frontend_base_url: str = "http://localhost:5173"`

#### [MODIFY] [`backend/app/schemas/auth.py`](file:///c:/Users/amanr/Desktop/DataPilot/backend/app/schemas/auth.py)
- Add password complexity validation to `RegisterRequest` and `ResetPasswordRequest` (min 8 chars, 1 uppercase, 1 lowercase, 1 digit).
- Add `ForgotPasswordRequest`, `ResetPasswordRequest`, `VerifyResetTokenResponse`, and `GoogleAuthRequest` schemas.

#### [NEW] [`backend/app/services/email_service.py`](file:///c:/Users/amanr/Desktop/DataPilot/backend/app/services/email_service.py)
- Abstract email dispatcher with HTML email templates for Password Reset.
- Safe logging in dev / console mode and SMTP / API provider support.

#### [MODIFY] [`backend/app/api/routes/auth.py`](file:///c:/Users/amanr/Desktop/DataPilot/backend/app/api/routes/auth.py)
- Email normalization (`email.strip().lower()`).
- Endpoint `POST /auth/forgot-password`: Generates secure token, stores SHA-256 hash with 15-minute expiry, sends email, returns generic message.
- Endpoint `POST /auth/reset-password`: Verifies SHA-256 token hash, updates user password, marks token as used.
- Endpoint `GET /auth/verify-reset-token`: Validates token status for frontend.
- Endpoint `POST /auth/google`: Verifies Google token, handles new user account creation + default workspace generation, or signs in existing user seamlessly without duplicate accounts.

---

### 3. Frontend Authentication UX
#### [MODIFY] [`frontend/src/services/api.js`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/services/api.js)
- Add `forgotPassword(email)`, `resetPassword(token, newPassword)`, `verifyResetToken(token)`, and `googleAuth(credential)`.

#### [MODIFY] [`frontend/src/stores/authStore.js`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/stores/authStore.js)
- Add `loginWithGoogle(credential)` method and improve error extraction.

#### [MODIFY] [`frontend/src/pages/auth/Login.jsx`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/pages/auth/Login.jsx)
- Add "Forgot password?" link.
- Add "Continue with Google" button with Google icon.
- Email format validation & anti-double-click loading state.

#### [MODIFY] [`frontend/src/pages/auth/Register.jsx`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/pages/auth/Register.jsx)
- Add "Continue with Google" button.
- Add real-time password requirement checklist (8+ chars, uppercase, lowercase, number).
- Email normalization and validation.

#### [NEW] [`frontend/src/pages/auth/ForgotPassword.jsx`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/pages/auth/ForgotPassword.jsx)
- Email input form with validation.
- Generic success state ("If an account exists, a reset link has been sent").
- Back to login navigation.

#### [NEW] [`frontend/src/pages/auth/ResetPassword.jsx`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/pages/auth/ResetPassword.jsx)
- Token verification from URL query param `?token=...`.
- New password + Confirm new password inputs with show/hide toggle.
- Password strength criteria feedback & mismatch validation.
- Success state and redirection to login.

#### [MODIFY] [`frontend/src/App.jsx`](file:///c:/Users/amanr/Desktop/DataPilot/frontend/src/App.jsx)
- Register `/forgot-password` and `/reset-password` routes.

---

## Verification Plan

### Automated Tests
- Run comprehensive auth test suite covering:
  - Email format validation & duplicate email registration rejection.
  - Password strength rejection and acceptance.
  - Login with correct vs incorrect credentials (generic 401).
  - Forgot password request with existing and non-existing emails (identical response).
  - Password reset token generation, expiration check, single-use validation, and successful reset.
  - Google authentication (new user vs existing user mapping).
- Execute tests against live database and local environment.

### Manual & UI Verification
- Build frontend (`npm run build`).
- Verify `/login`, `/register`, `/forgot-password`, and `/reset-password` pages and responsiveness.
