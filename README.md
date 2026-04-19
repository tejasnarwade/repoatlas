# RepoAtlas

AI-powered repository intelligence platform. Clone any GitHub repo and instantly get an interactive dependency graph, AI file summaries, natural language queries, architecture evolution timeline, and a real-time secret/API key scanner — all running 100% locally.

---
DEVELOPERS:
- Divya Belokar
- Pranshu Tiwari
- Sanika Patil
- Tejas Narwade

## Features

- Interactive dependency graph with color-coded node types
- AI-generated file summaries (on-demand, local Ollama)
- Natural language query interface
- Architecture Evolution — full git commit history per file
- Secret Scanner — detects exposed API keys, tokens, private keys across 30+ patterns
- Onboarding Path — recommended reading order for new developers
- Guided Tour mode
- AI Code Review per file
- Orphan module detection
- AES-256 encrypted ZIP export
- GitHub OAuth — supports private repositories

---

Video Demo : (by Team IIT Pimpri)
https://drive.google.com/file/d/14RAqEb62d5wjNJYz8Hq29_5pniHa34EH/view?usp=drive_link
---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, ReactFlow, Lucide Icons |
| Backend | FastAPI, Python 3.12, Uvicorn |
| AI/LLM | Ollama + llama3.2 (local, on-device) |
| Graph Engine | NetworkX, PageRank, AST parsing |
| Database | Neo4j (graph persistence) |
| Auth | GitHub OAuth 2.0 |
| Security | pyzipper (AES-256), custom secret scanner |
| Version Control | GitPython |

---

## File Structure

```
repoatlas/
├── .env                        # Root env vars (backend reads this)
├── .env.example                # Template — copy to .env and fill in
├── .gitignore
│
├── backend/
│   ├── main.py                 # FastAPI app — all API endpoints
│   ├── analyzer.py             # Graph builder, AST parsing, PageRank, complexity
│   ├── secrets_scanner.py      # Secret/API key detection engine
│   ├── db.py                   # Neo4j driver and graph persistence
│   ├── diagram.py              # Architecture diagram PNG generator
│   └── requirements.txt        # Python dependencies
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── eslint.config.js
    ├── .env                    # Frontend env vars (VITE_ prefix)
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── constants.js        # Node type colors and config
        ├── index.css
        └── components/
            ├── GraphView.jsx       # Main graph canvas and toolbar
            ├── ArchNode.jsx        # Custom ReactFlow node component
            ├── DetailPanel.jsx     # File detail sidebar
            ├── SecretsPanel.jsx    # Secret scan results panel
            ├── EvolutionPanel.jsx  # Git history timeline
            ├── OnboardingPanel.jsx # Reading order panel
            ├── TourMode.jsx        # Guided tour overlay
            ├── QueryBar.jsx        # Natural language query input
            ├── StatsBar.jsx        # Repo stats bar
            ├── Legend.jsx          # Node type legend
            ├── LandingPage.jsx     # Home / repo input page
            └── RepoPickerModal.jsx # GitHub repo browser modal
```

---

## Prerequisites

Install these before starting:

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Ollama** — [ollama.com](https://ollama.com)
- **Neo4j** — [neo4j.com/download](https://neo4j.com/download) (Community Edition)
- **Git**

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/tejasnarwade/repoatlas.git
cd repoatlas
```

---

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Required for AI (use at least one)
GROQ_API_KEY="your_groq_api_key"          # https://console.groq.com
GOOGLE_API_KEY="your_google_api_key"      # https://aistudio.google.com

# Required for private repo access (optional for public repos)
GITHUB_ACCESS_TOKEN="your_github_pat"

# Required for GitHub OAuth login
GITHUB_CLIENT_ID="your_oauth_client_id"
GITHUB_CLIENT_SECRET="your_oauth_client_secret"

# Ollama settings (defaults work if Ollama runs locally)
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="llama3.2"

# Neo4j connection
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="your_neo4j_password"
```

Set the frontend env variable:

```bash
echo 'VITE_GITHUB_CLIENT_ID="your_oauth_client_id"' > frontend/.env
```

---

### 3. Set up Ollama

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull llama3.2

# Verify it works
ollama run llama3.2 "say hi"
```

Ollama runs as a background service on `http://localhost:11434` automatically after install.

---

### 4. Set up Neo4j

1. Download **Neo4j Desktop** from [neo4j.com/download](https://neo4j.com/download)
2. Install and open Neo4j Desktop
3. Click **New Project** → **Add** → **Local DBMS**
4. Give it a name, set a password, click **Create**
5. Click **Start** to start the database
6. The default bolt URI is `bolt://localhost:7687` — put your password in `.env` as `NEO4J_PASSWORD`

Verify Neo4j is running by opening `http://localhost:7474` in your browser — you should see the Neo4j browser UI.

---

### 5. Set up GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App
2. Fill in:
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://localhost:5173/auth/callback`
3. Copy the **Client ID** and **Client Secret** into `.env`

---

### 6. Set up the backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate          # Linux/macOS
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
```

---

### 7. Set up the frontend

```bash
cd frontend
npm install
```

---

## Running the App

You need **4 things running** at the same time. Open 3 terminals.

### Terminal 1 — Neo4j

Open **Neo4j Desktop** and click **Start** on your local DBMS.

Verify: open `http://localhost:7474` — you should see the Neo4j browser.

---

### Terminal 2 — Ollama

```bash
ollama serve
```

If Ollama was installed via the install script it may already be running as a service. Check:
```bash
curl http://localhost:11434/api/tags
```

If you get a JSON response, Ollama is already running — skip this terminal.

---

### Terminal 3 — Backend

```bash
cd repoatlas/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Expected output:
```
✓ Neo4j connected
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

If you see `⚠ Neo4j not available` — check Neo4j is started and your `NEO4J_URI`/`NEO4J_PASSWORD` in `.env` are correct.

---

### Terminal 4 — Frontend

```bash
cd repoatlas/frontend
npm run dev
```

Expected output:
```
  VITE v6.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in your browser.

---

## Verifying Everything Works

```bash
# Check backend health
curl http://localhost:8000/api/health
# Expected: {"status":"ok","neo4j":"connected"}

# Check Ollama
curl http://localhost:11434/api/tags
# Expected: JSON with llama3.2 listed

# Check Neo4j
curl http://localhost:7474
# Expected: HTML page
```

---

## Common Errors & Fixes

| Error | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'fastapi'` | Run `pip install -r requirements.txt` inside the venv |
| `✗ Neo4j not available` | Start Neo4j, check `NEO4J_URI` and `NEO4J_PASSWORD` in `.env` |
| `FileNotFoundError: No such file or directory` on uvicorn start | Your terminal's working directory was deleted — open a fresh terminal and `cd` to the backend folder |
| `ollama: command not found` | Install Ollama: `curl -fsSL https://ollama.com/install.sh \| sh` |
| `Error: llama3.2 not found` | Run `ollama pull llama3.2` |
| `CORS error` in browser | Make sure backend is running on port 8000 |
| `Failed to clone repo` | For private repos, set `GITHUB_ACCESS_TOKEN` in `.env` |
| Frontend shows blank page | Check `VITE_GITHUB_CLIENT_ID` is set in `frontend/.env` |
| `venv/bin/activate: No such file or directory` | Run `python3 -m venv venv` first inside the backend folder |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Clone and analyze a repo |
| POST | `/api/query` | Natural language query |
| POST | `/api/summary` | Get AI summary for a file |
| POST | `/api/review` | AI code review for a file |
| POST | `/api/secrets` | Scan repo for exposed secrets |
| POST | `/api/evolution` | Get git commit history |
| POST | `/api/diagram` | Generate architecture PNG |
| POST | `/api/export` | Download encrypted ZIP export |
| POST | `/api/auth/github` | GitHub OAuth token exchange |
| POST | `/api/auth/repos` | List user's GitHub repos |
| GET  | `/api/health` | Health check |

---

## Environment Variables Reference

### Root `.env` (backend)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Optional | Groq API key (fallback AI) |
| `GOOGLE_API_KEY` | Optional | Google Gemini API key (fallback AI) |
| `GITHUB_ACCESS_TOKEN` | Optional | GitHub PAT for private repos |
| `GITHUB_CLIENT_ID` | Yes (OAuth) | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes (OAuth) | GitHub OAuth App client secret |
| `OLLAMA_HOST` | Optional | Default: `http://localhost:11434` |
| `OLLAMA_MODEL` | Optional | Default: `llama3.2` |
| `NEO4J_URI` | Optional | Default: `bolt://localhost:7687` |
| `NEO4J_USER` | Optional | Default: `neo4j` |
| `NEO4J_PASSWORD` | Optional | Required if Neo4j auth is enabled |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_GITHUB_CLIENT_ID` | Yes (OAuth) | Same as `GITHUB_CLIENT_ID` above |
