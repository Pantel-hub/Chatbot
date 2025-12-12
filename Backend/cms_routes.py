import json
import asyncio
import time
import tiktoken
import logging
import secrets
import string
import os
import re
import uuid
import base64
from typing import Dict, Any, Optional, List, Literal
from datetime import date, datetime, timezone, timedelta
from collections import defaultdict
from urllib.parse import urlparse
from tempfile import NamedTemporaryFile

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    Form,
    File,
    UploadFile,
    Request,
    Body,
    Cookie,
    Depends,
    APIRouter,
    BackgroundTasks,
)
from fastapi.responses import (
    StreamingResponse,
    HTMLResponse,
    Response,
    RedirectResponse,
)
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, HttpUrl, Field, EmailStr
from dotenv import load_dotenv
from openai import OpenAI
from anyio import to_thread

from scrapping_control2 import ScrapingController
from migration import migrate_daily_analytics
from create_system_prompt import create_system_prompt
from auth import (
    create_otp_entry,
    verify_and_consume_otp,
    send_otp_email,
    now_utc,
    create_auth_session,
    get_user_from_session,
    delete_session,
)
from redis_helper import get_redis_connection, redis_client
from database_connection import get_db
from AI_assistant_helper import (
    process_knowledge_blocking,
    create_assistant_async,
    create_assistant_config,
    delete_file_from_vector_store_blocking,
    run_assistant_on_thread,
    add_message_to_thread,
    get_or_create_thread,
    update_vector_store_blocking,
    delete_thread_async,
    KnowledgeProcessingError,
)


router = APIRouter()

# --- Pricing: Per-user OpenAI API usage/cost endpoint ---
from fastapi import status


@router.get("/user-usage-stats", status_code=status.HTTP_200_OK)
async def get_user_usage_stats():
    """
    Returns a list of all users with their OpenAI API usage (total messages) and estimated cost.
    Joins users, user_chatbots, and total_analytics.
    """
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                # Join users, user_chatbots, total_analytics
                await cursor.execute(
                    """
                    SELECT u.id as user_id, u.email, u.first_name, u.last_name, ta.total_messages
                    FROM users u
                    JOIN user_chatbots uc ON u.id = uc.user_id
                    JOIN total_analytics ta ON uc.api_key = ta.api_key
                """
                )
                rows = await cursor.fetchall()
        # Pricing: $0.0015 per 1K messages (example, adjust as needed)
        PRICE_PER_1K = 0.0015
        user_stats = []
        for row in rows:
            total_messages = row["total_messages"] or 0
            cost = round((total_messages / 1000) * PRICE_PER_1K, 4)
            user_stats.append(
                {
                    "user_id": row["user_id"],
                    "email": row["email"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "total_messages": total_messages,
                    "cost_usd": cost,
                }
            )
        return {"users": user_stats}
    except Exception as e:
        logger.error(f"Error in get_user_usage_stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user usage stats")


load_dotenv()


# Background task for processing files asynchronously
async def process_files_in_background(
    chatbot_id: int,
    assistant_id: str,
    vector_store_id: str,
    local_file_paths: List[Dict],
    temp_files_to_cleanup: List[str],
):
    """
    Process uploaded files in the background after chatbot creation.
    Uploads files to OpenAI and adds them to the vector store.
    """
    try:
        print(
            f"🔄 Background: Processing {len(local_file_paths)} files for chatbot {chatbot_id}"
        )

        # Upload files to OpenAI and wait for processing
        uploaded_file_ids = []
        for file_info in local_file_paths:
            try:
                with open(file_info["path"], "rb") as f:
                    openai_file = openai_client.files.create(
                        file=f, purpose="assistants"
                    )
                    uploaded_file_ids.append(openai_file.id)
                    print(
                        f"✅ Background: Uploaded file {file_info['filename_key']} -> {openai_file.id}"
                    )
            except Exception as e:
                print(
                    f"❌ Background: Failed to upload file {file_info['filename_key']}: {e}"
                )

        if uploaded_file_ids:
            # Add files to vector store
            try:
                file_batch = openai_client.beta.vector_stores.file_batches.create(
                    vector_store_id=vector_store_id, file_ids=uploaded_file_ids
                )
                print(f"🔄 Background: File batch created: {file_batch.id}")

                # Poll until processing is complete
                max_wait = 600  # 10 minutes max
                start_time = time.time()
                while time.time() - start_time < max_wait:
                    batch_status = (
                        openai_client.beta.vector_stores.file_batches.retrieve(
                            vector_store_id=vector_store_id, batch_id=file_batch.id
                        )
                    )

                    if batch_status.status == "completed":
                        print(
                            f"✅ Background: All files processed successfully for chatbot {chatbot_id}"
                        )

                        # Update database with file IDs (as proper dict format)
                        try:
                            # Convert list of file IDs to proper dict format with metadata
                            file_ids_dict = {}
                            for idx, file_id in enumerate(uploaded_file_ids):
                                if idx == 0 and len(local_file_paths) > 0:
                                    # First file might be FAQ
                                    file_key = local_file_paths[idx].get('filename_key', f'file_{idx}')
                                else:
                                    file_key = local_file_paths[idx].get('filename_key', f'file_{idx}') if idx < len(local_file_paths) else f'file_{idx}'
                                
                                file_ids_dict[file_key] = {
                                    "file_id": file_id,
                                    "filename": local_file_paths[idx].get('filename', file_key) if idx < len(local_file_paths) else file_key,
                                    "type": "user_file"
                                }
                            
                            async with get_db() as conn:
                                async with conn.cursor() as cursor:
                                    await cursor.execute(
                                        "UPDATE assistant_configs SET openai_file_ids = %s WHERE chatbot_id = %s",
                                        (json.dumps(file_ids_dict), chatbot_id),
                                    )
                                await conn.commit()
                        except Exception as db_error:
                            print(f"⚠️ Background: Non-critical DB error saving file IDs: {db_error}")
                        break
                    elif batch_status.status == "failed":
                        print(
                            f"❌ Background: File batch processing failed for chatbot {chatbot_id}"
                        )
                        break

                    await asyncio.sleep(2)  # Poll every 2 seconds

            except Exception as e:
                print(f"❌ Background: Failed to create file batch: {e}")

    except Exception as e:
        print(f"❌ Background: Error processing files for chatbot {chatbot_id}: {e}")
    finally:
        # Cleanup temp files
        for temp_path in temp_files_to_cleanup:
            try:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    print(f"🗑️ Background: Cleaned up temp file {temp_path}")
            except Exception as e:
                print(f"⚠️ Background: Failed to delete temp file {temp_path}: {e}")


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except:
        return len(text.split()) * 1.3


def generate_api_key(length: int = 32) -> str:
    characters = string.ascii_letters + string.digits
    api_key = "".join(secrets.choice(characters) for _ in range(length))
    return f"cb_{api_key}"


def get_test_cache_key(user_id: int, chatbot_id: int) -> str:
    return f"test:{user_id}:{chatbot_id}"


def get_cached_test_data(user_id: int, chatbot_id: int) -> Optional[dict]:
    try:
        cache_key = get_test_cache_key(user_id, chatbot_id)
        data = redis_client.get(cache_key)
        if data:
            logger.info(f"Test cache HIT for user {user_id}, chatbot {chatbot_id}")
            return json.loads(data)
        logger.info(f"Test cache MISS for user {user_id}, chatbot {chatbot_id}")
        return None
    except Exception as e:
        logger.error(f"Redis get error: {e}")
        return None


def cache_test_data(
    user_id: int, chatbot_id: int, assistant_id: str, thread_id: str, ttl: int = 3600
) -> bool:
    try:
        cache_key = get_test_cache_key(user_id, chatbot_id)
        data = json.dumps(
            {
                "assistant_id": assistant_id,
                "thread_id": thread_id,
                "cached_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        redis_client.setex(cache_key, ttl, data)
        logger.info(
            f"Cached test data for user {user_id}, chatbot {chatbot_id} (TTL: {ttl}s)"
        )
        return True
    except Exception as e:
        logger.error(f"Redis set error: {e}")
        return False


async def cleanup_test_session(user_id: int, chatbot_id: int) -> bool:
    cache_key = get_test_cache_key(user_id, chatbot_id)
    thread_id = None
    try:
        data = redis_client.get(cache_key)
        if data:
            cached_data = json.loads(data)
            thread_id = cached_data.get("thread_id")
            logger.info(f"Found thread_id {thread_id} in cache for cleanup.")
    except Exception as e:
        logger.error(f"Redis lookup error during cleanup for key {cache_key}: {e}")
    if thread_id:
        try:
            openai_client.beta.threads.delete(thread_id)
            logger.info(f"Deleted OpenAI thread: {thread_id}")
        except Exception as e:
            logger.warning(f"Failed to delete OpenAI thread {thread_id}: {e}")
    try:
        redis_client.delete(cache_key)
        logger.info(f"Deleted Redis key: {cache_key}")
        return True
    except Exception as e:
        logger.error(f"Redis deletion error for key {cache_key}: {e}")
        return False


async def insert_company(company_data: dict):
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:

                # SQL INSERT statement
                insert_sql = """
                INSERT INTO companies (
                    companyName,contact_email, websiteURL, industry, industryOther, description,
                    botName, greeting, botRestrictions,
                    website_data, prompt_snapshot, api_key, script , allowedDomains,
                    primaryColor, position, themeStyle, suggestedPrompts, 
                    coreFeatures, leadCaptureFields,
                    chatbotLanguage, logo_url, botAvatar, personaSelect, 
                    defaultFailResponse, botTypePreset, faq_data, appointment_settings
                ) VALUES (%s, %s,%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,%s,%s,%s,%s,%s,%s,%s,%s)
                """

                # Τα δεδομένα για εισαγωγή
                values = (
                    company_data["companyName"],
                    company_data["contactEmail"],
                    company_data["websiteURL"],
                    company_data["industry"],
                    company_data.get("industryOther", ""),
                    company_data["description"],
                    company_data["botName"],
                    company_data["greeting"],
                    company_data["botRestrictions"],
                    company_data["website_data"],
                    company_data["prompt_snapshot"],
                    company_data["api_key"],
                    company_data["script"],
                    company_data["allowedDomains"],
                    company_data.get("primaryColor", "#4f46e5"),
                    company_data.get("position", "Bottom Right"),
                    company_data.get("themeStyle", "Minimal"),
                    company_data.get("suggestedPrompts", ""),
                    json.dumps(company_data.get("coreFeatures", {})),
                    json.dumps(company_data.get("leadCaptureFields", {})),
                    company_data.get("chatbotLanguage", ""),
                    company_data.get("logo_url", ""),  # ✅ εδώ
                    company_data.get("botAvatar", ""),
                    company_data.get("personaSelect", ""),
                    company_data.get("defaultFailResponse", ""),
                    company_data.get("botTypePreset", ""),
                    company_data.get("faq_data", "[]"),
                    company_data.get("appointment_settings", "{}"),
                )

                await cursor.execute(insert_sql, values)
                await conn.commit()

                inserted_id = cursor.lastrowid
                print(
                    f"Company '{company_data['companyName']}' inserted successfully (id={inserted_id})"
                )
                return inserted_id

    except Exception as e:
        print(f"Database error: {str(e)}")
        return False


async def get_company_by_api_key(api_key: str):

    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                select_sql = "SELECT * FROM companies WHERE api_key = %s"
                await cursor.execute(select_sql, (api_key,))

                row = await cursor.fetchone()
                if row:
                    # Μετατρέπουμε το Row σε dictionary
                    return dict(row)
                else:
                    return None

    except Exception as e:
        print(f"Database error: {str(e)}")
        return None


async def update_company_script(company_name: str, new_script: str):
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:

                update_sql = "UPDATE companies SET script = %s WHERE companyName = %s"
                await cursor.execute(update_sql, (new_script, company_name))
                await conn.commit()

                if cursor.rowcount > 0:
                    print(f"✅ Script updated for company '{company_name}'")
                    return True
                else:
                    print(f"❌ Company '{company_name}' not found")
                    return False

    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return False


###κλάσεις###
class ChatMessage(BaseModel):
    message: str
    thread_id: Optional[str] = None
    chatbot_id: Optional[int] = None


class ChatResponse(BaseModel):
    response: str
    timestamp: str


class CompanyInfo(BaseModel):
    companyName: str
    contactEmail: Optional[EmailStr] = None
    websiteURL: Optional[HttpUrl] = None
    industry: str
    industryOther: Optional[str] = None
    description: str
    greeting: str
    botName: str
    botRestrictions: str
    allowedDomains: str
    primaryColor: Optional[str] = "#4f46e5"
    position: Optional[str] = "Bottom Right"
    themeStyle: Optional[str] = "Minimal"
    suggestedPrompts: Optional[str] = ""
    coreFeatures: Optional[dict] = Field(default_factory=dict)
    leadCaptureFields: Optional[dict] = Field(default_factory=dict)
    chatbotLanguage: Optional[str] = ""
    personaSelect: Optional[str] = ""
    defaultFailResponse: Optional[str] = ""
    botTypePreset: Optional[str] = ""
    faqItems: Optional[List[dict]] = Field(default_factory=list)
    appointmentSettings: Optional[dict] = Field(default_factory=dict)


class VerifyLoginOtpRequest(BaseModel):
    contact: str
    otp_code: str


class SendOtpRequest(BaseModel):
    contact: str
    method: Literal["email", "sms"]


openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
website_data_db: Dict[str, str] = {}

companies_db: Dict[str, CompanyInfo] = {}


class SendLoginOtpRequest(BaseModel):
    contact: str


class VerifyOtpRequest(BaseModel):
    contact: str
    method: Literal["email", "sms"]
    otp_code: str
    first_name: str
    last_name: str


async def get_current_user(auth_session_id: str = Cookie(None)):
    if not auth_session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        async with get_db() as conn:
            user_data = await get_user_from_session(conn, auth_session_id)
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def get_user_api_key(user_id: int) -> str:
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT api_key FROM user_chatbots 
                    WHERE user_id = %s 
                    ORDER BY created_at DESC 
                    LIMIT 1
                    """,
                    (user_id,),
                )
                result = await cursor.fetchone()

                if not result:
                    raise HTTPException(
                        status_code=404, detail="No chatbot found for this user"
                    )

                return result["api_key"]
    except Exception as e:
        logger.error(f"❌ Database error in get_user_api_key: {e}")  # ✅
        raise HTTPException(status_code=500, detail="Database query failed")


@router.post("/send-login-otp")
async def send_login_otp(request: SendLoginOtpRequest):
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT COUNT(*) as total FROM users")
                count = await cursor.fetchone()
                query = """
                    SELECT id, email, phone_number 
                    FROM users 
                    WHERE email = %s OR phone_number = %s
                """
                params = (request.contact, request.contact)
                await cursor.execute(query, params)
                user = await cursor.fetchone()
                if not user:
                    raise HTTPException(
                        status_code=404,
                        detail="Δεν βρέθηκε χρήστης με αυτό το στοιχείο επικοινωνίας",
                    )
                if user["email"] == request.contact:
                    method = "email"
                    verification = user["email"]
                elif user["phone_number"] == request.contact:
                    method = "sms"
                    verification = user["phone_number"]
                else:
                    raise HTTPException(status_code=400, detail="Invalid contact")
            otp_code = await create_otp_entry(conn, verification, purpose="login")
        from auth import send_otp_to_contact

        send_otp_to_contact(verification, otp_code, method, purpose="login")
        return {
            "status": "success",
            "message": "Κωδικός OTP στάλθηκε",
            "contact": verification,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-login-otp")
async def verify_login_otp(response: Response, request: VerifyLoginOtpRequest):
    """
    Επαληθεύει OTP για login (async έκδοση).
    """
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                # ✅ 1. Βρες τον χρήστη
                await cursor.execute(
                    """
                    SELECT id, email, phone_number 
                    FROM users 
                    WHERE email = %s OR phone_number = %s
                    """,
                    (request.contact, request.contact),
                )
                user = await cursor.fetchone()
                if not user:
                    raise HTTPException(status_code=404, detail="Χρήστης δεν βρέθηκε")

                user_id = user["id"]
                verification = (
                    user["email"]
                    if user["email"] == request.contact
                    else user["phone_number"]
                )

            # ✅ 2. Επαλήθευση OTP
            result = await verify_and_consume_otp(
                conn,
                verification=verification,
                purpose="login",
                otp_code=request.otp_code,
                max_attempts=5,
            )

            if not result["ok"]:
                error_messages = {
                    "no_active_code": "Δεν βρέθηκε ενεργός κωδικός OTP",
                    "too_many_attempts": "Πάρα πολλές προσπάθειες. Ζήτησε νέο OTP",
                    "expired": "Ο κωδικός έχει λήξει",
                    "invalid_code": "Λάθος κωδικός OTP",
                }
                raise HTTPException(
                    status_code=400,
                    detail=error_messages.get(result["reason"], "Η επαλήθευση απέτυχε"),
                )

            # ✅ 3. Δημιουργία session
            auth_session_id = await create_auth_session(conn, user_id, ttl_hours=24)

        # ✅ Cookie
        response.set_cookie(
            key="auth_session_id",
            value=auth_session_id,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=86400,
            path="/",
        )

        logger.info(f"User {user_id} logged in successfully")

        return {
            "status": "success",
            "message": "Η σύνδεση ολοκληρώθηκε",
            "contact": request.contact,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Σφάλμα επαλήθευσης login OTP: {str(e)}")
        raise HTTPException(status_code=500, detail="Η σύνδεση απέτυχε")


@router.post("/send-otp")
async def send_otp(request: SendOtpRequest):
    """
    Στέλνει OTP για signup (email ή SMS).
    """
    try:
        # Έλεγχος αν ο χρήστης υπάρχει ήδη

        async with get_db() as conn:
            async with conn.cursor() as cursor:
                if request.method == "email":
                    await cursor.execute(
                        "SELECT id FROM users WHERE email = %s", (request.contact,)
                    )
                else:  # sms
                    await cursor.execute(
                        "SELECT id FROM users WHERE phone_number = %s",
                        (request.contact,),
                    )

                if await cursor.fetchone():
                    raise HTTPException(
                        status_code=400,
                        detail="Το στοιχείο επικοινωνίας είναι ήδη καταχωρημένο",
                    )

            otp_code = await create_otp_entry(conn, request.contact, purpose="register")
            print(f"🔐 DEBUG OTP (: {otp_code}")

        # Αποστολή στο σωστό μέσο
        from auth import send_otp_to_contact

        send_otp_to_contact(
            request.contact, otp_code, request.method, purpose="register"
        )

        return {
            "status": "success",
            "message": f"Κωδικός OTP στάλθηκε στο {'email' if request.method == 'email' else 'τηλέφωνο'}",
            "contact": request.contact,
            "method": request.method,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Σφάλμα αποστολής OTP: {str(e)}")
        raise HTTPException(status_code=500, detail="Η αποστολή OTP απέτυχε")


@router.post("/verify-otp")
async def verify_otp(response: Response, request: VerifyOtpRequest):
    """
    Επαληθεύει το OTP, δημιουργεί user και session, στέλνει cookie.
    """
    try:
        async with get_db() as conn:
            # 1) Επαλήθευση OTP
            result = await verify_and_consume_otp(
                conn,
                verification=request.contact,
                purpose="register",
                otp_code=request.otp_code,
                max_attempts=5,
            )

            if not result["ok"]:
                error_messages = {
                    "no_active_code": "Δεν βρέθηκε ενεργός κωδικός OTP",
                    "too_many_attempts": "Πάρα πολλές προσπάθειες. Ζήτησε νέο OTP",
                    "expired": "Ο κωδικός έχει λήξει",
                    "invalid_code": "Λάθος κωδικός OTP",
                }
                raise HTTPException(
                    status_code=400,
                    detail=error_messages.get(result["reason"], "Η επαλήθευση απέτυχε"),
                )

            # 2) Δημιουργία χρήστη
            async with conn.cursor() as cursor:
                if request.method == "email":
                    await cursor.execute(
                        """
                        INSERT INTO users (
                            email, phone_number, first_name, last_name,
                            preferred_otp_method, email_verified, phone_verified,
                            created_at, updated_at
                        )
                        VALUES (%s, NULL, %s, %s, 'email', 1, 0, %s, %s)
                        """,
                        (
                            request.contact,
                            request.first_name,
                            request.last_name,
                            now_utc(),
                            now_utc(),
                        ),
                    )
                else:  # sms
                    await cursor.execute(
                        """
                        INSERT INTO users (
                            email, phone_number, first_name, last_name,
                            preferred_otp_method, email_verified, phone_verified,
                            created_at, updated_at
                        )
                        VALUES (NULL, %s, %s, %s, 'sms', 0, 1, %s, %s)
                        """,
                        (
                            request.contact,
                            request.first_name,
                            request.last_name,
                            now_utc(),
                            now_utc(),
                        ),
                    )

                user_id = cursor.lastrowid

            # Commit εισαγωγής
            await conn.commit()

            # 3) Δημιουργία session
            auth_session_id = await create_auth_session(conn, user_id, ttl_hours=24)

        # 4) Cookie (εκτός DB context)
        response.set_cookie(
            key="auth_session_id",
            value=auth_session_id,
            httponly=True,
            secure=False,  # βάλε True σε production (HTTPS)
            samesite="lax",
            max_age=86400,
            path="/",
        )

        logger.info(f"User {user_id} registered and session created")

        return {
            "status": "success",
            "message": "Ο χρήστης εγγράφηκε επιτυχώς",
            "contact": request.contact,
            "method": request.method,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Σφάλμα επαλήθευσης OTP: {str(e)}")
        raise HTTPException(status_code=500, detail="Η επαλήθευση OTP απέτυχε")


@router.post("/logout")
async def logout(response: Response, auth_session_id: str = Cookie(None)):
    """
    Αποσύνδεση χρήστη - διαγραφή session
    """
    if auth_session_id:
        async with get_db() as conn:
            await delete_session(conn, auth_session_id)

    # Clear cookie
    response.delete_cookie(key="auth_session_id", path="/")

    return {"status": "success", "message": "Logged out successfully"}


@router.get("/check-session")
async def check_session(user_data: dict = Depends(get_current_user)):
    return {"status": "ok", "user_id": user_data["user_id"]}


###chat###
@router.post("/chat")
async def chat_with_company(
    message_data: ChatMessage,
    user_data: dict = Depends(get_current_user),
):
    # === TIMING START ===
    start_time = time.time()
    user_id = user_data["user_id"]
    logger.info(f"🚀 Chat request from user_id: {user_id}")

    ### βρίσκει το chatbot του χρήστη ###
    chatbot_id = message_data.chatbot_id
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            if chatbot_id:
                # Ownership check
                await cursor.execute(
                    "SELECT api_key FROM user_chatbots WHERE user_id=%s AND chatbot_id=%s LIMIT 1",
                    (user_id, chatbot_id),
                )
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(
                        status_code=403, detail="Access denied for this chatbot"
                    )
                api_key = row["api_key"]
            else:
                # Fallback: τελευταίο bot του χρήστη (παλιά συμπεριφορά)
                await cursor.execute(
                    """
                    SELECT api_key FROM user_chatbots
                    WHERE user_id=%s
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (user_id,),
                )
                row = await cursor.fetchone()
                if not row:
                    raise HTTPException(
                        status_code=404, detail="No chatbot found for this user"
                    )
                api_key = row["api_key"]

    # παιρνει τα δεδομένα της εταιρίας από το api_key
    company_data = await get_company_by_api_key(api_key)
    if not company_data:
        raise HTTPException(status_code=403, detail="Invalid API key")

    companyName = company_data["companyName"]
    logger.info(f"✅ Chat request for company: {companyName}")

    cached_data = get_cached_test_data(user_id, chatbot_id)

    if cached_data:
        # ✅ Cache HIT - χρησιμοποιούμε cached assistant_id
        assistant_id = cached_data["assistant_id"]
        existing_thread_id = cached_data.get("thread_id")
        logger.info(f"✅ Cache HIT: Using cached assistant {assistant_id}")

    else:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT assistant_id FROM assistant_configs WHERE chatbot_id=%s",
                    (chatbot_id,),
                )
                config_row = await cursor.fetchone()
                if not config_row:
                    raise HTTPException(
                        status_code=404, detail="Assistant not configured"
                    )

                assistant_id = config_row["assistant_id"]

        existing_thread_id = None

    logger.info(f"🤖 Using assistant: {assistant_id}")

    # Get or create thread
    thread_id = await get_or_create_thread(message_data.thread_id or existing_thread_id)
    logger.info(f"💬 Thread ID: {thread_id}")

    if not cached_data:
        # Πρώτο μήνυμα (cache MISS) - αποθηκεύουμε στο Redis
        cache_test_data(user_id, chatbot_id, assistant_id, thread_id)
        logger.info(f"💾 Cached assistant & thread for future requests")

    # Add user message to thread
    await add_message_to_thread(
        thread_id=thread_id, message=message_data.message, role="user"
    )

    citation_pattern = re.compile(r"【[^】]*】")

    async def stream_response():
        try:
            api_start_time = time.time()
            logger.info("🔄 Starting Assistant API call...")

            chunks = []
            first_chunk_time = None

            # Stream από Assistant
            async for content_chunk in run_assistant_on_thread(thread_id, assistant_id):
                if first_chunk_time is None:
                    first_chunk_time = time.time()
                    logger.info(
                        f"⚡ First chunk received: {first_chunk_time - api_start_time:.3f}s"
                    )

                cleaned_chunk = citation_pattern.sub("", content_chunk)
                chunks.append(cleaned_chunk)
                yield f"data: {json.dumps({'response': cleaned_chunk, 'timestamp': datetime.now().isoformat()})}\n\n"

                await asyncio.sleep(0.05)

            yield "data: [DONE]\n\n"
            full_response = "".join(chunks)
            logger.info(f"🏁 Response length: {len(full_response)} characters")

            total_time = time.time() - start_time
            streaming_time = time.time() - api_start_time
            logger.info(f"🏁 Total request time: {total_time:.3f}s")
            logger.info(f"🏁 OpenAI streaming time: {streaming_time:.3f}s")

        except Exception as e:
            logger.error(f"❌ Stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    streaming_response = StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
    return streaming_response


@router.post("/create_chatbot")
async def create_chatbot_unified(
    background_tasks: BackgroundTasks,
    user_data: dict = Depends(get_current_user),
    company_info: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    logo: UploadFile = File(None),  # ← Company logo
    botAvatar: UploadFile = File(None),  # ← Bot avatar
):
    try:
        print("=" * 60)
        print("🚀 create_chatbot_unified endpoint called!")
        print(f"📋 User: {user_data}")
        print(f"📄 company_info raw: {company_info[:200]}...")
        print("=" * 60)

        # Parse το JSON string
        company_data = json.loads(company_info)
        # Δημιουργία CompanyInfo object με validation
        company_info_obj = CompanyInfo(**company_data)

        companies_db[company_info_obj.companyName] = company_info_obj

        # Process FAQ data
        faq_items = company_data.get("faqItems", [])

        # Convert FAQ to text format for system prompt
        faq_text = ""
        if faq_items:
            faq_text = "\n=== FAQ SECTION ===\n"
            for item in faq_items:
                faq_text += (
                    f"Q: {item.get('question', '')}\nA: {item.get('answer', '')}\n\n"
                )

        logo_data = ""
        if logo:
            logo_content = await logo.read()
            logo_base64 = base64.b64encode(logo_content).decode("utf-8")
            logo_data = f"data:{logo.content_type};base64,{logo_base64}"

        # Handle bot avatar
        bot_avatar_data = ""
        if botAvatar:
            avatar_content = await botAvatar.read()
            avatar_base64 = base64.b64encode(avatar_content).decode("utf-8")
            bot_avatar_data = f"data:{botAvatar.content_type};base64,{avatar_base64}"

        ### SCRAPE WEBSITE ###
        website_data = ""
        if company_info_obj.websiteURL:  # ← Έλεγχος αν υπάρχει URL
            try:
                print(f"🔄 Starting scraping for: {company_info_obj.websiteURL}")
                scraper = ScrapingController()
                scraped_data = await scraper.scrape_website_async(
                    str(company_info_obj.websiteURL)
                )

                print(f"📝 Extracting plain text content...")
                structured_content_parts = []
                main_page_data = scraped_data.get("main_page", {})
                main_url = main_page_data.get(
                    "url"
                )  # <-- Παίρνουμε το URL της κύριας σελίδας

                # 1. Κύρια σελίδα (main_page)
                if main_page_data.get("status") == "success" and main_page_data.get(
                    "plain_text"
                ):
                    text = main_page_data["plain_text"].strip()

                    # ΔΟΜΗ: SOURCE PAGE: **URL**
                    structured_content_parts.append(
                        f"\n\n==========================================\n"
                        f"SOURCE PAGE: **{main_page_data['url']}**\n"
                        f"==========================================\n\n"
                        f"{text}"
                    )

                # 2. Ανακαλυφθέντα links (discovered_links: Λίστα από λεξικά)
                for link_data in scraped_data.get("discovered_links", []):
                    link_url = link_data.get("url")

                    # 🛑 ΝΕΟΣ ΕΛΕΓΧΟΣ: Παρακάμπτουμε το διπλότυπο link
                    if link_url == main_url:
                        logger.warning(
                            f"⚠️ Skipping duplicate self-referencing link: {link_url}"
                        )
                        continue

                    if link_data.get("status") == "success" and link_data.get(
                        "plain_text"
                    ):
                        text = link_data["plain_text"].strip()

                        # ΔΟΜΗ: SOURCE PAGE: **URL**
                        structured_content_parts.append(
                            f"\n\n------------------------------------------\n"
                            f"SOURCE PAGE: **{link_url}**\n"
                            f"------------------------------------------\n\n"
                            f"{text}"
                        )

                # 3. Συγχώνευση όλων των τμημάτων στο τελικό website_data
                website_data = "".join(structured_content_parts)

                # Η γραμμή αυτή παραμένει
                website_data_db[company_info_obj.companyName] = website_data

            except Exception as e:
                print(
                    f"⚠️ Website scraping failed (continuing without website data): {e}"
                )
                # Δεν κάνουμε raise - απλά συνεχίζουμε με κενό website_data
                website_data_db[company_info_obj.companyName] = ""
        else:

            website_data_db[company_info_obj.companyName] = ""

        ### END SCRAPE WEBSITE ###

        #  Προετοιμασία files για OpenAI (async processing) ===
        local_file_paths = []  # λίστα με dictionaries που περιγράφουν κάθε αρχείο
        temp_files_to_cleanup = []  # λίστα για να ξέρω ποια temp files να διαγράψεις

        # Save uploaded files to temp directory for background processing
        for file in files:
            temp_file = NamedTemporaryFile(delete=False, suffix=f"_{file.filename}")
            await file.seek(0)
            content = await file.read()
            temp_file.write(content)
            temp_file.close()

            local_file_paths.append(
                {
                    "path": temp_file.name,
                    "type": "user_file",
                    "filename_key": file.filename,
                }
            )
            temp_files_to_cleanup.append(temp_file.name)

        # Save FAQ to temp file if present
        if faq_text and faq_text.strip():
            tmp_faq = NamedTemporaryFile(delete=False, suffix="_faq_data.txt")
            tmp_faq.write(faq_text.encode("utf-8"))
            tmp_faq.close()

            local_file_paths.append(
                {
                    "path": tmp_faq.name,
                    "type": "user_file",
                    "filename_key": "faq_data",
                }
            )
            temp_files_to_cleanup.append(tmp_faq.name)

        # === Create vector store with website data only (instant) ===
        try:
            # Process only website data synchronously (fast)
            knowledge_result = await to_thread.run_sync(
                process_knowledge_blocking,
                company_info_obj.companyName,
                website_data,
                [],  # Empty list - no files yet
            )
            vector_store_id = knowledge_result["vector_store_id"]
            openai_file_ids = []  # Files will be added in background

        except Exception as e:
            # Cleanup temp files if vector store creation fails
            for temp_path in temp_files_to_cleanup:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            raise HTTPException(
                status_code=500, detail=f"Knowledge processing failed: {str(e)}"
            )

        # Δημιουργία API Key
        api_key = generate_api_key()

        # Δημιουργία System Prompt
        system_prompt = create_system_prompt(
            company_name=company_data.get("companyName", ""),
            bot_name=company_data.get("botName", ""),
            description=company_info_obj.description,
            personaSelect=company_info_obj.personaSelect,
            botRestrictions=company_info_obj.botRestrictions,
            botTypePreset=company_data.get("botTypePreset", ""),
            coreFeatures=company_info_obj.coreFeatures or {},
            leadCaptureFields=company_info_obj.leadCaptureFields or {},
            appointmentSettings=company_data.get("appointmentSettings", {}),
        )

        ###===Δημιουργία Assistant ===###
        assistant_id = await create_assistant_async(
            company_name=company_info_obj.companyName,
            api_key=api_key,
            system_prompt=system_prompt,
            vector_store_id=vector_store_id,
        )

        # Δημιουργία Widget Script

        domain = os.getenv("WIDGET_DOMAIN")
        widget_script = (
            f'<script src="{domain}/api/public/widget.js?key={api_key}"></script>'
        )

        # Προετοιμασία δεδομένων για βάση
        company_data_for_db = {
            "companyName": company_info_obj.companyName,
            "contactEmail": company_data.get("contactEmail", ""),
            "websiteURL": str(company_info_obj.websiteURL),
            "industry": company_info_obj.industry,
            "industryOther": company_info_obj.industryOther or "",
            "description": company_info_obj.description,
            "botName": company_info_obj.botName,
            "greeting": company_info_obj.greeting,
            "botRestrictions": company_info_obj.botRestrictions,
            "website_data": website_data,
            "prompt_snapshot": system_prompt,
            "api_key": api_key,
            "script": widget_script,
            "allowedDomains": company_info_obj.allowedDomains,
            "primaryColor": company_info_obj.primaryColor,
            "position": company_info_obj.position,
            "themeStyle": company_info_obj.themeStyle,
            "suggestedPrompts": company_info_obj.suggestedPrompts,
            "coreFeatures": company_info_obj.coreFeatures,
            "leadCaptureFields": company_info_obj.leadCaptureFields,
            "chatbotLanguage": company_data.get("chatbotLanguage", ""),
            "logo_url": logo_data,
            "botAvatar": bot_avatar_data,
            "personaSelect": company_data.get("personaSelect", ""),
            "defaultFailResponse": company_data.get("defaultFailResponse", ""),
            "botTypePreset": company_data.get("botTypePreset", ""),
            "faq_data": json.dumps(faq_items),
            "appointment_settings": json.dumps(
                company_data.get("appointmentSettings", {})
            ),
        }

        # Αποθήκευση στη βάση δεδομένων

        company_id = await insert_company(company_data_for_db)
        if not company_id:
            raise HTTPException(
                status_code=500, detail="Failed to save company data to database"
            )

        # ===Αποθήκευση assistant config ===
        async with get_db() as conn:
            await create_assistant_config(
                conn=conn,
                chatbot_id=company_id,
                api_key=api_key,
                assistant_id=assistant_id,
                vector_store_id=vector_store_id,
                file_ids=openai_file_ids,
            )
            await conn.commit()
        print(f"✅ Assistant config saved for company_id={company_id}")

        # ====....=====#

        user_id = user_data["user_id"]
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "INSERT INTO user_chatbots (user_id, api_key, chatbot_id, created_at) VALUES (%s, %s, %s, %s)",
                    (user_id, api_key, company_id, now_utc()),
                )
            await conn.commit()
            logger.info(
                f"User {user_id} linked to chatbot api_key={api_key}, id={company_id}"
            )

        # === Schedule background file processing ===#
        if local_file_paths:
            print(
                f"📤 Scheduling background processing for {len(local_file_paths)} files"
            )
            background_tasks.add_task(
                process_files_in_background,
                company_id,
                assistant_id,
                vector_store_id,
                local_file_paths,
                temp_files_to_cleanup,
            )
        else:
            # No files to process, cleanup immediately
            for temp_path in temp_files_to_cleanup:
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {temp_path}: {e}")
        # ===....===#

        return {
            "message": f"Chatbot created successfully for {company_info_obj.companyName}!",
            "chat_url": f"/widget/{company_info_obj.companyName}",
            "widget_script": widget_script,
            "chatbot_id": company_id,
            "api_key": api_key,
            "status": "success",
            "files_processing": len(local_file_paths)
            > 0,  # Indicate if files are being processed
        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Error creating chatbot: {str(e)}")


@router.get("/user-chatbots")
async def get_user_chatbots(user_data: dict = Depends(get_current_user)):
    """
    Επιστρέφει όλα τα chatbots του συνδεδεμένου χρήστη
    """
    user_id = user_data["user_id"]

    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT c.id, c.api_key, c.botName, c.description, 
                           c.industry, c.created_at, c.companyName, c.websiteURL
                    FROM user_chatbots uc
                    JOIN companies c ON uc.chatbot_id = c.id
                    WHERE uc.user_id = %s
                    ORDER BY uc.created_at DESC
                    """,
                    (user_id,),
                )
                chatbots = await cursor.fetchall()

        return {"chatbots": [dict(bot) for bot in chatbots]}

    except Exception as e:
        logger.error(f"Error fetching user chatbots: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chatbots")


@router.get("/chatbot/{chatbot_id}")
async def get_chatbot(chatbot_id: int, user_data: dict = Depends(get_current_user)):
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            # ownership check μέσω user_chatbots αν ήδη το έχεις
            await cursor.execute("SELECT * FROM companies WHERE id=%s", (chatbot_id,))
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Chatbot not found")
        bot = dict(row)

        # ✅ Κανονικοποίηση JSON πεδίων
        for key in (
            "coreFeatures",
            "leadCaptureFields",
            "faq_data",
            "appointment_settings",
        ):
            val = bot.get(key)
            if isinstance(val, str) and val.strip():
                try:
                    bot[key] = json.loads(val)
                except Exception:
                    pass  # αν ήδη είναι object ή είναι άκυρο JSON, άφησέ το ως έχει
        bot["contactEmail"] = bot.get("contact_email", "")

    return bot


###edit###
@router.put("/update_chatbot/{chatbot_id}")
async def update_chatbot(
    chatbot_id: int,
    user_data: dict = Depends(get_current_user),
    company_info: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    logo: UploadFile = File(None),
    botAvatar: UploadFile = File(None),
    rescrape: bool = Form(False),
    edited_website_data: str = Form(None),
):
    logger.info(
        f"Update request: user_id={user_data['user_id']}, chatbot_id={chatbot_id}"
    )
    temp_files_to_cleanup = []

    # 1) Ownership check & Fetch existing data
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT 1 FROM user_chatbots WHERE user_id=%s AND chatbot_id=%s",
                (user_data["user_id"], chatbot_id),
            )
            if not await cursor.fetchone():
                raise HTTPException(status_code=403, detail="Access denied")

            await cursor.execute(
                "SELECT website_data , api_key FROM companies WHERE id=%s",
                (chatbot_id,),
            )
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=404, detail="Chatbot not found in companies table"
                )

            stored_website_data = row["website_data"] or ""
            existing_api_key = row["api_key"]

    # 2) Parse input
    try:
        data = json.loads(company_info)
        logger.info("Parsed company_info successfully")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid company_info JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid company_info JSON")

    # 3) Validate required fields
    required_fields = ["companyName", "botName", "greeting"]
    for field in required_fields:
        value = data.get(field)
        if not value or (isinstance(value, str) and not value.strip()):
            logger.error(f"Missing or empty required field: {field}")
            raise HTTPException(
                status_code=400, detail=f"Required field {field} is missing or empty"
            )

    # 4) Build FAQ text
    faq_items = data.get("faqItems") or []
    faq_text = ""
    if faq_items:
        faq_text = "\n=== FAQ SECTION ===\n"
        for item in faq_items:
            q = (item.get("question") or "").strip()
            a = (item.get("answer") or "").strip()
            if q or a:
                faq_text += f"Q: {q}\nA: {a}\n\n"

    # 5) Handle image uploads
    logo_data = None
    if logo:
        content = await logo.read()
        logo_data = f"data:{logo.content_type};base64,{base64.b64encode(content).decode('utf-8')}"

    avatar_data = None
    if botAvatar:
        content = await botAvatar.read()
        avatar_data = f"data:{botAvatar.content_type};base64,{base64.b64encode(content).decode('utf-8')}"

    # 7) Website Data - 3 options
    if rescrape:
        website_url = str(data.get("websiteURL") or "").strip()

        if not website_url:
            logger.info(
                "⚠️ Rescrape requested, but no website URL provided — skipping website scrape."
            )
            website_data_to_save = "no content"
        else:

            try:
                logger.info(f"🔄 Re-scraping website: {data.get('websiteURL')}")
                scraper = ScrapingController()
                scraped_data = await scraper.scrape_website_async(
                    str(data.get("websiteURL"))
                )

                structured_content_parts = []
                main_page_data = scraped_data.get("main_page", {})
                main_url = main_page_data.get("url")

                # 1) Κύρια σελίδα (main_page)
                if main_page_data.get("status") == "success" and main_page_data.get(
                    "plain_text"
                ):
                    text = main_page_data["plain_text"].strip()
                    structured_content_parts.append(
                        f"\n\n==========================================\n"
                        f"SOURCE PAGE: **{main_page_data['url']}**\n"
                        f"==========================================\n\n"
                        f"{text}"
                    )

                # 2) Ανακαλυφθέντα links (discovered_links)
                for link_data in scraped_data.get("discovered_links", []):
                    link_url = link_data.get("url")

                    # αποφυγή διπλότυπου self-reference
                    if link_url == main_url:
                        logger.warning(
                            f"⚠️ Skipping duplicate self-referencing link: {link_url}"
                        )
                        continue

                    if link_data.get("status") == "success" and link_data.get(
                        "plain_text"
                    ):
                        text = link_data["plain_text"].strip()
                        structured_content_parts.append(
                            f"\n\n------------------------------------------\n"
                            f"SOURCE PAGE: **{link_url}**\n"
                            f"------------------------------------------\n\n"
                            f"{text}"
                        )

                # 3) Συγχώνευση όλων των τμημάτων
                website_data_to_save = "".join(structured_content_parts)
                logger.info(
                    f"✅ Re-scraped structured website data length: {len(website_data_to_save)} characters"
                )

            except Exception as e:
                logger.error(f"❌ Re-scraping failed: {e}")
                raise HTTPException(
                    status_code=500, detail=f"Re-scraping failed: {str(e)}"
                )

    elif edited_website_data:
        website_data_to_save = edited_website_data
        logger.info(
            f"✏️ Using edited website data, length: {len(website_data_to_save)} characters"
        )
    else:
        website_data_to_save = stored_website_data
        logger.info(
            f"📦 Keeping existing website data, length: {len(stored_website_data)} characters"
        )

    # 8) Generate new system prompt
    try:
        prompt_snapshot = create_system_prompt(
            company_name=data.get("companyName", ""),
            bot_name=data.get("botName", ""),
            description=data.get("description", ""),
            personaSelect=data.get("personaSelect", ""),
            botRestrictions=data.get("botRestrictions", ""),
            botTypePreset=data.get("botTypePreset", ""),
            coreFeatures=data.get("coreFeatures") or {},
            leadCaptureFields=data.get("leadCaptureFields") or {},
            appointmentSettings=data.get("appointmentSettings") or {},
        )
    except Exception as e:
        logger.error(f"Failed to generate prompt_snapshot: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate prompt: {str(e)}"
        )

    # Update Assistant with new prompt
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT assistant_id FROM assistant_configs WHERE chatbot_id=%s",
                (chatbot_id,),
            )
            row = await cursor.fetchone()

            if row and row["assistant_id"]:
                from AI_assistant_helper import async_openai_client

                await async_openai_client.beta.assistants.update(
                    assistant_id=row["assistant_id"], instructions=prompt_snapshot
                )
                logger.info(f"✅ Updated Assistant prompt")

    updated_file_ids = None

    # 9.1) Ανάκτηση Vector Store ID και Υπαρχόντων Files IDs
    async with get_db() as conn_config:
        async with conn_config.cursor() as cursor_config:
            await cursor_config.execute(
                "SELECT vector_store_id, openai_file_ids FROM assistant_configs WHERE chatbot_id=%s",
                (chatbot_id,),
            )
            config_row = await cursor_config.fetchone()

            vector_store_id = config_row["vector_store_id"] if config_row else None
            existing_file_ids_raw = config_row["openai_file_ids"] if config_row else None
            
            # Handle both old list format and new dict format
            if existing_file_ids_raw:
                try:
                    parsed = json.loads(existing_file_ids_raw)
                    # If it's a list (old format), convert to empty dict
                    existing_file_ids = parsed if isinstance(parsed, dict) else {}
                except:
                    existing_file_ids = {}
            else:
                existing_file_ids = {}

    # 9.2) Δράση: Μόνο αν υπάρχει Vector Store ID ΚΑΙ (νέα αρχεία Ή rescrape/edit)
    if (
        files
        or rescrape
        or edited_website_data is not None
        or (faq_text and faq_text.strip())
    ):

        local_file_paths = []

        # 9.3) Προετοιμασία Local Files για Upload (αρχεία χρήστη)
        if files:
            for file in files:
                # Δημιουργία προσωρινού αρχείου (Χρησιμοποιούμε tempfile)
                temp_file = NamedTemporaryFile(delete=False, suffix=f"_{file.filename}")
                await file.seek(0)
                content = await file.read()
                temp_file.write(content)
                temp_file.close()

                local_file_paths.append(
                    {
                        "path": temp_file.name,
                        "type": "user_file",
                        "filename_key": file.filename,
                    }
                )
                temp_files_to_cleanup.append(temp_file.name)  # Προσθήκη για cleanup

        # 9.4) Εκτέλεση Blocking Update
        from AI_assistant_helper import update_vector_store_blocking

        try:
            logger.info("🔄 Running blocking Vector Store update...")

            knowledge_result = await to_thread.run_sync(
                update_vector_store_blocking,
                vector_store_id,
                existing_file_ids,
                (
                    website_data_to_save
                    if rescrape or (edited_website_data is not None)
                    else None
                ),
                local_file_paths,
                rescrape or (edited_website_data is not None),
                bool(faq_text.strip()) if faq_text else False,
                (faq_text if (faq_text and faq_text.strip()) else None),
            )

            updated_file_ids = knowledge_result["openai_file_ids"]
            logger.info(f"✅ Vector Store {vector_store_id} updated successfully.")

            for temp_path in temp_files_to_cleanup:
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {temp_path}: {e}")

            # 9.5) Ενημέρωση assistant_configs με τα νέα File IDs
            async with get_db() as conn_update:
                async with conn_update.cursor() as cursor_update:
                    await cursor_update.execute(
                        """
                        UPDATE assistant_configs SET openai_file_ids=%s, updated_at=NOW()
                        WHERE chatbot_id=%s
                        """,
                        (json.dumps(updated_file_ids), chatbot_id),
                    )
                await conn_update.commit()
            logger.info("✅ Updated assistant_configs with new file IDs.")

        except Exception as e:
            logger.error(f"❌ Knowledge processing failed during update: {e}")
            raise HTTPException(
                status_code=500, detail=f"Knowledge update failed: {str(e)}"
            )

    base_fields = [
        "companyName",
        "contact_email",
        "websiteURL",
        "industry",
        "industryOther",
        "description",
        "botName",
        "greeting",
        "botRestrictions",
        "allowedDomains",
        "primaryColor",
        "position",
        "themeStyle",
        "suggestedPrompts",
        "coreFeatures",
        "leadCaptureFields",
        "chatbotLanguage",
        "personaSelect",
        "defaultFailResponse",
        "botTypePreset",
        "faq_data",
        "appointment_settings",
        "prompt_snapshot",
        "website_data",
    ]

    set_clause = ", ".join([f"{field}=%s" for field in base_fields])

    if logo_data is not None:
        set_clause += ", logo_url=%s"
    if avatar_data is not None:
        set_clause += ", botAvatar=%s"

    update_sql = (
        f"UPDATE companies SET {set_clause}, updated_at=UTC_TIMESTAMP() WHERE id=%s"
    )

    # 10) Build params list
    params = [
        data.get("companyName"),
        data.get("contactEmail") or "",
        data.get("websiteURL"),
        data.get("industry"),
        data.get("industryOther") or "",
        data.get("description"),
        data.get("botName"),
        data.get("greeting"),
        data.get("botRestrictions") or "",
        data.get("allowedDomains") or "",
        data.get("primaryColor") or "#4f46e5",
        data.get("position") or "Bottom Right",
        data.get("themeStyle") or "Minimal",
        data.get("suggestedPrompts") or "",
        json.dumps(data.get("coreFeatures") or {}),
        json.dumps(data.get("leadCaptureFields") or {}),
        data.get("chatbotLanguage") or "",
        data.get("personaSelect") or "",
        data.get("defaultFailResponse") or "",
        data.get("botTypePreset") or "",
        json.dumps(faq_items),
        json.dumps(data.get("appointmentSettings") or {}),
        prompt_snapshot,
        website_data_to_save,
    ]

    if logo_data is not None:
        params.append(logo_data)
    if avatar_data is not None:
        params.append(avatar_data)

    params.append(chatbot_id)

    # 11) Execute UPDATE
    async with get_db() as conn:
        try:
            async with conn.cursor() as cursor:
                logger.info(f"Executing UPDATE for chatbot_id={chatbot_id}")

                # Test row existence
                await cursor.execute(
                    "SELECT id FROM companies WHERE id=%s", (chatbot_id,)
                )
                test_row = await cursor.fetchone()
                logger.info(f"Row existence test: {test_row}")

                # Execute UPDATE
                await cursor.execute(update_sql, tuple(params))

                if cursor.rowcount == 0:
                    logger.warning(f"No rows updated for chatbot_id: {chatbot_id}")
                    raise HTTPException(
                        status_code=404, detail="No chatbot found to update"
                    )

            await conn.commit()
            logger.info(
                f"Successfully updated chatbot {chatbot_id}, rows affected: {cursor.rowcount}"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Database update failed: {e}")
            import traceback

            traceback.print_exc()
            raise HTTPException(
                status_code=500, detail=f"Database update failed: {str(e)}"
            )

    return {"status": "ok", "chatbot_id": chatbot_id}


### παίρνει τα αρχεία που έχει ανεβάσει ο χρήστης για το συγκεκριμένο chatbot ###
@router.get("/files/{chatbot_id}")
async def get_chatbot_files(
    chatbot_id: int, user_data: dict = Depends(get_current_user)
):
    """
    Επιστρέφει τη λίστα των uploaded files για το chatbot.
    """
    try:
        # 1. Ownership check
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT 1 FROM user_chatbots WHERE user_id=%s AND chatbot_id=%s",
                    (user_data["user_id"], chatbot_id),
                )
                if not await cursor.fetchone():
                    raise HTTPException(status_code=403, detail="Access denied")

                # 2. Fetch assistant config
                await cursor.execute(
                    "SELECT openai_file_ids FROM assistant_configs WHERE chatbot_id=%s",
                    (chatbot_id,),
                )
                config_row = await cursor.fetchone()

                if not config_row:
                    raise HTTPException(
                        status_code=404, detail="Assistant config not found"
                    )

                openai_file_ids = json.loads(
                    config_row["openai_file_ids"]
                )  # Convert to dict or list

        # 3. Filter μόνο user files (όχι website_data)
        user_files = []
        
        # Handle both dict and list formats
        if isinstance(openai_file_ids, dict):
            for filename, file_data in openai_file_ids.items():
                if isinstance(file_data, dict) and file_data.get("type") == "user_file":
                    user_files.append(
                        {
                            "filename": file_data.get("filename", filename),
                            "uploaded_at": file_data.get("uploaded_at", ""),
                        }
                    )
        elif isinstance(openai_file_ids, list):
            # Old format: just list of file IDs, no metadata
            for file_id in openai_file_ids:
                user_files.append(
                    {
                        "filename": file_id,
                        "uploaded_at": "",
                    }
                )

        # 4. Sort by upload date (newest first)
        user_files.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)

        logger.info(f"📋 Retrieved {len(user_files)} files for chatbot_id={chatbot_id}")

        return {"files": user_files, "total_files": len(user_files)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch files: {str(e)}")


# route για διαγραφή αρχείου από το vector store ###
@router.delete("/files/{chatbot_id}/{filename}")
async def delete_chatbot_file(
    chatbot_id: int, filename: str, user_data: dict = Depends(get_current_user)
):
    """
    Διαγράφει ένα file από το chatbot's knowledge base.

    Args:
        chatbot_id: Το ID του chatbot
        filename: Το filename του file προς διαγραφή (όχι το file_id)
    """
    logger.info(
        f"🗑️ Delete file request: user_id={user_data['user_id']}, chatbot_id={chatbot_id}, filename={filename}"
    )

    try:
        # 1. Ownership check
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT 1 FROM user_chatbots WHERE user_id=%s AND chatbot_id=%s",
                    (user_data["user_id"], chatbot_id),
                )
                if not await cursor.fetchone():
                    raise HTTPException(status_code=403, detail="Access denied")

                # 2. Fetch assistant config
                await cursor.execute(
                    "SELECT vector_store_id, openai_file_ids FROM assistant_configs WHERE chatbot_id=%s",
                    (chatbot_id,),
                )
                config_row = await cursor.fetchone()

                if not config_row:
                    raise HTTPException(
                        status_code=404, detail="Assistant config not found"
                    )

                vector_store_id = config_row["vector_store_id"]
                openai_file_ids = json.loads(config_row["openai_file_ids"])

        # 3. Έλεγχος αν το file υπάρχει
        if filename not in openai_file_ids:
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found")

        # 4. Έλεγχος αν προσπαθεί να διαγράψει website_data (δεν επιτρέπεται)
        if openai_file_ids[filename].get("type") == "website":
            raise HTTPException(
                status_code=400,
                detail="Cannot delete website data. Use rescrape or edit instead.",
            )

        file_id = openai_file_ids[filename]["file_id"]

        # 5. Διαγραφή από OpenAI

        success = await to_thread.run_sync(
            delete_file_from_vector_store_blocking, vector_store_id, file_id
        )

        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to delete file from Vector Store"
            )

        # 6. Update το JSON στη βάση
        del openai_file_ids[filename]

        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE assistant_configs 
                    SET openai_file_ids=%s, updated_at=NOW()
                    WHERE chatbot_id=%s
                    """,
                    (json.dumps(openai_file_ids), chatbot_id),
                )
            await conn.commit()

        logger.info(f"✅ File '{filename}' deleted successfully")

        return {
            "status": "success",
            "message": f"File '{filename}' deleted successfully",
            "remaining_files": len(
                [f for f in openai_file_ids.values() if f.get("type") == "user_file"]
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


from calendar_helper import GoogleCalendarHelper


@router.get("/calendar-status")
async def calendar_status(user_data: dict = Depends(get_current_user)):
    """
    Ελέγχει αν το calendar είναι συνδεδεμένο για τον user's chatbot.
    """
    # παίρνει user_id
    user_id = user_data["user_id"]
    # ανοιγει βάση χρησιμοποιώντας user_id παίρνει api_key
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                SELECT api_key FROM user_chatbots 
                WHERE user_id = %s 
                ORDER BY created_at DESC 
                LIMIT 1
                """,
                (user_id,),
            )
            result = await cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="No chatbot found")
            api_key = result["api_key"]

    # object calendar_helper
    calendar_helper = GoogleCalendarHelper(api_key)

    # ελέγχει αν ο χρήστης είναι συνδεδεμένος με το calendar
    is_connected = await calendar_helper.load_credentials() is not None
    return {"connected": is_connected, "api_key": api_key}


@router.get("/calendar-status")
async def calendar_status(user_data: dict = Depends(get_current_user)):
    """
    Ελέγχει αν το calendar είναι συνδεδεμένο για τον user's chatbot.
    """
    # παίρνει user_id
    user_id = user_data["user_id"]
    # ανοιγει βάση χρησιμοποιώντας user_id παίρνει api_key
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                SELECT api_key FROM user_chatbots 
                WHERE user_id = %s 
                ORDER BY created_at DESC 
                LIMIT 1
                """,
                (user_id,),
            )
            result = await cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="No chatbot found")
            api_key = result["api_key"]

    # object calendar_helper
    calendar_helper = GoogleCalendarHelper(api_key)

    # ελέγχει αν ο χρήστης είναι συνδεδεμένος με το calendar
    is_connected = await calendar_helper.load_credentials() is not None
    return {"connected": is_connected, "api_key": api_key}


###analytics route ###
@router.get("/analytics/company")
async def get_company_analytics(
    chatbot_id: int | None = None,
    user_data: dict = Depends(get_current_user),
):
    """
    Επιστρέφει analytics για συγκεκριμένο chatbot του χρήστη (ή default),
    Today από Redis + Totals από MySQL (total_analytics).
    """
    try:
        user_id = user_data["user_id"]

        # ---------- 1) Βρες api_key (και προαιρετικά bot info) ----------
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                if chatbot_id:
                    # Παίρνουμε api_key του ΣΥΓΚΕΚΡΙΜΕΝΟΥ bot του χρήστη
                    await cursor.execute(
                        "SELECT api_key FROM user_chatbots WHERE user_id = %s AND chatbot_id = %s",
                        (user_id, chatbot_id),
                    )
                    row = await cursor.fetchone()
                    if not row:
                        raise HTTPException(
                            status_code=404, detail="Chatbot not found for this user"
                        )
                    api_key = row["api_key"] if isinstance(row, dict) else row[0]
                else:
                    # Default: πιο πρόσφατο bot του χρήστη
                    await cursor.execute(
                        "SELECT api_key, chatbot_id FROM user_chatbots WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
                        (user_id,),
                    )
                    row = await cursor.fetchone()
                    if not row:
                        raise HTTPException(
                            status_code=404, detail="No chatbots for this user"
                        )
                    api_key = row["api_key"] if isinstance(row, dict) else row[0]
                    chatbot_id = row["chatbot_id"] if isinstance(row, dict) else row[1]

                # Totals από total_analytics
                await cursor.execute(
                    "SELECT * FROM total_analytics WHERE api_key = %s",
                    (api_key,),
                )
                historical_data = await cursor.fetchone()

                # Bot info από companies (με βάση api_key)
                await cursor.execute(
                    "SELECT companyName, botName FROM companies WHERE api_key = %s",
                    (api_key,),
                )
                bot_info = await cursor.fetchone()

        # ---------- 2) Today από Redis ----------
        redis_client = get_redis_connection()
        redis_stats = redis_client.hgetall(f"stats:{api_key}")
        redis_ratings = redis_client.hgetall(f"ratings:{api_key}")
        redis_response_times = redis_client.hgetall(f"response_stats:{api_key}")

        # Parse today's data
        today_total_messages = int(redis_stats.get("total_messages", 0))
        today_user_messages = int(redis_stats.get("total_user_messages", 0))
        today_assistant_messages = int(redis_stats.get("total_assistant_messages", 0))
        today_sessions = int(redis_stats.get("total_sessions", 0))
        today_ratings_sum = int(redis_ratings.get("sum", 0))
        today_ratings_count = int(redis_ratings.get("count", 0))
        today_response_time_sum = float(redis_response_times.get("total_time", 0))
        today_avg_response_time = float(redis_response_times.get("avg", 0))
        active_sessions_count = redis_client.scard(f"active_sessions:{api_key}")
        last_message_timestamp = redis_client.hget(
            f"stats:{api_key}", "last_message_at"
        )

        # ---------- 3) Totals (historical + today) ----------
        if historical_data:
            hd = historical_data if isinstance(historical_data, dict) else {}
            historical_messages = hd.get("total_messages", 0)
            historical_user_messages = hd.get("total_user_messages", 0)
            historical_assistant_messages = hd.get("total_assistant_messages", 0)
            historical_sessions = hd.get("total_sessions", 0)
            historical_ratings_sum = hd.get("total_ratings_sum", 0)
            historical_ratings_count = hd.get("total_ratings_count", 0)
            historical_response_time_sum = float(hd.get("total_response_time_sum", 0.0))
        else:
            historical_messages = historical_user_messages = (
                historical_assistant_messages
            ) = historical_sessions = 0
            historical_ratings_sum = historical_ratings_count = 0
            historical_response_time_sum = 0.0

        total_messages = historical_messages + today_total_messages
        total_user_messages = historical_user_messages + today_user_messages
        total_assistant_messages = (
            historical_assistant_messages + today_assistant_messages
        )
        total_sessions = historical_sessions + today_sessions

        combined_ratings_sum = historical_ratings_sum + today_ratings_sum
        combined_ratings_count = historical_ratings_count + today_ratings_count
        total_avg_rating = (
            (combined_ratings_sum / combined_ratings_count)
            if combined_ratings_count > 0
            else 0
        )

        combined_response_time_sum = (
            historical_response_time_sum + today_response_time_sum
        )
        total_avg_response_time_seconds = (
            combined_response_time_sum / total_assistant_messages
            if total_assistant_messages > 0
            else 0
        )

        today_avg_rating = (
            (today_ratings_sum / today_ratings_count) if today_ratings_count > 0 else 0
        )

        # ---------- 4) Response ----------
        return {
            "today": {
                "messages": today_total_messages,
                "user_messages": today_user_messages,
                "assistant_messages": today_assistant_messages,
                "sessions": today_sessions,
                "avg_rating": round(today_avg_rating, 2),
                "ratings_count": today_ratings_count,
                "avg_response_time_seconds": round(today_avg_response_time, 2),
                "active_sessions": active_sessions_count,
                "last_message_at": last_message_timestamp,
            },
            "totals": {
                "messages": total_messages,
                "user_messages": total_user_messages,
                "assistant_messages": total_assistant_messages,
                "sessions": total_sessions,
                "avg_rating": round(total_avg_rating, 2),
                "ratings_count": combined_ratings_count,
                "avg_response_time_seconds": round(total_avg_response_time_seconds, 2),
            },
            "bot": {
                "company_name": (
                    (
                        bot_info["companyName"]
                        if isinstance(bot_info, dict)
                        else bot_info[0]
                    )
                    if bot_info
                    else "Unknown"
                ),
                "bot_name": (
                    (bot_info["botName"] if isinstance(bot_info, dict) else bot_info[1])
                    if bot_info
                    else "Chatbot"
                ),
                "chatbot_id": chatbot_id,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch analytics")


@router.delete("/delete_chatbot/{chatbot_id}")
async def delete_chatbot(chatbot_id: int, user_data: dict = Depends(get_current_user)):
    """
    Διαγράφει ένα chatbot ΜΟΝΟ αν ανήκει στον συνδεδεμένο χρήστη.
    Χρησιμοποιεί το FK (user_chatbots.chatbot_id → companies.id) με ON DELETE CASCADE,
    άρα αρκεί η διαγραφή από τον companies.
    """
    user_id = user_data["user_id"]

    async with get_db() as conn:
        async with conn.cursor() as cursor:
            # 1) Έλεγχος ιδιοκτησίας (ασφάλεια)
            try:
                await cursor.execute(
                    "SELECT 1 FROM user_chatbots WHERE user_id=%s AND chatbot_id=%s LIMIT 1",
                    (user_id, chatbot_id),
                )
                if not await cursor.fetchone():
                    # είτε δεν υπάρχει, είτε δεν ανήκει στον χρήστη
                    raise HTTPException(status_code=403, detail="Access denied")

                # 2) Διαγραφή από companies (το CASCADE καθαρίζει user_chatbots)
                await cursor.execute("DELETE FROM companies WHERE id=%s", (chatbot_id,))
                if cursor.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Chatbot not found")

                await conn.commit()
                logging.info(
                    "🗑️ Deleted chatbot_id=%s by user_id=%s", chatbot_id, user_id
                )
                return Response(status_code=204)

            except HTTPException:
                raise
            except Exception as e:
                logger.exception(f"❌ Delete failed for chatbot_id={chatbot_id}: {e}")
                await conn.rollback()
                raise HTTPException(status_code=500, detail="Delete failed")


class CleanupRequest(BaseModel):
    chatbot_id: int


@router.post("/cleanup-test-session")
async def cleanup_test_session_endpoint(
    data: CleanupRequest, user_data: dict = Depends(get_current_user)
):
    """
    Καθαρίζει test session - διαγράφει thread από OpenAI και Redis cache.
    Τώρα βρίσκει το thread_id από το Redis, καθιστώντας το ανθεκτικό.
    """
    try:
        user_id = user_data["user_id"]
        chatbot_id = data.chatbot_id
        logger.info(f"🧹 Cleanup request: user={user_id}, chatbot={chatbot_id}")

        # OWNERSHIP VERIFICATION #
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                # Έλεγχος αν το chatbot ανήκει στον χρήστη
                await cursor.execute(
                    """
                    SELECT 1 FROM user_chatbots 
                    WHERE user_id = %s AND chatbot_id = %s
                    LIMIT 1
                    """,
                    (user_id, chatbot_id),
                )

                if not await cursor.fetchone():
                    logger.warning(
                        f"⚠️ Access denied: user {user_id} doesn't own chatbot {chatbot_id}"
                    )
                    raise HTTPException(
                        status_code=403, detail="Access denied - chatbot not found"
                    )

        success = await cleanup_test_session(user_id, chatbot_id)

        if success:
            logger.info(
                f"✅ Cleanup successful for user {user_id}, chatbot {chatbot_id}"
            )
            return {"status": "ok", "message": "Test session cleaned up"}
        else:
            logger.warning(f"⚠️ Cleanup failed for user {user_id}, chatbot {chatbot_id}")
            # Επιστρέφουμε OK γιατί δεν θέλουμε να fail το frontend
            return {"status": "ok", "message": "Cleanup attempted"}

    except HTTPException:
        # Re-raise HTTP exceptions (403, etc.)
        raise

    except Exception as e:
        logger.error(f"❌ Cleanup error: {e}")
        # Επιστρέφουμε OK γιατί δεν θέλουμε να fail το frontend
        return {"status": "ok", "message": "Cleanup failed but will expire"}
