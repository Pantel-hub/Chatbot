from fastapi import FastAPI, Request
from fastapi.responses import Response, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
import logging

from database_connection import init_db_pool, close_db_pool
from fastapi.responses import HTMLResponse
from calendar_helper import GoogleCalendarHelper
from cms_routes import router as cms_router
from widget_routes import router as widget_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ✅ Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting application...")
    await init_db_pool()
    print("✅ Database pool initialized")
    yield
    # Shutdown
    print("🛑 Shutting down...")
    await close_db_pool()
    print("✅ Database pool closed")

app = FastAPI(title="Chatbot Platform", lifespan=lifespan)




# ---------------- CORS per-path ρυθμίσεις ----------------
ALLOWED_CMS_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    
}

PUBLIC_METHODS = {"GET", "POST", "OPTIONS"}
CMS_METHODS    = {"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}

PUBLIC_HEADERS = "*"
CMS_HEADERS = "*"


class PathBasedCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin") 
        path = request.url.path
        acr_method = request.headers.get("access-control-request-method") #π.χ Ο browser θέλει να κάνει POST. Επιτρέπεται;
        acr_headers = request.headers.get("access-control-request-headers") #Ο client θέλει να στείλει τα headers Content-Type και Authorization. Επιτρέπεται;»

        def set_vary(r: Response):
            #Η set_vary βάζει στην απόκριση το header Vary ώστε caches (browser, CDN, proxy) να ξέρουν ότι η απάντηση CORS εξαρτάται από το Origin και τα preflight headers.
            r.headers["Vary"] = "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"

        # -------- Preflight (OPTIONS) --------
        #απαντάει στο  CORS Preflight
        if request.method == "OPTIONS":
            resp = Response(status_code=204) #HTTP/1.1 204 No Content
            set_vary(resp)

            if path.startswith("/api/cms"):
                # Επιτρέπουμε μόνο whitelisted origins + credentials
                if origin in ALLOWED_CMS_ORIGINS:
                    resp.headers["Access-Control-Allow-Origin"] = origin
                    resp.headers["Access-Control-Allow-Credentials"] = "true"
                    resp.headers["Access-Control-Allow-Methods"] = ", ".join(sorted(CMS_METHODS))
                    resp.headers["Access-Control-Allow-Headers"] = acr_headers or CMS_HEADERS
                    #Αν ο browser ζήτησε συγκεκριμένα headers (acr_headers έχει τιμή) → χρησιμοποίησε αυτά.
                    #Αν δεν ζήτησε τίποτα (το acr_headers είναι None) → χρησιμοποίησε τη default λίστα (CMS_HEADERS).
                    resp.headers["Access-Control-Max-Age"] = "600" 
                # αν δεν είναι whitelisted, αφήνουμε 204 χωρίς ACAO -> ο browser θα μπλοκάρει
            elif path.startswith("/api/public"):
                # Πλήρως public, χωρίς credentials
                resp.headers["Access-Control-Allow-Origin"] = "*"
                resp.headers["Access-Control-Allow-Methods"] = ", ".join(sorted(PUBLIC_METHODS))
                resp.headers["Access-Control-Allow-Headers"] = acr_headers or ", ".join(sorted(PUBLIC_HEADERS))
                resp.headers["Access-Control-Max-Age"] = "600" # ενημερώνει τον browser (client) για το πόσο χρόνο (σε δευτερόλεπτα) μπορεί να αποθηκεύσει (cache) τις πληροφορίες έγκρισης από τον CORS Preflight request.



            return resp

        # αν το αίτημα δεν είναι OPTIONS , το αφήνω να περάσει στο endpoint
        try:
            response = await call_next(request) 
        except Exception:
            # Unified error + πάντα CORS headers
            response = JSONResponse({"detail": "Internal Server Error"}, status_code=500)

        set_vary(response)
        #CORS για actual requests
        if path.startswith("/api/cms"):
            if origin in ALLOWED_CMS_ORIGINS:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
        elif path.startswith("/api/public"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            
            

        return response

# Ενεργοποίηση middleware
app.add_middleware(PathBasedCORSMiddleware)

# ---------------- Health / readiness ----------------
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/ready")
def ready():
    # εδώ μπορείς αργότερα να ελέγξεις DB/Redis συνδέσεις
    return {"ready": True}

# ---------------- Mount Routers ----------------
app.include_router(cms_router, prefix="/api/cms", tags=["cms"])
app.include_router(widget_router, prefix="/api/public", tags=["public"])

@app.get("/oauth2callback")
async def oauth2_callback(code: str | None = None, state: str | None = None):
    """
    Callback από Google OAuth.
    Το state περιέχει το api_key.
    """
    def post_message_and_close(js_obj_literal: str) -> HTMLResponse:
        return HTMLResponse(f"""
<!doctype html><html><head><meta charset="utf-8"/></head><body>
<script>
  try {{
    if (window.opener && !window.opener.closed) {{
      window.opener.postMessage({js_obj_literal}, "*");
    }}
  }} catch (e) {{}}
  window.close();
</script>
<p>Μπορείτε να κλείσετε αυτό το παράθυρο.</p>
</body></html>
        """.strip())

    if not state or not code:
        return post_message_and_close("{ type: 'gcal_error', reason: 'missing_state_or_code' }")

    try:
        calendar_helper = GoogleCalendarHelper(state)  # state = api_key
        credentials = calendar_helper.get_credentials_from_code(code)
        
        if not credentials:
            return post_message_and_close("{ type: 'gcal_error', reason: 'invalid_grant' }")

        saved = await calendar_helper.save_credentials_to_db(credentials)
        
        if not saved:
            return post_message_and_close("{ type: 'gcal_error', reason: 'save_failed' }")

        return post_message_and_close(f"{{ type: 'gcal_connected', api_key: '{state}' }}")

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return post_message_and_close("{ type: 'gcal_error', reason: 'exception' }")