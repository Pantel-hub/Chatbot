import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import json
import time

from openai import OpenAI
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import os

# Αν τα HTML (index2.html, chatbot.html) είναι στον ΙΔΙΟ φάκελο με το app.py:
app = Flask(__name__)
CORS(app)

load_dotenv()  # Φορτώνει τις μεταβλητές περιβάλλοντος από το .env αρχείο
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

#Ορίζει και δημιουργεί έναν φάκελο αποθήκευσης για "uploads"
#(π.χ. εικόνες, αρχεία που ανεβάζουν χρήστες σε μια web app)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

#συλλέγει όλα τα δεδομένα από το website_url

class WebsiteScraper:
    """
    Scraper που φορτώνει μια σελίδα με Selenium (headless Chrome),
    κάνει λίγο scroll για lazy περιεχόμενο, και εξάγει:
    - title
    - meta tags
    - structured_data (JSON-LD)
    - images (absolute - για product context)
    - text (ολόκληρο ορατό κείμενο)
    - full_html (όλο το HTML)
    - prices (εντοπισμός τιμών € με κοντινό τίτλο - χωρίς URLs για embedded)
    
    Βελτιστοποιημένο για embedded chatbot - χωρίς links/scripts/stylesheets
    """

    def __init__(self, url, scroll_passes=3, page_load_timeout=60):
        self.url = url
        self.scroll_passes = scroll_passes
        self.page_load_timeout = page_load_timeout
        self.data = {}
        self.scrape_website()

    # ---------------- internal helpers ----------------
    def setup_driver(self):
        chrome_options = Options()
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=chrome_options)

    @staticmethod
    def _unique(seq):
        # διατήρηση σειράς + αφαίρεση διπλότυπων
        return list(dict.fromkeys(seq or []))

    @staticmethod
    def _extract_meta(soup):
        meta = {}
        for m in soup.find_all("meta"):
            k = m.get("name") or m.get("property") or m.get("http-equiv")
            v = m.get("content")
            if k and v:
                meta[k.strip()] = v.strip()
        return meta

    @staticmethod
    def _extract_structured_data(soup):
        structured = []
        for s in soup.find_all("script", type="application/ld+json"):
            try:
                if s.string:
                    structured.append(json.loads(s.string))
            except Exception:
                structured.append({"raw": s.string})
        return structured

    def _extract_images(self, soup):
        """Εξάγει images για product context (όχι για εμφάνιση στο chat)"""
        images = []
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-original")
            alt = img.get("alt", "").strip()
            if src:
                img_data = {"src": urljoin(self.url, src)}
                if alt:
                    img_data["alt"] = alt
                images.append(img_data)
        return self._unique([img["src"] for img in images])  # Κρατάμε μόνο τα URLs για συμβατότητα

    def extract_prices(self, soup):
        """
        Εντοπισμός τιμών σε € + κοντινός τίτλος (best-effort).
        Επιστρέφει: [{"title","price_raw","price_eur"}] - ΧΩΡΙΣ URLs για embedded chatbot
        """
        price_re = re.compile(r'(\d{1,4}(?:[.,]\d{2})?)\s*€')
        results, seen = [], set()

        for node in soup.find_all(string=price_re):
            m = price_re.search(node)
            if not m:
                continue

            raw = m.group(0)
            num_txt = m.group(1).replace(',', '.')
            try:
                price_val = float(num_txt)
                # Φιλτράρισμα πολύ μικρών τιμών (πιθανώς όχι προϊόντα)
                if price_val < 1:
                    continue
            except Exception:
                continue

            title = None
            card, hops = node.parent, 0
            
            # Ανέβα μέχρι 5 γονείς να βρούμε λογικό τίτλο
            while card and hops < 5:
                # Προτεραιότητα σε links με κείμενο (συνήθως product names)
                a = card.find('a', href=True)
                if a and a.get_text(strip=True) and len(a.get_text(strip=True)) > 3:
                    title = a.get_text(" ", strip=True)[:100]
                    break
                    
                # Στη συνέχεια headings
                for tag in ['h1','h2','h3','h4','h5','h6']:
                    t = card.find(tag)
                    if t and t.get_text(strip=True):
                        title = t.get_text(" ", strip=True)[:100]
                        break
                if title:
                    break
                
                # Fallback σε άλλα elements με αρκετό κείμενο
                for tag in ['p','span','strong','div']:
                    t = card.find(tag)
                    if t and t.get_text(strip=True) and len(t.get_text(strip=True)) > 5:
                        text = t.get_text(" ", strip=True)[:100]
                        # Αποφυγή τιμών ως τίτλους
                        if not re.search(r'\d+\s*€', text):
                            title = text
                            break
                if title:
                    break
                    
                card, hops = card.parent, hops+1

            if not title:
                title = f"Προϊόν {price_val}€"

            # Καθαρισμός τίτλου
            title = re.sub(r'\s+', ' ', title).strip()
            
            key = (title.lower(), price_val)  # Case-insensitive deduplication
            if key not in seen and len(title) > 3:
                seen.add(key)
                results.append({
                    "title": title,
                    "price_raw": raw,
                    "price_eur": price_val
                })

        # Ταξινόμηση κατά τιμή και περιορισμός για embedded context
        results.sort(key=lambda x: x["price_eur"])
        return results[:30]

    # ---------------- main routine ----------------
    def scrape_website(self):
        print(f"🌐 Φορτώνω δεδομένα από: {self.url}")
        try:
            driver = self.setup_driver()
        except Exception as e:
            print(f"❌ Chrome driver error: {e}")
            self.data = {"error": str(e), "text": ""}
            return

        try:
            driver.set_page_load_timeout(self.page_load_timeout)
            driver.get(self.url)

            # Περίμενε body
            try:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
            except Exception:
                pass

            # Λίγο scroll για lazy content
            last_h = driver.execute_script("return document.body.scrollHeight")
            for _ in range(self.scroll_passes):
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1.0)
                new_h = driver.execute_script("return document.body.scrollHeight")
                if new_h == last_h:
                    break
                last_h = new_h

            full_html = driver.page_source
            soup = BeautifulSoup(full_html, "html.parser")

            title = soup.title.string.strip() if soup.title and soup.title.string else None
            meta = self._extract_meta(soup)
            structured_data = self._extract_structured_data(soup)
            images = self._extract_images(soup)
            text = soup.get_text(separator=" ", strip=True)
            prices = self.extract_prices(soup)

            self.data = {
                "source_url": self.url,
                "fetched_at": datetime.utcnow().isoformat() + "Z",
                "title": title,
                "meta": meta,
                "structured_data": structured_data,
                "images": images,  # Μόνο για context, όχι για εμφάνιση
                "text": text,
                "full_html": full_html,
                "prices": prices  # Χωρίς URLs - μόνο τίτλος και τιμή
            }

            print(
                f"✅ Συλλέχθηκαν: text({len(text)} chars), "
                f"images({len(images)}), prices({len(prices)} items)"
            )

        except Exception as e:
            print(f"❌ Scraping error: {e}")
            self.data = {"error": str(e), "text": ""}
        finally:
            try:
                driver.quit()
            except Exception:
                pass


CONV_HISTORY = {}

##όλα τα απαραίτητα routes
@app.route('/', methods=['GET'])
def root():
    # Ρίζα -> φόρμα
    return redirect(url_for('form_page'))

@app.route('/form', methods=['GET'])
def form_page():
    # Προβάλει τη φόρμα
    return render_template('index.html')

@app.route('/chatbot/<company_id>', methods=['GET'])
def chatbot_page(company_id):
    # Προβάλει το chatbot (το company_id το κρατάμε για τη ροή σου)
    return render_template('chatbot.html')

@app.route('/health', methods=['GET'])
def health():
    return jsonify(status='ok'), 200

#παίρνει τις απαντήσεις της φόρμας τις μετατρέπει σε json και τις βάζει σε dict

@app.route("/create-assistant", methods=["POST"])
def create_assistant():
    f = request.form
    files = request.files.getlist("files")  # μπορεί να είναι []

    # Αν ο χρήστης διάλεξε "Άλλο/Other", πέρνα την τιμή από το extra πεδίο
    industry = (f.get("industry") or f.get("industryOther") or "").strip()
    required_keys = [
        "companyName", "websiteURL", "description", "questions",
        "endMessage", "greeting", "keywords"
    ]
    missing = [k for k in required_keys if not (f.get(k) or "").strip()]
    if not industry:
        missing.append("industry")

    if missing:
        return jsonify({"status": "error", "missing": missing}), 400

    # Προαιρετική αποθήκευση αρχείων (αν στάλθηκαν)
    saved_files = []
    for file in files:
        if file and file.filename:
            filename = secure_filename(file.filename)
            path = os.path.join(UPLOAD_DIR, filename)
            file.save(path)
            saved_files.append(filename)

    payload = {
        "companyName":     f.get("companyName"),
        "industry":        industry,
        "websiteURL":      f.get("websiteURL"),
        "description":     f.get("description"),
        "questions":       f.get("questions"),
        "endMessage":      f.get("endMessage"),
        "greeting":        f.get("greeting"),
        "keywords":        f.get("keywords"),
        "files_saved":     saved_files,      # [] αν δεν ανέβηκε τίποτα
        "files_count":     len(saved_files)
    }

    scraped = None
    if payload["websiteURL"]:
        try:
            scraper = WebsiteScraper(payload["websiteURL"])
            scraped = scraper.data
            print(f"🧩 Scraped: text({len(scraped.get('text',''))}), images({len(scraped.get('images',[]))}), prices({len(scraped.get('prices',[]))})")
        except Exception as e:
            print("❌ Scrape error:", e)
            scraped = {"error": str(e)}

    print("🔥 /create-assistant received:", payload)
    return jsonify({"status": "ok", "received": payload,"scraped":scraped}), 200
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({"error": "bad_json", "detail": str(e)}), 400

    session_id = (data.get("session_id") or "default").strip()
    question   = (data.get("question") or "").strip()
    website_data = data.get("website_data") or {}
    company_info = data.get("company_info") or {}
    evaluation_context = data.get("evaluation_context") or {}

    if not question:
        return jsonify({"error": "empty_question"}), 400

    # init history
    if session_id not in CONV_HISTORY:
        CONV_HISTORY[session_id] = []

    # ---------- Normalize fields ----------
    ci = company_info or {}
    company_name = (ci.get('companyName') or ci.get('name') or '').strip()
    industry     = (ci.get('industry') or '').strip()
    greeting     = (ci.get('greeting') or 'Γεια σας! Πώς μπορώ να βοηθήσω;').strip()
    farewell     = (ci.get('endMessage') or '').strip()

    # Έλεγχος αν είναι η πρώτη ερώτηση του χρήστη
    # Αν δεν υπάρχει history ΚΑΘΟΛΟΥ, σημαίνει ότι το frontend έχει ήδη στείλει χαιρετισμό
    # οπότε δεν χρειάζεται να χαιρετήσουμε ξανά
    has_any_history = len(CONV_HISTORY.get(session_id, [])) > 0
    is_first_user_question = not has_any_history

    # ---------- Build context from website_data fields (ΧΩΡΙΣ links/scripts/stylesheets) ----------
    INCLUDE_FULL_HTML = bool(evaluation_context.get("include_full_html", False))

    context = {
        "source_url":      website_data.get("source_url") or website_data.get("url"),
        "title":           website_data.get("title"),
        "meta":            website_data.get("meta"),
        "structured_data": website_data.get("structured_data"),
        "images":          website_data.get("images"),    # Μόνο για context
        "text":            website_data.get("text"),      # Ολόκληρο κείμενο
        "prices":          website_data.get("prices"),    # Χωρίς URLs
    }
    
    if INCLUDE_FULL_HTML and website_data.get("full_html"):
        # προαιρετικός "κόφτης" για ασφάλεια
        MAX_HTML_CHARS = int(evaluation_context.get("max_full_html_chars", 20000))
        context["full_html"] = website_data["full_html"][:MAX_HTML_CHARS]

    # jsonify ALL context for το prompt
    context_json = json.dumps(context, ensure_ascii=False)

    # ---------- SYSTEM PROMPT - Διαφορετικό για πρώτη vs επόμενες ερωτήσεις ----------
    if is_first_user_question:
        # Πρώτη ερώτηση: ΔΕΝ χαιρετάμε γιατί το frontend έχει ήδη χαιρετίσει
        system_prompt = f"""
You are the customer-support AI agent for the company "{company_name or '—'}"{(' in the ' + industry + ' industry') if industry else ''}.

• Always answer in Greek, concise and practical.
• Do NOT include any greeting - a greeting has already been sent by the system.
• Simply answer the user's question directly.
• If the user indicates they are done or says thanks, close with: "{farewell or 'Σας ευχαριστούμε για τον χρόνο σας.'}".

Use ONLY the website data context below for factual information. Do not invent facts.

For general inquiries:
• Use the website text and structured data to provide accurate information
• Be helpful but stay within the bounds of available information
• If information isn't available, politely say so and offer alternatives

Website data context:
{context_json}
""".strip()
    else:
        # Επόμενες ερωτήσεις: Χωρίς χαιρετισμό
        system_prompt = f"""
You are the customer-support AI agent for the company "{company_name or '—'}"{(' in the ' + industry + ' industry') if industry else ''}.

• Always answer in Greek, concise and practical.
• Do NOT include any greeting - continue the existing conversation.
• If the user indicates they are done or says thanks, close with: "{farewell or 'Σας ευχαριστούμε για τον χρόνο σας.'}".

Use ONLY the website data context below for factual information. Do not invent facts.

For general inquiries:
• Use the website text and structured data to provide accurate information
• Be helpful but stay within the bounds of available information
• If information isn't available, politely say so and offer alternatives

Website data context:
{context_json}
""".strip()

    # ---------- Build messages ----------
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(CONV_HISTORY[session_id])
    messages.append({"role": "user", "content": question})

    # ---------- Call OpenAI with safe error handling ----------
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
        )
        answer = resp.choices[0].message.content or ""
    except Exception as e:
        # Προσπάθησε fallback αν έστειλες full_html και "ξέφυγε"
        if INCLUDE_FULL_HTML:
            try:
                context.pop("full_html", None)
                context_json = json.dumps(context, ensure_ascii=False)
                fallback_prompt = system_prompt.split("Website data context")[0] + f"Website data context (NO full_html):\n{context_json}"
                messages = [{"role": "system", "content": fallback_prompt}] + CONV_HISTORY[session_id] + [{"role": "user", "content": question}]
                resp = client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    temperature=0.7,
                )
                answer = resp.choices[0].message.content or ""
            except Exception as e2:
                print(f"[CHAT ERROR fallback] {e2}")
                return jsonify({"error": "chat_failed", "detail": str(e2)}), 500
        else:
            print(f"[CHAT ERROR] {e}")
            return jsonify({"error": "chat_failed", "detail": str(e)}), 500

    # ---------- Save history ----------
    CONV_HISTORY[session_id].append({"role": "user", "content": question})
    CONV_HISTORY[session_id].append({"role": "assistant", "content": answer})

    return jsonify({"answer": answer, "history": CONV_HISTORY[session_id]}), 200

    # ---------- Save history ----------
    CONV_HISTORY[session_id].append({"role": "user", "content": question})
    CONV_HISTORY[session_id].append({"role": "assistant", "content": answer})

    return jsonify({"answer": answer, "history": CONV_HISTORY[session_id]}), 200
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, port=port)
