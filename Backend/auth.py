# otp.py
import secrets
import bcrypt
import pymysql.cursors
from datetime import datetime, timedelta, timezone
from typing import Optional, Literal, Dict, Any
import uuid
from database_connection import get_db

# Τύπος για τον σκοπό του OTP
Purpose = Literal["register", "login"]


def now_utc() -> datetime:
    """Επιστρέφει την τρέχουσα UTC ώρα."""
    return datetime.now(timezone.utc)


def generate_otp_code(length: int = 6) -> str:
    """Γεννάει OTP με κρυπτογραφικά ασφαλή τυχαιότητα."""
    return f"{secrets.randbelow(10**length):0{length}d}"


def hash_otp_code(otp: str) -> str:
    """Επιστρέφει bcrypt hash του OTP."""
    return bcrypt.hashpw(otp.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_otp_code(otp_code: str, otp_hash_code: str) -> bool:
    """Επαληθεύει ότι το OTP ταιριάζει με το hash."""
    return bcrypt.checkpw(otp_code.encode("utf-8"), otp_hash_code.encode("utf-8"))


async def create_otp_entry(
    conn, verification: str, purpose: Purpose, ttl_minutes: int = 10
) -> str:
    """
    Δημιουργεί ΝΕΟ OTP για email+purpose.
    Ακυρώνει παλιότερα ενεργά και επιστρέφει το plaintext OTP.
    """
    otp_code = generate_otp_code(6)
    otp_hash_code = hash_otp_code(otp_code)
    exp = now_utc() + timedelta(minutes=ttl_minutes)

    async with conn.cursor() as cur:
        # Ακύρωσε παλιά ενεργά
        await cur.execute(
            """
            UPDATE otp_codes
            SET used = 1
            WHERE verification = %s AND purpose = %s AND used = 0 AND expires_at > UTC_TIMESTAMP()
            """,
            (verification, purpose),
        )
        # Δημιούργησε νέο
        await cur.execute(
            """
            INSERT INTO otp_codes (verification, code, expires_at, used, purpose, attempts)
            VALUES (%s, %s, %s, 0, %s, 0)
            """,
            (verification, otp_hash_code, exp, purpose),
        )
    await conn.commit()
    return otp_code


async def get_latest_active_otp(
    conn, verification: str, purpose: Purpose
) -> Optional[Dict[str, Any]]:
    """Φέρνει το πιο πρόσφατο ενεργό OTP."""
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, verification, code, expires_at, used, created_at, purpose, attempts
                FROM otp_codes
                WHERE verification = %s AND purpose = %s
                AND used = 0
                AND expires_at > UTC_TIMESTAMP()
                ORDER BY id DESC
                LIMIT 1
                """,
                (verification, purpose),
            )
            row = await cur.fetchone()
            return row or None
    except Exception as e:
        print(f"❌ Database error in get_latest_active_otp: {e}")
        raise


async def increment_otp_attempts(conn, otp_id: int) -> None:
    """Αυξάνει το πεδίο attempts κατά 1 (async έκδοση)."""
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = %s", (otp_id,)
            )
        await conn.commit()
    except Exception as e:
        print(f"❌ Database error in increment_otp_attempts: {e}")
        raise


async def mark_otp_used(conn, otp_id: int) -> None:
    """Μαρκάρει το OTP ως χρησιμοποιημένο (async έκδοση)."""
    try:
        async with conn.cursor() as cur:
            await cur.execute("UPDATE otp_codes SET used = 1 WHERE id = %s", (otp_id,))
        await conn.commit()
    except Exception as e:
        print(f"❌ Database error in mark_otp_used: {e}")
        raise


async def verify_and_consume_otp(
    conn, verification: str, purpose: Purpose, otp_code: str, *, max_attempts: int = 5
) -> Dict[str, Any]:
    """
    Επαληθεύει OTP και το μαρκάρει ως used.
    Επιστρέφει {"ok": bool, "reason": str}
    """
    row = await get_latest_active_otp(conn, verification, purpose)
    if not row:
        return {"ok": False, "reason": "no_active_code"}

    otp_id = row["id"]
    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        from datetime import timezone

        expires_at = expires_at.replace(tzinfo=timezone.utc)
    attempts = int(row["attempts"])
    otp_hash_code = row["code"]

    # Έλεγχος ορίου προσπαθειών
    if attempts >= max_attempts:
        return {"ok": False, "reason": "too_many_attempts"}

    # Έλεγχος λήξης
    if expires_at <= now_utc():
        await mark_otp_used(conn, otp_id)
        return {"ok": False, "reason": "expired"}

    # Έλεγχος κωδικού
    if not verify_otp_code(otp_code, otp_hash_code):
        await increment_otp_attempts(conn, otp_id)
        return {"ok": False, "reason": "invalid_code", "attempts": attempts + 1}

    # Επιτυχία
    await mark_otp_used(conn, otp_id)
    return {"ok": True, "reason": "verified", "otp_id": otp_id}


def send_otp_email(email: str, otp_code: str, purpose: str = "register"):
    """
    Στέλνει OTP email μέσω AWS SES
    """
    from AWS_HELPER import send_email  # Import εδώ για να μη χρειάζεται globally

    # Subject ανάλογα με purpose
    if purpose == "register":
        subject = "Verify your email - AI Chatbot Builder"
        greeting = "Welcome! Complete your registration"
    else:  # login
        subject = "Your login code - AI Chatbot Builder"
        greeting = "Welcome back!"

    # Email body - HTML
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }}
            .container {{ max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 24px; }}
            .content {{ padding: 32px; }}
            .otp-box {{ background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; }}
            .otp-code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; font-family: 'Courier New', monospace; }}
            .warning {{ color: #dc2626; font-size: 14px; margin-top: 16px; }}
            .footer {{ background: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{greeting}</h1>
            </div>
            <div class="content">
                <p>Your verification code is:</p>
                <div class="otp-box">
                    <div class="otp-code">{otp_code}</div>
                    <p class="warning">⚠️ This code expires in 10 minutes</p>
                </div>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>© 2025 AI Chatbot Builder | <a href="https://aichat-builder.com" style="color: #4f46e5;">aichat-builder.com</a></p>
            </div>
        </div>
    </body>
    </html>
    """

    # Email body - Plain text (fallback)
    body_text = f"""
{greeting}

Your verification code is: {otp_code}

This code expires in 10 minutes.

If you didn't request this code, please ignore this email.

---
AI Chatbot Builder
https://aichat-builder.com
    """

    # Αποστολή μέσω AWS SES
    result = send_email(
        to_email=email, subject=subject, body_text=body_text, body_html=body_html
    )

    if result.get("ok"):
        print(f"✅ OTP email sent to {email} (Message ID: {result.get('message_id')})")
        return True
    else:
        print(f"❌ Failed to send OTP email to {email}: {result.get('error')}")
        raise Exception(f"Email sending failed: {result.get('error')}")


# ========== SESSION MANAGEMENT ==========#


async def create_auth_session(conn, user_id: int, ttl_hours: int = 24) -> str:
    """
    Δημιουργεί νέο session για user.
    Επιστρέφει το session_id.
    """
    session_id = str(uuid.uuid4())
    expires_at = now_utc() + timedelta(hours=ttl_hours)

    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO auth_sessions (auth_session_id, user_id, expires_at, last_activity_at)
            VALUES (%s, %s, %s, %s)
            """,
            (session_id, user_id, expires_at, now_utc()),
        )
    await conn.commit()
    return session_id


async def get_user_from_session(conn, auth_session_id: str) -> Optional[Dict[str, Any]]:
    """
    Επιστρέφει user data αν το session είναι έγκυρο.
    Ενημερώνει το last_activity_at.
    """
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT s.auth_session_id, s.user_id, s.expires_at, u.email, u.phone_number, u.first_name, u.last_name
                FROM auth_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.auth_session_id = %s AND s.expires_at > %s
                """,
                (auth_session_id, now_utc()),
            )
            row = await cur.fetchone()

            if row:
                await cur.execute(
                    "UPDATE auth_sessions SET last_activity_at = %s WHERE auth_session_id = %s",
                    (now_utc(), auth_session_id),
                )
                await conn.commit()
                return dict(row)
            return None
    except Exception as e:
        print(f"❌ Database error in get_user_from_session: {e}")
        return None


async def delete_session(conn, auth_session_id: str) -> bool:
    """
    Διαγράφει session (logout).
    """
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM auth_sessions WHERE auth_session_id = %s",
                (auth_session_id,),
            )
        await conn.commit()
        return True
    except Exception as e:
        print(f"❌ Database error in delete_session: {e}")
        raise


def cleanup_expired_auth_sessions(conn) -> int:
    """
    Διαγράφει expired sessions.
    Επιστρέφει πόσα διαγράφηκαν.
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM auth_sessions WHERE expires_at < %s", (now_utc(),))
        deleted = cur.rowcount
    conn.commit()
    return deleted


# ========== SMS SENDING (PLACEHOLDER) ==========#
def send_otp_sms(phone: str, otp_code: str, purpose: str = "register"):
    from twilio_helper import send_sms

    if purpose == "register":
        greeting = "AI Chatbot Builder 🤖 - Registration"
    else:  # login
        greeting = "AI Chatbot Builder 🤖 - Login"

    message_body = f"""
    {greeting}

    🔑 Your verification code is: 
           {otp_code}

    ⚠️ Attention! 
    Expires in 10 minutes. 
    DO NOT share this code."""

    result = send_sms(phone, message_body)

    if result.get("ok"):
        print(f"✅ OTP SMS sent to {phone} (SID: {result.get('message_sid')})")
        return True
    else:
        print(f"❌ Failed to send OTP SMS to {phone}: {result.get('error')}")
        raise Exception(f"SMS sending failed: {result.get('error')}")


# ========== UNIVERSAL CONTACT HELPER ==========#
def send_otp_to_contact(
    contact: str, otp_code: str, method: str, purpose: str = "register"
):
    """
    Στέλνει OTP στο σωστό μέσο (email ή SMS)
    """
    if method == "email":
        send_otp_email(contact, otp_code, purpose)
    elif method == "sms":
        send_otp_sms(contact, otp_code, purpose)
    else:
        raise ValueError(f"Invalid method: {method}")
