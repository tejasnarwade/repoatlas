import os
import shutil
import tempfile
import asyncio
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from git import Repo, GitCommandError
from analyzer import build_graph, nl_query_subgraph

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI(title="RepoAtlas API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_ACCESS_TOKEN", "")

genai_client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None

# In-memory cache: repo_url -> analysis result
_cache: dict = {}

class AnalyzeRequest(BaseModel):
    repo_url: str

class QueryRequest(BaseModel):
    repo_url: str
    query: str

class SummaryRequest(BaseModel):
    repo_url: str
    file_id: str

def clone_repo(repo_url: str, dest: str):
    url = repo_url.strip()
    if GITHUB_TOKEN and "github.com" in url:
        url = url.replace("https://", f"https://{GITHUB_TOKEN}@")
    Repo.clone_from(url, dest, depth=1)

async def get_ai_summary(snippet: str, file_path: str, functions: list[str]) -> str:
    if not genai_client:
        return f"File: {file_path}. Contains: {', '.join(functions[:5]) if functions else 'no named symbols'}."
    try:
        prompt = (
            f"In 2-3 sentences, explain what this file does in plain English for a new developer.\n"
            f"File: {file_path}\n"
            f"Key symbols: {', '.join(functions[:10])}\n"
            f"Code snippet:\n```\n{snippet[:800]}\n```"
        )
        resp = await asyncio.to_thread(
            genai_client.models.generate_content,
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return resp.text.strip()
    except Exception:
        return f"File: {file_path}. Contains: {', '.join(functions[:5]) if functions else 'no named symbols'}."

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    if repo_url in _cache:
        result = _cache[repo_url]
        return {k: v for k, v in result.items() if k != "graph"}

    tmpdir = tempfile.mkdtemp()
    try:
        clone_repo(repo_url, tmpdir)
    except GitCommandError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to clone repo: {str(e)[:200]}")

    try:
        result = build_graph(tmpdir)
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

    # Generate AI summaries for top 20 high-impact nodes only (to stay fast)
    top_nodes = sorted(result["nodes"], key=lambda x: -x["impact"])[:20]
    summary_tasks = [
        get_ai_summary(n["snippet"], n["path"], n["functions"])
        for n in top_nodes
    ]
    summaries = await asyncio.gather(*summary_tasks)
    summary_map = {n["id"]: s for n, s in zip(top_nodes, summaries)}
    for node in result["nodes"]:
        node["summary"] = summary_map.get(node["id"], "")

    shutil.rmtree(tmpdir, ignore_errors=True)
    _cache[repo_url] = result
    return {k: v for k, v in result.items() if k != "graph"}

@app.post("/api/query")
async def query(req: QueryRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    # Auto re-analyze if cache was lost (e.g. server restart)
    if repo_url not in _cache:
        await analyze(AnalyzeRequest(repo_url=repo_url))
    result = _cache[repo_url]

    # Try AI-powered query first
    if genai_client:
        try:
            file_list = "\n".join([f"- {n['id']} ({n['type']})" for n in result["nodes"][:100]])
            prompt = (
                f"Given this list of files in a codebase:\n{file_list}\n\n"
                f"The user asks: \"{req.query}\"\n\n"
                f"Return ONLY a JSON array of file paths (from the list above) most relevant to this query. "
                f"Return at most 15 files. Example: [\"src/auth.py\", \"src/login.js\"]"
            )
            resp = await asyncio.to_thread(
                genai_client.models.generate_content,
                model="gemini-1.5-flash",
                contents=prompt,
            )
            text = resp.text.strip()
            import json, re
            match = re.search(r'\[.*?\]', text, re.DOTALL)
            if match:
                highlighted = json.loads(match.group())
                return {"highlighted": highlighted, "query": req.query}
        except Exception:
            pass

    highlighted = nl_query_subgraph(req.query, result["nodes"], result["edges"])
    return {"highlighted": highlighted, "query": req.query}

@app.post("/api/summary")
async def get_summary(req: SummaryRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    if repo_url not in _cache:
        raise HTTPException(status_code=404, detail="Repo not analyzed yet.")
    result = _cache[repo_url]
    node = next((n for n in result["nodes"] if n["id"] == req.file_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="File not found.")
    if node["summary"]:
        return {"summary": node["summary"]}
    summary = await get_ai_summary(node["snippet"], node["path"], node["functions"])
    node["summary"] = summary
    return {"summary": summary}

@app.get("/api/health")
def health():
    return {"status": "ok"}
