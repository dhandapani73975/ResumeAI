# ResumeAI 🚀 — Premium AI Resume Analyzer & Mock Interview Coach

ResumeAI is a highly optimized, full-stack web application designed to empower candidates with recruiter-level resume auditing, deep ATS scans, interactive mock interviews, and personalized career advice.

Built with **Django** serving a stunning **glassmorphic SPA frontend** powered by **Groq Llama-3 AI**, ResumeAI provides lightning-fast analysis with premium micro-animations and browser-native voice integration.

---

## 🌟 Key Features

1. **🔒 Secure Resume Upload**: Fast drag-and-drop parsing supporting **PDF**, **DOCX**, and **TXT** files. Automatic text extraction page-by-page.
2. **🧠 Recruiter-Grade AI Analysis**: Detailed metrics audit covering:
   - **ATS compatibility index** (0-100%) and **Strength Score**.
   - Proactive **Skills Gap Analysis** (Detected vs. Missing skills).
   - Dynamic Recruiter critiques of experience history and project quality.
   - Tailored **Keyword Optimization Table** highlighting industry search gaps.
3. **🎙️ Speech-Based Mock Interview Prep**: Tailored Technical, HR, and Project-based question banks. Integrates browser-native **SpeechSynthesis** to voice questions and **webkitSpeechRecognition** to capture candidates' spoken transcripts in real-time with pulsing audio wave simulations.
4. **💬 Interactive AI Career Coach**: A persistent, context-aware chatbot loaded with your specific resume text. Ask for tailored cover letters, bullet optimizations, or career pathways.
5. **✨ AI Bullet Rewriter**: Instant rewriting helper converting weak task-based descriptions into metric-driven, professional accomplishments.
6. **🎯 Target Job Matcher**: Paste a job description to compute detailed overlap index, missing search criteria, and AI suggested bullets to add.
7. **📊 Admin Traffic & Logs Panel**: Proactive logging of Groq API requests, average matching statistics, most common missing/detected skills, and spent token capacities.
8. **🌓 Theme Engine & PDF Export**: Persisted Light/Dark CSS theme transitions. Integrated print-friendly media styling that exports clean, beautifully formatted multi-page resume reviews upon clicking **"Export PDF"**.

---

## 📂 Project Structure

```
c:\Users\hello\Desktop\django\
├── ResumeAI/               # Django Core Configuration
│   ├── __init__.py
│   ├── settings.py         # Handles sqlite/postgresql & dotenv
│   ├── urls.py             # Global routing
│   └── wsgi.py
├── analyzer/               # Analysis Core Application
│   ├── migrations/         # Database migrations
│   ├── templates/          
│   │   └── index.html      # Responsive Single Page Application
│   ├── static/             
│   │   ├── css/
│   │   │   └── styles.css  # CSS custom tokens & transitions
│   │   └── js/
│   │       └── app.js      # SPA state, voice systems & ChartJS
│   ├── admin.py
│   ├── ai_service.py       # Groq API wrappers & high-fidelity mock generators
│   ├── models.py           # Resume, JobMatch, InterviewSession, UsageLog tables
│   ├── parser.py           # PDF and DOCX text extraction
│   ├── tests.py            # Integrity unit tests
│   ├── urls.py             # API route mappings
│   └── views.py            # API controller actions
├── Dockerfile              # Container building instruction
├── docker-compose.yml      # Multi-container linking configuration
├── requirements.txt        # Python library list
├── .env.example            # Environment variables helper
├── .env                    # Active local environment
└── README.md
```

---

## 🚀 Getting Started (Local Run)

### 1. Prerequisites
Ensure you have **Python 3.10+** (or Python 3.14 on standard local Windows builds) and `pip` on path.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure API Key
Open `.env` in the root folder and paste your **Groq API Key**:
```env
GROQ_API_KEY=gsk_your_key_here
```
> 💡 *Note: If no API key is specified, the application will run in **Mock Mode**, loading highly realistic, contextual mock analysis. This ensures immediate operational walkthroughs out of the box!*

### 4. Apply Database Migrations
Create and execute the SQLite tables:
```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Launch the Server
```bash
python manage.py runserver
```
Visit the application in your browser at: **`http://127.0.0.1:8000/`**

---

## 🐳 Docker Deployment

To build and run ResumeAI with a **PostgreSQL database** container:

```bash
# Boot Postgres DB & Django server together
docker-compose up --build
```
This command automatically:
1. Bootstraps a healthy **PostgreSQL 15** container.
2. Builds the Django web image.
3. Automatically triggers python database migrations.
4. Serves the final application on port **`8000`**.

---

## 🔌 API Reference Endpoints

All actions are fully decoupled through a modular REST design:

- `POST /api/upload/`: Uploads a file (multipart `resume`) -> extracts and returns parsed text metadata.
- `GET /api/analyze/<id>/`: Triggers/returns structural Groq AI analysis JSON.
- `POST /api/job-match/<id>/`: Paste a JSON `job_description` -> returns target overlap statistics.
- `GET /api/interview-prep/<id>/`: Compiles tailored Technical/HR questions.
- `POST /api/chat/<id>/`: Handles conversation turns with the AI Career Coach.
- `GET /api/history/`: Queries recent resume uploads list.
- `GET /api/admin-stats/`: Aggregates usage tokens, API logs, and skill statistics.

---

## 🎙️ Speech recognition Web API Guidelines
- For optimal speechrecognition fidelity, access the server using a **Chromium-based browser** (Chrome, Edge, Brave).
- Allow the browser to access your local microphone when starting the speech mock.
- Speak clearly into the microphone. Interim and final transcripts will render in real-time.

---

## 📝 Running Tests
Verify database integrity and code structures:
```bash
python manage.py test
```
*(Note: Python 3.14 displays internal django-level test context copy warnings, which is a known Python 3.14 Django compatibility bug. The web server and core logic run 100% correctly).*
