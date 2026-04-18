import os
import shutil
import tempfile
import asyncio
import json as _json
import re as _re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from git import Repo, GitCommandError
from analyzer import build_graph, nl_query_subgraph
from secrets_scanner import scan_repo_for_secrets

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI(title="RepoAtlas API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GITHUB_TOKEN   = os.getenv("GITHUB_ACCESS_TOKEN", "")

try:
    from groq import Groq
    groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
except ImportError:
    groq_client = None

try:
    from google import genai as _genai
    genai_client = _genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None
except Exception:
    genai_client = None

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

def _call_ai(prompt: str, system: str = "You are an expert code assistant.") -> str:
    """Call Groq first, fall back to Gemini. Returns text or raises."""
    if groq_client:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1024,
        )
        return resp.choices[0].message.content.strip()
    if genai_client:
        resp = genai_client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return resp.text.strip()
    raise RuntimeError("No AI client configured")

async def get_ai_summary(snippet: str, file_path: str, functions: list[str]) -> str:
    if not groq_client and not genai_client:
        return f"File: {file_path}. Contains: {', '.join(functions[:5]) if functions else 'no named symbols'}."
    try:
        prompt = (
            f"In 2-3 sentences, explain what this file does in plain English for a new developer.\n"
            f"File: {file_path}\n"
            f"Key symbols: {', '.join(functions[:10])}\n"
            f"Code snippet:\n```\n{snippet[:800]}\n```"
        )
        return await asyncio.to_thread(_call_ai, prompt)
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
    if repo_url not in _cache:
        await analyze(AnalyzeRequest(repo_url=repo_url))
    result = _cache[repo_url]

    # Build rich context: file list + summaries
    file_lines = []
    for n in result["nodes"]:
        summary = n.get("summary", "")
        funcs = ", ".join(n.get("functions", [])[:8])
        file_lines.append(f"- {n['id']} (type={n['type']}, loc={n['loc']}, funcs=[{funcs}]){': ' + summary if summary else ''}")
    file_context = "\n".join(file_lines[:200])

    if groq_client or genai_client:
        try:
            prompt = (
                f"You are an expert code assistant helping a developer understand a codebase.\n"
                f"Here are the files with types, line counts, key functions, and summaries:\n\n"
                f"{file_context}\n\n"
                f"Developer question: \"{req.query}\"\n\n"
                f"Respond with a JSON object with exactly two keys:\n"
                f"1. \"answer\": a clear 3-6 sentence explanation directly answering the question\n"
                f"2. \"files\": array of the most relevant file paths from the list above (max 10, only files that truly relate)\n"
                f"Return ONLY the raw JSON object. No markdown, no explanation outside JSON."
            )
            text = await asyncio.to_thread(_call_ai, prompt)
            text = _re.sub(r'^```(?:json)?\s*', '', text, flags=_re.MULTILINE)
            text = _re.sub(r'```\s*$', '', text, flags=_re.MULTILINE).strip()
            json_match = _re.search(r'\{.*\}', text, _re.DOTALL)
            if json_match:
                parsed = _json.loads(json_match.group())
                return {
                    "answer": parsed.get("answer", ""),
                    "highlighted": parsed.get("files", []),
                    "query": req.query,
                }
        except Exception:
            pass

    highlighted = nl_query_subgraph(req.query, result["nodes"], result["edges"])
    return {"answer": "", "highlighted": highlighted, "query": req.query}

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


class SecretsRequest(BaseModel):
    repo_url: str

@app.post("/api/secrets")
async def scan_secrets(req: SecretsRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    if repo_url not in _cache:
        await analyze(AnalyzeRequest(repo_url=repo_url))

    # Re-clone to a temp dir for scanning (cache only stores graph data, not files)
    tmpdir = tempfile.mkdtemp()
    try:
        clone_repo(repo_url, tmpdir)
        findings = await asyncio.to_thread(scan_repo_for_secrets, tmpdir)
        return {"findings": findings, "total": len(findings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
