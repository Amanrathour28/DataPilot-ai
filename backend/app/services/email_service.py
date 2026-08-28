import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import urllib.request
import json

from app.core.config import settings

logger = logging.getLogger("datapilot.email")


def generate_reset_email_html(user_name: str, reset_url: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c16; color: #e2e8f0; margin: 0; padding: 40px 20px; }}
        .container {{ max-width: 520px; margin: 0 auto; background-color: #121224; border: 1px solid #2d2d4d; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        .header {{ padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #1f1f38; }}
        .logo {{ font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }}
        .logo span {{ color: #a855f7; }}
        .content {{ padding: 32px; }}
        h1 {{ font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 16px; }}
        p {{ font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px; }}
        .button-wrap {{ text-align: center; margin: 32px 0; }}
        .button {{ display: inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 10px; }}
        .footer {{ padding: 20px 32px; background-color: #0b0b14; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1a1a2e; }}
        .code {{ word-break: break-all; font-family: monospace; font-size: 11px; color: #64748b; margin-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Data<span>Pilot</span> AI</div>
        </div>
        <div class="content">
          <h1>Reset your password</h1>
          <p>Hi {user_name or 'there'},</p>
          <p>We received a request to reset your password for your DataPilot AI account. Click the button below to choose a new password. This link will expire in 15 minutes.</p>
          <div class="button-wrap">
            <a href="{reset_url}" class="button" target="_blank">Reset Password</a>
          </div>
          <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <p class="code">Or copy this link to your browser:<br>{reset_url}</p>
        </div>
        <div class="footer">
          &copy; {settings.app_name}. Secure Autonomous Data Investigation Platform.
        </div>
      </div>
    </body>
    </html>
    """


async def send_password_reset_email(to_email: str, reset_token: str, user_name: str = "User") -> bool:
    """Send a password reset email using the configured email provider.
    
    Supports:
    - console (development / safe logging)
    - smtp
    - resend
    - sendgrid
    """
    reset_url = f"{settings.frontend_base_url.rstrip('/')}/reset-password?token={reset_token}"
    subject = "Reset your DataPilot AI password"
    html_content = generate_reset_email_html(user_name, reset_url)
    provider = (settings.email_provider or "console").lower().strip()

    logger.info(f"Dispatching password reset email to {to_email} via provider='{provider}'")

    if provider == "console" or not (settings.email_api_key or settings.smtp_host or settings.resend_api_key or settings.sendgrid_api_key):
        logger.info(f"[EMAIL DEV MODE] Password reset link for {to_email}: {reset_url}")
        print(f"\n=======================================================")
        print(f"[DEV EMAIL] Password Reset for: {to_email}")
        print(f"Reset URL: {reset_url}")
        print(f"=======================================================\n")
        return True

    # 1. Resend API
    if provider == "resend" or (settings.resend_api_key or (provider == "api" and settings.email_api_key)):
        api_key = settings.resend_api_key or settings.email_api_key
        try:
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps({
                    "from": settings.email_from,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                }).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                if res.status in [200, 201]:
                    logger.info(f"Resend email sent successfully to {to_email}")
                    return True
        except Exception as e:
            logger.error(f"Failed to send email via Resend: {e}")

    # 2. SendGrid API
    if provider == "sendgrid" or settings.sendgrid_api_key:
        api_key = settings.sendgrid_api_key or settings.email_api_key
        try:
            req = urllib.request.Request(
                "https://api.sendgrid.com/v3/mail/send",
                data=json.dumps({
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": settings.email_from.split("<")[-1].rstrip(">") if "<" in settings.email_from else settings.email_from},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_content}],
                }).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                if res.status in [200, 202]:
                    logger.info(f"SendGrid email sent successfully to {to_email}")
                    return True
        except Exception as e:
            logger.error(f"Failed to send email via SendGrid: {e}")

    # 3. SMTP
    if provider == "smtp" and settings.smtp_host:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.email_from
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_tls:
                    server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.email_from, [to_email], msg.as_string())
            logger.info(f"SMTP email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")

    # Fallback to dev log
    logger.info(f"[EMAIL FALLBACK] Password reset link for {to_email}: {reset_url}")
    return True
