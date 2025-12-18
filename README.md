-d# CHATBOT BUILDER

## 1. Εγκατάσταση

### Απαιτούμενα
- Docker Desktop 20.0+ (δοκιμασμένο με v28.4.0)
- Node.js 18.0+ (δοκιμασμένο με v22.19.0)

Το project περιέχει ένα αρχείο `.env` στον root φάκελο με όλες τις απαραίτητες ρυθμίσεις (API keys, credentials κ.λπ.). Το αρχείο αυτό πρέπει να υπάρχει πριν την εκκίνηση.

Δομή φακέλων (ενδεικτικά):
```
project-root/
├─ Backend/
│  ├─ main.py
│  ├─ cms_routes.py
│  ├─ widget_routes.py
│  ├─ migration.py
│  ├─ create_tables.py
│  ├─ schema.sql
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ ...
├─ Frontend/
│  ├─ src/
│  ├─ package.json
│  └─ ...
├─ docker-compose.yml
├─ .env
└─ README.md
```

---

## 2. Εκκίνηση Backend, MySQL και Redis με Docker

### 2.1 Πρώτο build και εκκίνηση containers

Άνοιξε ένα terminal (Command Prompt / PowerShell / shell) στον root φάκελο του project και εκτέλεσε:

```bash
docker-compose up --build
```

Τι κάνει αυτή η εντολή:
- Χτίζει το backend image (FastAPI)
- Κατεβάζει και ξεκινά MySQL 8.0
- Κατεβάζει και ξεκινά Redis 7
- Δημιουργεί το δίκτυο επικοινωνίας μεταξύ των υπηρεσιών

Επιτυχής εκκίνηση όταν εμφανιστούν μηνύματα όπως:
```
chatbot-backend    | INFO:     Uvicorn running on http://0.0.0.0:8000
chatbot-mysql      | ready for connections
chatbot-redis      | Ready to accept connections
```

Σημείωση: Κράτα αυτό το terminal ανοιχτό όσο τρέχουν τα containers.
ΕΚΤΊΜΗΣΗ ΧΡΟΝΟΥ 20-30 λεπτά , θα χρειαστεί μόνο μία φορά

---

### 2.2 Δημιουργία πινάκων βάσης δεδομένων

Μετά την εκκίνηση των containers, πρέπει να δημιουργηθούν οι πίνακες της βάσης MySQL.

Άνοιξε ένα νέο terminal στον root φάκελο του project και εκτέλεσε μία από τις παρακάτω εντολές, ανάλογα με το περιβάλλον:

#### Windows (CMD)
```bash
type Backend\schema.sql | docker exec -i chatbot-mysql mysql -uroot -pMyAnalytics2024! chatbot_platform
```

#### Windows (PowerShell)
```powershell
Get-Content Backend\schema.sql | docker exec -i chatbot-mysql mysql -uroot -pMyAnalytics2024! chatbot_platform
```

#### Linux / Mac
```bash
cat Backend/schema.sql | docker exec -i chatbot-mysql mysql -uroot -pMyAnalytics2024! chatbot_platform
```

Αν δεν εμφανιστούν errors, οι πίνακες έχουν δημιουργηθεί με επιτυχία.

Προαιρετικός έλεγχος:
```bash
docker exec -it chatbot-mysql mysql -uroot -pMyAnalytics2024! chatbot_platform -e "SHOW TABLES;"
```



---

### 2.3 Χειρισμός του server μετά το αρχικό build

Αφού γίνει το αρχικό build, στις επόμενες εκκινήσεις:

Εκκίνηση όλων των services στο background:
```bash
docker-compose up -d
```

Τερματισμός:
```bash
docker-compose down
```

Live logs μόνο για το backend:
```bash
docker-compose logs -f backend
```

Με αυτόν τον τρόπο μπορείς να βλέπεις αιτήματα, errors, analytics updates, κ.λπ.

ΕΙΣΟΔΟΣ ΣΤΗΝ ΒΑΣΗ 
docker exec -it chatbot-mysql mysql -uroot -pMyAnalytics2024! chatbot_platform

---

## 3. Frontend Setup

Το frontend τρέχει εκτός Docker (τοπικά με Node.js / Vite).

Βήματα:

```bash
cd Frontend
npm install
npm run dev
```

Επιτυχής εκκίνηση όταν εμφανιστεί κάτι όπως:
```
VITE v5.x.x  ready in XXX ms
Local:   http://localhost:5173/
```

Το dashboard / UI είναι διαθέσιμο στο:
http://localhost:5173/

---

## 4. Σημεία Πρόσβασης

Μετά το setup:

- Backend API: http://localhost:8000
- Frontend (dashboard): http://localhost:5173
- MySQL service: τρέχει μέσα στο container `chatbot-mysql`
- Redis service: τρέχει μέσα στο container `chatbot-redis`

Το backend μιλάει απευθείας με MySQL και Redis, δεν χρειάζεται ξεχωριστή ρύθμιση από τον χρήστη πέρα από το `.env`.

---

## 5. Εξωτερικές Υπηρεσίες / Συνδρομές

Ο κώδικας χρησιμοποιεί διάφορα providers. Αυτά πρέπει να ρυθμιστούν, αλλιώς κάποια features (email, SMS, scraping, calendar) δεν θα λειτουργούν.

### 5.1 Amazon SES (Email)
- Χρησιμοποιείται για αποστολή email (π.χ. επιβεβαίωση, ειδοποιήσεις).
- Πρέπει να έχεις Amazon SES account σε κατάσταση παραγωγής (production, όχι sandbox).
- Πρέπει να γίνει verify ένα domain (π.χ. `chatbotbuilder.com`) στο SES.
- Στο `.env` πρέπει να συμπληρωθούν τα σχετικά credentials (access key, secret, region, verified sender).

### 5.2 Twilio (SMS)
- Χρησιμοποιείται για αποστολή SMS.
- Υλοποιείται με χρήση SENDER_ID (π.χ. "chatbotbuilder") και όχι απαραιτήτως με κανονικό αριθμό τηλεφώνου.
- Απαιτεί ενεργό Twilio account και χρέωση (περίπου 20 ευρώ / μήνα στο συγκεκριμένο setup).
- Τα credentials του Twilio (SID, auth token, sender ID) μπαίνουν επίσης στο `.env`.

### 5.3 Bright Data (Web Scraping)
- Χρησιμοποιείται για scraping / data extraction από προστατευμένες σελίδες.
- Γίνεται χρήση της υπηρεσίας "Web Unlocker".
- Απαιτεί Bright Data account και API key.
- Το API key τοποθετείται στο `.env`.

### 5.4 Google Calendar API (ραντεβού / κράτηση ώρας)
- Χρησιμοποιείται για να κάνει create events σε Google Calendar, να κλείνει ραντεβού κτλ.
- Πρέπει να φτιαχτεί project στο Google Cloud Console:
  https://console.cloud.google.com/
- Εκεί πρέπει να δημιουργηθούν OAuth 2.0 credentials.
- Η Google κατεβάζει ένα JSON με client_id / client_secret. Αυτό το αρχείο πρέπει να αποθηκευτεί ως:
  `Backend/credentials.json`
- Το backend περιμένει να βρει αυτό το αρχείο για να μπορεί να καλέσει το Calendar API.
- Οποιαδήποτε path ή client details χρειάζονται δηλώνονται και στο `.env`.

---

## 6. Σημαντικές Παρατηρήσεις

1. Το αρχείο `.env` είναι υποχρεωτικό για να εκκινήσει σωστά το backend. Περιλαμβάνει:
   - Database credentials (MySQL)
   - Redis connection
   - API keys (OpenAI, Anthropic, Google, Twilio, Bright Data, AWS SES κ.λπ.)
   - Ρυθμίσεις για το domain αποστολής email

2. Το `schema.sql` πρέπει να εκτελεστεί μόνο μία φορά για να δημιουργήσει τη δομή της βάσης. Αν τρέξει δεύτερη φορά χωρίς καθαρή βάση, η MySQL θα εμφανίσει errors τύπου "table already exists".

3. Το project χρησιμοποιεί Redis για:
   - προσωρινό caching,
   - αποθήκευση sessions,
   - metrics (π.χ. ratings, response times),
   και MySQL για μόνιμα ιστορικά δεδομένα (analytics, users, bots).

4. Υπάρχει migration script (`migration.py`) που μαζεύει τα daily analytics από το Redis και τα γράφει στη MySQL (π.χ. σε πίνακες `daily_analytics` και `total_analytics`), και καθαρίζει counters από το Redis.Αυτη την στιγμη πρέπει να εκτελειται χειροκίνητα μία φορα την ημερα

---

## 7. Γρήγορη Περίληψη Εκκίνησης

1. Ρύθμισε το `.env` στον root φάκελο.
2. `docker-compose up --build`
3. Δημιούργησε τους πίνακες με το `schema.sql` μέσα στο container της MySQL.
4. Στο `Frontend/` εκτέλεσε:
   ```bash
   npm install
   npm run dev
   ```
5. Άνοιξε:
   - Dashboard: http://localhost:5173/
  
