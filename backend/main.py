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
    history: list[dict] = []
    file_contexts: list[str] = []  # list of file IDs tagged with @

class SummaryRequest(BaseModel):
    repo_url: str
    file_id: str

def clone_repo(repo_url: str, dest: str):
    url = repo_url.strip()
    if GITHUB_TOKEN and "github.com" in url:
        url = url.replace("https://", f"https://{GITHUB_TOKEN}@")
    Repo.clone_from(url, dest, depth=1)

def _call_ai(prompt: str, system: str = "You are an expert code assistant.") -> str:
    if groq_client:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2048,
        )
        return resp.choices[0].message.content.strip()
    if genai_client:
        resp = genai_client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return resp.text.strip()
    raise RuntimeError("No AI client configured")

async def get_ai_summary(snippet: str, file_path: str, functions: list[str], last_commit: dict = None) -> str:
    if not groq_client and not genai_client:
        return f"File: {file_path}. Contains: {', '.join(functions[:5]) if functions else 'no named symbols'}."
    lc = last_commit or {}
    commit_line = (
        f"Last commit: {lc['date']} by {lc['author']} — \"{lc['message']}\""
        if lc else "Last commit: unknown"
    )
    try:
        prompt = (
            f"You are explaining a source file to a developer who is new to this codebase.\n"
            f"File: {file_path}\n"
            f"Key symbols: {', '.join(functions[:15])}\n"
            f"{commit_line}\n"
            f"Code snippet:\n```\n{snippet[:1200]}\n```\n\n"
            f"Write a clear explanation with three parts:\n"
            f"1. PURPOSE (1-2 sentences): What is this file's overall role in the project? What problem does it solve?\n"
            f"2. WHAT IT DOES (bullet points): For each key function/class listed above, explain in plain English what it does — no jargon, as if explaining to a junior developer.\n"
            f"3. RECENT CHANGE (1 sentence): Based on the last commit message, briefly describe what was recently changed or added in this file.\n"
            f"Keep it simple, specific, and useful."
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

    top_nodes = sorted(result["nodes"], key=lambda x: -x["impact"])[:20]
    summary_tasks = [
        get_ai_summary(n["snippet"], n["path"], n["functions"], n.get("last_commit"))
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

    file_lines = []
    for n in result["nodes"]:
        summary = n.get("summary", "")
        funcs = ", ".join(n.get("functions", [])[:8])
        file_lines.append(f"- {n['id']} (type={n['type']}, loc={n['loc']}, funcs=[{funcs}]){': ' + summary if summary else ''}")
    file_context = "\n".join(file_lines[:200])

    # Build focused context for @-mentioned files
    focused_context = ""
    if req.file_contexts:
        focused_parts = []
        for fid in req.file_contexts:
            node = next((n for n in result["nodes"] if n["id"] == fid or n["id"].endswith(fid) or fid in n["id"]), None)
            if node:
                funcs = ", ".join(node.get("functions", []))
                lc = node.get("last_commit") or {}
                commit_info = f", last commit: {lc.get('date','')} — {lc.get('message','')}" if lc else ""
                focused_parts.append(
                    f"=== @{node['id']} (type={node['type']}, {node['loc']} lines{commit_info}) ===\n"
                    f"Functions/classes: {funcs}\n"
                    f"Code:\n```\n{node['snippet'][:1500]}\n```"
                )
        if focused_parts:
            focused_context = "\nFOCUSED FILE CONTEXT (user tagged these files with @):\n" + "\n\n".join(focused_parts) + "\n"

    if groq_client or genai_client:
        try:
            history_text = ""
            if req.history:
                history_text = "Conversation so far:\n" + "\n".join(
                    f"{m['role'].upper()}: {m['text']}" for m in req.history[-6:]
                ) + "\n\n"
            prompt = (
                f"You are an expert code assistant helping a developer understand a codebase.\n"
                f"Here are the files with types, line counts, key functions, and summaries:\n\n"
                f"{file_context}\n"
                f"{focused_context}"
                f"{history_text}"
                f"Developer question: \"{req.query}\"\n\n"
                f"{'Since the user tagged specific files with @, focus your answer primarily on those files.' if focused_context else ''}\n"
                f"Respond with a JSON object with exactly two keys:\n"
                f"1. \"answer\": a clear detailed explanation directly answering the question. If @files were tagged, deeply analyse those files — explain what specific functions do, what improvements could be made, any bugs or issues you see.\n"
                f"2. \"files\": array of the most relevant file paths from the list above (max 10)\n"
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
    summary = await get_ai_summary(node["snippet"], node["path"], node["functions"], node.get("last_commit"))
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

    tmpdir = tempfile.mkdtemp()
    try:
        clone_repo(repo_url, tmpdir)
        findings = await asyncio.to_thread(scan_repo_for_secrets, tmpdir)
        return {"findings": findings, "total": len(findings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
