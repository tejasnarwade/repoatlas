# RepoAtlas — Repository Architecture Navigator

Instantly understand any GitHub codebase via an interactive architecture graph with AI-powered explanations.

## Setup

### 1. Configure API keys
Edit `.env` in the project root:
```
GOOGLE_API_KEY="AIzaSyBj4dsfW288bjHGT5wLuIL9SFWClug1H6E"
GITHUB_ACCESS_TOKEN="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"

```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Features
- Interactive dependency graph (React Flow)
- AI summaries per file (Gemini 1.5 Flash)
- High-impact file highlighting (PageRank)
- Onboarding path recommendation
- Natural language queries ("where is auth handled?")
- Type-based filtering (entry, api, model, service, utility, ui, auth, payment, test, config)
