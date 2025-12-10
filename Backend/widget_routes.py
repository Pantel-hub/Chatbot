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
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

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

from scrapping_control2 import ScrapingController
from file_extractor import extract_text_from_files
from database_connection import get_db
from migration import migrate_daily_analytics
from create_system_prompt import create_system_prompt
from calendar_helper import GoogleCalendarHelper
from auth import (
    create_otp_entry,
    verify_and_consume_otp,
    send_otp_email,
    now_utc,
    create_auth_session,
    get_user_from_session,
    delete_session,
)
from redis_helper import redis_client, get_redis_connection
from AI_assistant_helper import (
    get_or_create_thread,
    add_message_to_thread,
    run_assistant_on_thread,
    get_assistant_id_by_api_key,
)
from AWS_HELPER import send_email

router = APIRouter()

templates = Jinja2Templates(directory="templates")

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except:
        # Fallback estimation
        return len(text.split()) * 1.3


# παιρνει στοιχεια της εταιριας χρησιμοποιώνατς api_key
async def get_company_by_api_key(api_key: str):
    """
    Αναζητά στοιχεία εταιρείας από τη βάση δεδομένων με API key
    Returns: dictionary με όλα τα στοιχεία ή None αν δεν βρεθεί
    """

    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT * FROM companies WHERE api_key = %s", (api_key,)
                )

                row = await cursor.fetchone()
                return dict(row) if row else None

    except Exception as e:
        logger.error(f"⚠️ Database error: {str(e)}")
        return None


# domain validation
def validate_domain(request: Request, allowedDomains: str) -> bool:
    """
    Ελέγχει αν το request προέρχεται από επιτρεπόμενο domain/URL
    Αγνοεί το πρωτόκολλο (http/https)
    """
    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")
    logger.info(f"🌐 Domain validation - Origin: '{origin}', Referer: '{referer}'")

    if not allowedDomains or allowedDomains.strip() == "":
        return True  # Αν δεν έχει ορίσει domains, επιτρέπει όλα
    logger.info(f"📋 Allowed domains: '{allowedDomains}'")

    # Parse allowed patterns - split με κόμματα, κενά, newlines
    allowed_patterns = []
    patterns = re.split(r"[,\s\n\r]+", allowedDomains)

    for pattern in patterns:
        pattern = pattern.strip()  # φτιάχνει τα κενά πριν και μετά
        if pattern:
            # Add protocol if missing για το parsing
            if not pattern.startswith(("http://", "https://")):
                pattern = "http://" + pattern

            parsed = urlparse(
                pattern
            )  # χρησιμοποιώ βιβλιοθήκη urlib.parse για διαχωρισμο του URL
            domain = parsed.netloc.lower()
            path = parsed.path.rstrip("/") or "/"

            allowed_patterns.append((domain, path))

    logger.info(f"🔍 Parsed allowed patterns: {allowed_patterns}")

    # Check request headers
    for header_url in [
        request.headers.get("origin", ""),
        request.headers.get("referer", ""),
    ]:
        if header_url:
            parsed = urlparse(header_url)
            req_domain = parsed.netloc.lower()
            req_path = parsed.path.rstrip("/") or "/"

            logger.info(
                f"🔍 Checking request domain: '{req_domain}', path: '{req_path}'"
            )

            for allowed_domain, allowed_path in allowed_patterns:
                if req_domain == allowed_domain:
                    # Αν το allowed_path είναι root ('/'), δεχόμαστε οποιοδήποτε path
                    if allowed_path == "/" or req_path.startswith(allowed_path):
                        logger.info(
                            f"✅ Domain validation passed: {req_domain} matches {allowed_domain}"
                        )
                        return True

    logger.info("❌ Domain validation failed: No matching domains found")
    return False


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatMessage(BaseModel):
    message: str
    history: List[Turn] = Field(default_factory=list)
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    timestamp: str


API_BASE = os.getenv("API_BASE")
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# Redis client για streams και sessions


def generate_session_id() -> str:
    """
    Δημιουργεί unique session ID κάθε φορά που την καλείς
    """
    return f"sess_{str(uuid.uuid4()).replace('-', '')[:16]}"


###========= redis διαχείρηση για assistant ========== ###


def get_cached_assistant_id(api_key: str) -> Optional[str]:
    """παίρνει assistant_id αν υπάρχει στο cache της redis"""
    try:
        cached = redis_client.get(f"assistant:{api_key}")
        if cached:
            logger.info(f"✅ Assistant ID cache HIT for {api_key[:10]}...")
        return cached
    except Exception as e:
        logger.error(f"❌ Redis get error: {e}")
        return None


def cache_assistant_id(api_key: str, assistant_id: str, ttl: int = 86400):
    """Αποθηκεύει assistant_id στο Redis με TTL."""
    try:
        redis_client.setex(f"assistant:{api_key}", ttl, assistant_id)
        logger.info(f"💾 Cached assistant_id for {api_key[:10]}... (TTL: {ttl}s)")
    except Exception as e:
        logger.error(f"❌ Redis set error: {e}")


def get_thread_for_session(api_key: str, session_id: str) -> Optional[str]:
    """
    Διαβάζει thread_id από Redis για συγκεκριμένο session.

    Returns:
        thread_id ή None
    """
    try:
        thread_id = redis_client.get(f"thread:{api_key}:{session_id}")
        if thread_id:
            logger.info(
                f"♻️ Thread cache HIT: {thread_id[:15]}... for session {session_id[:15]}..."
            )
        return thread_id
    except Exception as e:
        logger.error(f"❌ Redis get error: {e}")
        return None


def save_thread_for_session(
    api_key: str, session_id: str, thread_id: str, ttl: int = 1800
):
    """Αποθηκεύει thread_id στο Redis για session με TTL."""
    try:
        redis_client.setex(f"thread:{api_key}:{session_id}", ttl, thread_id)
        logger.info(
            f"💾 Saved thread {thread_id[:15]}... for session {session_id[:15]}... (TTL: {ttl}s)"
        )
    except Exception as e:
        logger.error(f"❌ Redis set error: {e}")


def publish_chat_event(
    session_id: str,
    role: str,
    content: str,
    company_name: str,
    api_key: str,
    response_time_ms: Optional[float] = None,
    first_chunk_s: Optional[float] = None,
) -> None:
    """
    η συνάρτηση παίρνει τις πληροφορίες ενός μηνύματος chat,
    τις συλλέγει σε ένα λεξικό και τις στέλνει σε ένα Redis
    Stream με την εντολή xadd,επιτρέποντας
    σε άλλες διεργασίες (καταναλωτές) να τις επεξεργαστούν ασύγχρονα.
    """
    event_data = {
        "event_id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": role,  # "user" ή "assistant"
        "content": content,
        "company_name": company_name,
        "api_key": api_key,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if response_time_ms is not None:
        event_data["response_time_ms"] = response_time_ms

    if first_chunk_s is not None:
        event_data["first_chunk_s"] = first_chunk_s

    # Στέλνει το event στο Redis Stream
    redis_client.xadd("chat_events", event_data)

    try:
        redis_client.hincrby(f"stats:{api_key}", "total_messages", 1)

        if role == "user":
            redis_client.hincrby(f"stats:{api_key}", "total_user_messages", 1)
        elif role == "assistant":
            redis_client.hincrby(f"stats:{api_key}", "total_assistant_messages", 1)

            # Ενημερώνει μέσο χρόνο απόκρισης
            if response_time_ms is not None:
                redis_client.hincrbyfloat(
                    f"response_stats:{api_key}", "total_time", response_time_ms / 1000
                )

                total_time = float(
                    redis_client.hget(f"response_stats:{api_key}", "total_time") or 0
                )
                assistant_count = int(
                    redis_client.hget(f"stats:{api_key}", "total_assistant_messages")
                    or 0
                )

                if assistant_count > 0:
                    new_avg = total_time / assistant_count
                    redis_client.hset(f"response_stats:{api_key}", "avg", new_avg)
        # last meessage time
        redis_client.hset(
            f"stats:{api_key}",
            "last_message_at",
            datetime.now(timezone.utc).isoformat(),
        )

    except Exception as e:
        logger.error(f"Failed to update counters: {e}")


def update_session_state(session_id: str, api_key: str, company_name: str) -> None:
    """
    Αυτή η συνάρτηση διαχειρίζεται την κατάσταση κάθε ενεργής συνομιλίας στο Redis.
    """
    session_key = f"session:{session_id}"

    # Atomic update με pipeline για thread safety
    pipe = redis_client.pipeline()
    pipe.hset(
        session_key,
        mapping={
            "api_key": api_key,
            "company_name": company_name,
            "last_activity": datetime.now(timezone.utc).isoformat(),
        },
    )
    pipe.hincrby(session_key, "total_messages", 1)
    pipe.expire(session_key, 1800)  # 30 λεπτά TTL

    # ΠΡΟΣΘΗΚΗ - Track active session για γρήγορο counting
    pipe.sadd(f"active_sessions:{api_key}", session_id)
    pipe.expire(f"active_sessions:{api_key}", 1800)  # 30 λεπτά TTL

    pipe.execute()


# widget chat
@router.post("/widget-chat")
async def chat_with_company(
    message_data: ChatMessage, request: Request, api_key: str = Query(...)
):
    """
    Chat endpoint με OpenAI Assistant API.
    Χρησιμοποιεί Vector Store για knowledge retrieval και thread persistence.
    """
    start_time = time.time()
    logger.info(f"🚀 Chat request started with API key {api_key}")

    try:
        # ========== 1. VALIDATION & COMPANY DATA ==========
        logger.info(f"[WIDGET_CHAT] 🚀 New chat request: api_key={api_key[:12]}...")

        company_data = await get_company_by_api_key(api_key)  # ✅ ASYNC
        if not company_data:
            raise HTTPException(status_code=403, detail="Invalid API key")

        if not validate_domain(request, company_data.get("allowedDomains", "")):
            raise HTTPException(status_code=403, detail="Domain not allowed")

        companyName = company_data["companyName"]

        if message_data.session_id is None:
            # Νέο session
            session_id = generate_session_id()
            redis_client.hincrby(f"stats:{api_key}", "total_sessions", 1)
            logger.info(f"🆕 New session created: {session_id}")
            session_exists = False
        else:
            # Client έστειλε session_id - ελέγχουμε αν υπάρχει στο Redis
            session_id = message_data.session_id

            # ✅ ΕΛΕΓΧΟΣ: Υπάρχει το session στο Redis;
            session_exists = bool(redis_client.exists(f"session:{session_id}"))

            if session_exists:
                logger.info(f"♻️ Continuing session: {session_id}")
            else:
                # Session expired! Treat as new
                session_id = generate_session_id()
                logger.info(
                    f"⚠️ Previous session expired - created new session: {session_id}"
                )
                redis_client.hincrby(f"stats:{api_key}", "total_sessions", 1)
        is_new_or_expired = not session_exists

        publish_chat_event(
            session_id=session_id,
            role="user",
            content=message_data.message,
            api_key=api_key,
            company_name=companyName,
        )

        # ========== 3. GET ASSISTANT ID (με cache) ==========
        assistant_id = get_cached_assistant_id(api_key)
        if not assistant_id:
            # Cache miss - Query database
            logger.info(
                f"🔍 Assistant cache MISS - querying database for {api_key[:10]}..."
            )
            assistant_id = await get_assistant_id_by_api_key(api_key)
            if not assistant_id:
                raise HTTPException(
                    status_code=500,
                    detail="Assistant not configured. Please configure your chatbot in the CMS.",
                )
            # Cache το assistant_id
            cache_assistant_id(api_key, assistant_id)
        logger.info(
            f"[WIDGET_CHAT] ✅ Using assistant_id={assistant_id} for api_key={api_key[:12]}..."
        )

        # ========== 4. GET OR CREATE THREAD (με cache) ==========
        thread_id = get_thread_for_session(api_key, session_id)
        if not thread_id:
            # Δημιουργία νέου thread
            logger.info(f"🆕 Creating new thread for session {session_id[:15]}...")
            thread_id = await get_or_create_thread()
            save_thread_for_session(api_key, session_id, thread_id, ttl=1800)
        else:
            # Reuse existing thread + Refresh TTL
            logger.info(f"♻️ Reusing thread {thread_id[:15]}...")
            save_thread_for_session(api_key, session_id, thread_id, ttl=1800)

        # ========== 5. ADD USER MESSAGE TO THREAD ==========
        user_message = message_data.message.strip()
        await add_message_to_thread(thread_id, user_message, role="user")
        logger.info(f"📝 Added user message to thread {thread_id[:15]}...")

        # ========== 6. STREAM ASSISTANT RESPONSE ==========

        async def stream_response():
            """Generator για streaming response από Assistant"""
            full_response = ""
            first_chunk_s = None

            citation_pattern = re.compile(r"【[^】]*】")

            try:
                # api_start_time = time.time()
                logger.info("🔄 Starting Assistant API streaming...")

                if is_new_or_expired:
                    yield f"data: {json.dumps({'session_id': session_id})}\n\n"

                # Stream chunks από Assistant

                async for chunk in run_assistant_on_thread(thread_id, assistant_id):

                    if first_chunk_s is None:
                        first_chunk_s = time.time() - start_time
                        print(f"first chunk comes in :{first_chunk_s} s")

                    cleaned_chunk = citation_pattern.sub("", chunk)
                    full_response += cleaned_chunk

                    # Stream στον client (SSE format)

                    await asyncio.sleep(0.05)

                    yield f"data: {json.dumps({'response': cleaned_chunk, 'timestamp': datetime.now().isoformat()})}\n\n"

                # Final message
                yield f"data: [DONE]\n\n"

                # Calculate response time
                response_time_ms = (time.time() - start_time) * 1000
                logger.info(
                    f"✅ Assistant response completed in {response_time_ms:.2f}ms"
                )
                logger.info(f"🏁 Response length: {len(full_response)} characters")

                # Publish assistant message event
                publish_chat_event(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    company_name=companyName,
                    api_key=api_key,
                    response_time_ms=response_time_ms,
                )

                # Update session state
                update_session_state(session_id, api_key, companyName)

                # Notify SSE subscribers that stats changed
                redis_client.publish(f"stats_updates:{api_key}", "updated")

                # Total time
                total_time = time.time() - start_time
                logger.info(f"🏁 Total request time: {total_time:.3f}s")

            except Exception as e:
                logger.error(f"❌ Assistant streaming error: {e}")
                import traceback

                traceback.print_exc()
                yield f"data: {json.dumps({'error': 'Assistant error occurred'})}\n\n"

        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat error: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/widget.js")
async def serve_widget(request: Request, key: str = Query(...)):
    try:
        company_data = await get_company_by_api_key(key)
        if not company_data:
            raise HTTPException(status_code=403, detail="Invalid API key")
        # Load leadForm.js content
        try:
            with open("templates/leadForm.js", "r", encoding="utf-8") as f:
                lead_form_js = f.read()
        except FileNotFoundError:
            lead_form_js = "console.warn('leadForm.js not found');"

        # load appointmentForm.js
        try:
            with open("templates/appointmentForm.js", "r", encoding="utf-8") as f:
                appointment_form_js = f.read()
        except FileNotFoundError:
            appointment_form_js = "console.warn('appointmentForm.js not found');"

        response = templates.TemplateResponse(
            "widget.js.j2",
            {
                "request": request,
                "company_display_name": company_data["botName"],
                "greeting": company_data["greeting"],
                "api_key": key,
                "api_base": API_BASE,
                "primary_color": company_data["primaryColor"],
                "appointment_form_js": appointment_form_js,
                "lead_form_js": lead_form_js,
                "bot_avatar": company_data.get("botAvatar", ""),
            },
            media_type="application/javascript",
        )

        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        return response

    except Exception as e:
        print(f"⚠️ Widget error: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Widget generation failed:{str(e)}"
        )


# Αξιολόγηση
@router.post("/rating")
async def rating(request: Request, api_key: str = Query(...), data: dict = Body(...)):
    try:
        company_data = await get_company_by_api_key(api_key)
        if not company_data:
            return {"status": "error", "message": "invalid api key"}

        # Domain validation
        if not validate_domain(request, company_data.get("allowedDomains", "")):
            return {"status": "error", "message": "domain not allowed"}

        rating_value = int(data.get("rating", 0))
        session_id = data.get("session_id")

        if not (1 <= rating_value <= 5):
            return {"status": "error", "message": "invalid rating"}

        # Αποθήκευση counters στη Redis
        redis_client.hincrby(f"ratings:{api_key}", "count", 1)
        redis_client.hincrby(f"ratings:{api_key}", "sum", rating_value)

        # (προαιρετικά) αν θες να ξέρεις και ποιο session έδωσε rating:
        redis_client.set(f"rated:{session_id}", "1", ex=1800)  # TTL 30 λεπτά

        return {"status": "ok", "message": "rating stored"}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# έλεγχος αν έχει αξιολόγησει ο χρήστης
@router.get("/has_rated")
async def has_rated(api_key: str, session_id: str):
    """
    Επιστρέφει true αν το συγκεκριμένο session έχει ήδη δώσει rating
    """
    has_rated = bool(redis_client.get(f"rated:{session_id}"))
    return {"hasRated": has_rated}


@router.post("/submit-lead")
async def submit_lead(request: Request, api_key: str = Query(...)):
    try:
        company_data = await get_company_by_api_key(api_key)
        if not company_data:
            raise HTTPException(status_code=403, detail="Invalid API key")

        # Domain validation
        if not validate_domain(request, company_data.get("allowedDomains", "")):
            raise HTTPException(status_code=403, detail="Domain not allowed")

        # Parse JSON body
        body = await request.json()
        lead_data = body.get("leadData", {})
        company_name = body.get("companyName", company_data["companyName"])

        # Log lead capture (for now just console, later can save to database)
        # Log lead capture
        logger.info(f"📝 Lead captured for {company_name}: {lead_data}")

        # Δημιουργία email περιεχομένου
        bot_name = company_data.get("botName", "Chatbot")
        subject = f"Νέο Lead από το chatbot {bot_name}"

        # Δημιουργία HTML body με τα πεδία
        html_body = f"""
        <h2>Νέο Lead από το chatbot {bot_name}</h2>
        <hr>
        """

        # Δημιουργία Text body (για fallback)
        text_body = f"Νέο Lead από το chatbot {bot_name}\n\n"

        # Προσθήκη κάθε πεδίου που συμπλήρωσε ο χρήστης
        for field_name, field_value in lead_data.items():
            html_body += f"<p><strong>{field_name}:</strong> {field_value}</p>\n"
            text_body += f"{field_name}: {field_value}\n"

        # Προσθήκη timestamp
        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        html_body += f"<hr><p><small>Ημερομηνία υποβολής: {timestamp}</small></p>"
        text_body += f"\nΗμερομηνία υποβολής: {timestamp}"

        # Αποστολή email στην εταιρεία
        company_email = (
            company_data.get("contact_email")
            or company_data.get("leads_email")
            or company_data.get("notification_email")
        )

        if company_email:
            email_result = send_email(
                to_email=company_email,
                subject=subject,
                body_text=text_body,
                body_html=html_body,
            )

            if not email_result.get("ok"):
                logger.error(
                    f"❌ Failed to send lead email: {email_result.get('error')}"
                )
                # Δεν κάνουμε raise - δεν θέλουμε να χάσουμε το lead
        else:
            logger.warning(f"No email configured for company {company_name}")

        return {"status": "success", "message": "Lead data received"}

    except Exception as e:
        logger.error(f"Lead submission error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save lead data")


# New endpoint: Get booked appointments for a date
@router.get("/booked-appointments/{api_key}")
async def get_booked_appointments(api_key: str, date: str = Query(...)):
    """
    Returns a list of booked appointments (events) for the given date and api_key.
    """
    company_data = await get_company_by_api_key(api_key)
    if not company_data:
        raise HTTPException(status_code=403, detail="Invalid API key")

    helper = GoogleCalendarHelper(api_key)
    appointment_settings = {}
    if company_data.get("appointment_settings"):
        try:
            appointment_settings = json.loads(company_data["appointment_settings"])
        except Exception:
            appointment_settings = {}

    service = await helper.get_calendar_service()
    if not service:
        raise HTTPException(
            status_code=409, detail="Calendar is not connected for this company"
        )

    # Get calendar_id from settings or helper
    if not appointment_settings.get("calendar_id"):
        appointment_settings["calendar_id"] = helper._get_calendar_id(
            service, appointment_settings
        )
    calendar_id = appointment_settings["calendar_id"]

    tz = helper._get_tz(appointment_settings)
    day = datetime.strptime(date, "%Y-%m-%d")
    day = datetime(day.year, day.month, day.day, tzinfo=tz)
    work_start = appointment_settings.get("workStart", "09:00")
    work_end = appointment_settings.get("workEnd", "17:00")
    start_local = day.replace(
        hour=int(work_start[:2]), minute=int(work_start[3:5]), second=0, microsecond=0
    )
    end_local = day.replace(
        hour=int(work_end[:2]), minute=int(work_end[3:5]), second=0, microsecond=0
    )

    events = helper._list_events(
        service, calendar_id, start_local.isoformat(), end_local.isoformat()
    )
    # Filter events to only those on this day
    booked = []
    for e in events:
        event_start_str = e["start"].get("dateTime")
        event_end_str = e["end"].get("dateTime")
        if not event_start_str or not event_end_str:
            continue
        event_start = datetime.fromisoformat(event_start_str.replace("Z", "+00:00"))
        event_end = datetime.fromisoformat(event_end_str.replace("Z", "+00:00"))
        if event_start.date() == day.date():
            booked.append(
                {
                    "id": e.get("id"),
                    "summary": e.get("summary"),
                    "description": e.get("description"),
                    "start": event_start_str,
                    "end": event_end_str,
                    "attendees": e.get("attendees", []),
                    "htmlLink": e.get("htmlLink"),
                }
            )
    return {"appointments": booked}


@router.get("/calendar-auth/{api_key}")
async def calendar_auth(api_key: str):
    """Δημιουργεί auth URL για συγκεκριμένη εταιρεία"""
    company_data = await get_company_by_api_key(api_key)
    if not company_data:
        raise HTTPException(status_code=403, detail="Invalid API key")

    try:
        calendar_helper = GoogleCalendarHelper(api_key)
        auth_url = calendar_helper.get_auth_url()

        if auth_url:
            return {"auth_url": auth_url}
        else:
            raise HTTPException(status_code=500, detail="Failed to create auth URL")
    except FileNotFoundError as e:
        logger.error(f"Google Calendar credentials missing: {e}")
        raise HTTPException(
            status_code=503,
            detail="Google Calendar not configured. Please add credentials.json file.",
        )
    except Exception as e:
        logger.error(f"Error creating calendar auth URL: {e}")
        raise HTTPException(
            status_code=500, detail=f"Calendar authentication error: {str(e)}"
        )


@router.get("/available-slots/{api_key}")
async def get_available_slots(api_key: str, date: str = Query(...)):
    company_data = await get_company_by_api_key(api_key)
    if not company_data:
        raise HTTPException(status_code=403, detail="Invalid API key")

    # παίρνει τα appoinment settings τα βάζει στο λεξικό
    appointment_settings = {}
    if company_data.get("appointment_settings"):
        try:
            appointment_settings = json.loads(company_data["appointment_settings"])
        except Exception:
            appointment_settings = {}

    helper = GoogleCalendarHelper(api_key)
    slots = await helper.get_available_slots(date, appointment_settings)
    # επιστρέφει διαθέσιμα ραντεβου επιστρέφει μία λίστα από dicts

    return {"available_slots": slots}


@router.post("/create-appointment/{api_key}")
async def create_appointment(api_key: str, payload: Dict[str, Any] = Body(...)):
    """
    Δημιουργεί νέο ραντεβού στο Google Calendar της εταιρείας με το συγκεκριμένο api_key.
    Υποστηρίζει και τα modes:
      - bot_managed → bot slots
      - user_managed → πάντα ρωτά το Calendar
    """
    # 1) Εύρεση εταιρείας & έλεγχος εγκυρότητας api_key
    company_data = await get_company_by_api_key(api_key)
    if not company_data:
        raise HTTPException(status_code=403, detail="Invalid API key")

    # 2) Φόρτωση Google credentials
    helper = GoogleCalendarHelper(api_key=api_key)
    # παίρνει τα  credentials του χρήστη
    creds = await helper.load_credentials()
    if not creds:
        raise HTTPException(
            status_code=409, detail="Calendar is not connected for this company"
        )

    # 3) Ανάγνωση/έλεγχος πεδίων
    start_datetime = payload.get("start_datetime")
    if not start_datetime:
        raise HTTPException(status_code=400, detail="Missing 'start_datetime'")

    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()
    notes = (payload.get("notes") or "").strip()

    # 4) Τίτλος & περιγραφή event
    company_display = (
        company_data.get("botName") or company_data.get("companyName") or "Appointment"
    )
    title = f"Ραντεβού με {name or 'Πελάτη'} - {company_display}"
    desc_parts = []
    if notes:
        desc_parts.append(f"Σημειώσεις: {notes}")
    if name:
        desc_parts.append(f"Όνομα: {name}")
    if email:
        desc_parts.append(f"Email: {email}")
    if phone:
        desc_parts.append(f"Τηλέφωνο: {phone}")
    description = (
        "\n".join(desc_parts) if desc_parts else "Αυτόματο ραντεβού από chatbot."
    )

    # 5) Ρυθμίσεις ραντεβού
    appointment_settings = {}
    try:
        if company_data.get("appointment_settings"):
            appointment_settings = json.loads(company_data["appointment_settings"])
    except Exception:
        appointment_settings = {}

    mode = appointment_settings.get("mode", "bot_managed")
    duration = appointment_settings.get("slotDuration", 60)
    tz_string = appointment_settings.get("timeZone", "Europe/Athens")

    # 6) Δημιουργία event
    try:
        # Τώρα το helper μπορεί να χειριστεί και τα δύο modes
        result = await helper.create_event(
            title=title,
            description=description,
            start_datetime=start_datetime,
            duration_minutes=duration,
            attendee_email=email or None,
            location=None,
            time_zone=tz_string,
            appointment_settings=appointment_settings,
        )

        if not result:
            raise HTTPException(status_code=500, detail="Calendar event not created")

        dt = datetime.fromisoformat(start_datetime.replace("Z", "+00:00"))
        dt_local = dt.astimezone(ZoneInfo(tz_string))
        when = dt_local.strftime("%d/%m/%Y %H:%M")

        company_name = company_data.get("companyName", "η εταιρία σας")

        subject = f"Επιβεβαίωση ραντεβού με την εταιρία {company_name}"
        body_text = f"Το ραντεβού σας με την εταιρία {company_name} έχει προγραμματιστεί για {when}."
        body_html = f"<p>{body_text}</p>"

        # Στείλε email στον πελάτη (αν έδωσε email)
        if email:
            try:
                send_email(email, subject, body_text, body_html)
            except Exception as e:
                logger.warning(f"Αποτυχία αποστολής email επιβεβαίωσης: {e}")

    except Exception as e:
        import traceback

        print("ERROR in create_appointment:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to create event: {str(e)}")

    # 7) Απόκριση — επιστρέφουμε και το htmlLink
    return {
        "status": "ok",
        "mode": mode,
        "event_id": result.get("id"),
        "message": "Το ραντεβού δημιουργήθηκε επιτυχώς.",
    }
