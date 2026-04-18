# RepoAtlas — Repository Architecture Navigator

Instantly understand any GitHub codebase via an interactive architecture graph with AI-powered explanations.

---

## Prerequisites

Make sure you have these installed before starting:

- **Python 3.10+** — `python3 --version`
- **Node.js 18+** — `node --version`
- **npm** — `npm --version`
- **Git** — `git --version`

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/tejasnarwade/repoatlas.git
cd repoatlas
```

---

## Step 2 — Configure API keys

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY="your-groq-api-key"           # Primary AI — free at console.groq.com
GOOGLE_API_KEY="your-gemini-api-key"        # Fallback AI — console.cloud.google.com
GITHUB_ACCESS_TOKEN="your-github-token"     # Optional — needed for private repos
```

### Getting API keys (free)

| Key | Where to get | Cost |
|-----|-------------|------|
| `GROQ_API_KEY` | https://console.groq.com → API Keys | Free — 14,400 req/day |
| `GOOGLE_API_KEY` | https://aistudio.google.com/app/apikey | Free tier available |
| `GITHUB_ACCESS_TOKEN` | https://github.com/settings/tokens | Free — only for private repos |

---

## Step 3 — Backend setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**

To verify it's running:
```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

---

## Step 4 — Frontend setup

Open a **new terminal tab**, then:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## Step 5 — Open the app

Go to **http://localhost:5173** in your browser, paste any public GitHub repo URL, and click **Analyze**.

---

## Features

- **Interactive dependency graph** — React Flow with clickable nodes
- **AI-powered answers** — Ask anything about the codebase in plain English (Groq llama-3.3-70b)
- **AI summaries per file** — Auto-generated explanations for every file
- **High-impact file highlighting** — PageRank-based risk detection
- **Onboarding path** — Ordered reading list to understand the codebase fast
- **Secret scanner** — Detects exposed API keys, tokens, and credentials across all files
- **Natural language queries** — "Where is auth handled?", "Show the payment flow"
- **Type-based filtering** — entry, api, model, service, utility, ui, auth, payment, test, config

---

## Project Structure

```
repoatlas/
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints
│   ├── analyzer.py          # Static analysis — dependency graph, AST parsing
│   ├── secrets_scanner.py   # Secret detection — 28 regex patterns
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── GraphView.jsx      # Main graph canvas
│       │   ├── ArchNode.jsx       # Custom React Flow node
│       │   ├── DetailPanel.jsx    # File detail sidebar
│       │   ├── QueryBar.jsx       # AI chat interface
│       │   ├── SecretsPanel.jsx   # Secret scan results
│       │   ├── OnboardingPanel.jsx
│       │   ├── StatsBar.jsx
│       │   └── Legend.jsx
│       └── constants.js
├── .env.example
└── README.md
```

---

## Troubleshooting

**Backend won't start**
```bash
# Make sure you're in the backend directory
cd repoatlas/backend
pip install -r requirements.txt
uvicorn main:app --port 8000
```

**Frontend can't reach backend**
- Confirm backend is running on port 8000
- Check browser console for CORS errors
- Both must run simultaneously in separate terminals

**"No AI key configured" message**
- Add your `GROQ_API_KEY` to `.env` — get one free at https://console.groq.com
- Restart the backend after editing `.env`

**Analysis times out on large repos**
- Large repos (1000+ files) can take 60–120 seconds
- The app shows a progress indicator while analyzing
