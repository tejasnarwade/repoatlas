import os
import shutil
import tempfile
import asyncio
import json as _json
import re as _re
import re
import io
import pyzipper
from pathlib import Path
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from git import Repo, GitCommandError
from analyzer import build_graph, nl_query_subgraph, get_architecture_evolution
from secrets_scanner import scan_repo_for_secrets
#from diagram import generate_architecture_png
#from arch_doc import generate_architecture_pdf
import db

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI(title="RepoAtlas API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY         = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY       = os.getenv("GOOGLE_API_KEY", "")
GITHUB_TOKEN         = os.getenv("GITHUB_ACCESS_TOKEN", "")
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
OLLAMA_HOST          = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL         = os.getenv("OLLAMA_MODEL", "llama3.2")

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


@app.on_event("startup")
async def startup():
    try:
        db.ensure_constraints()
        print("✓ Neo4j connected")
    except Exception as e:
        print(f"⚠ Neo4j not available: {e} — running without persistence")


@app.on_event("shutdown")
async def shutdown():
    db.close_driver()


# ── Pydantic models ───────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    repo_url: str
    token: str = ""
    is_private: bool = False

class QueryRequest(BaseModel):
    repo_url: str
    query: str
    history: list[dict] = []
    file_contexts: list[str] = []
    is_private: bool = False

class SummaryRequest(BaseModel):
    repo_url: str
    file_id: str
    is_private: bool = False

class GithubCodeRequest(BaseModel):
    code: str

class ReposRequest(BaseModel):
    token: str

class SecretsRequest(BaseModel):
    repo_url: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def clone_repo(repo_url: str, dest: str, token: str = ""):
    url = repo_url.strip()
    use_token = token or GITHUB_TOKEN
    if use_token and "github.com" in url:
        url = url.replace("https://", f"https://{use_token}@")
    Repo.clone_from(url, dest, depth=1)


def _call_ollama(prompt: str, system: str, num_predict: int = 150) -> str:
    import urllib.request, json
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.2, "num_predict": num_predict},
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["message"]["content"].strip()


async def _call_ai(prompt: str, system: str = "You are an expert code assistant.", num_predict: int = 150) -> str:
    return await asyncio.to_thread(_call_ollama, prompt, system, num_predict)

async def get_ai_summary(snippet: str, file_path: str, functions: list[str],
                         last_commit: dict = None) -> str:
    lc = last_commit or {}
    commit_line = (
        f"Last commit: {lc['date']} by {lc['author']} — \"{lc['message']}\""
        if lc else "Last commit: unknown"
    )
    fallback = f"File: {file_path}. Contains: {', '.join(functions[:5]) if functions else 'no named symbols'}."
    try:
        prompt = (
            f"Explain this source file to a developer who is completely new to this codebase.\n"
            f"File: {file_path}\n"
            f"Language: {Path(file_path).suffix}\n"
            f"Functions and classes found: {', '.join(functions[:15]) if functions else 'none'}\n"
            f"{commit_line}\n"
            f"Code:\n{snippet[:300]}\n\n"
            f"Write a clear explanation covering ALL of these points:\n"
            f"1. What is this file for? What is its role in the project? (2-3 sentences)\n"
            f"2. What does each function or class do? Go through every single one listed above and explain it in one simple sentence each, like explaining to a junior developer. No jargon.\n"
            f"3. What changed recently? Based on the commit message, state specifically what was added or modified in one sentence.\n"
            f"Important: Do NOT start with phrases like 'I would be happy to', 'Sure!', 'Certainly!' or any filler. Start directly with the explanation.\n"
            f"Be thorough. Do not skip any function. Write in plain English only."
        )
        return _strip_markdown(await _call_ai(prompt))
    except Exception:
        return fallback


def _strip_markdown(text: str) -> str:
    """Remove common markdown formatting from AI output."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)   # **bold**
    text = re.sub(r'\*(.+?)\*',     r'\1', text)   # *italic*
    text = re.sub(r'__(.+?)__',     r'\1', text)   # __bold__
    text = re.sub(r'_(.+?)_',       r'\1', text)   # _italic_
    text = re.sub(r'^#{1,6}\s+',    '',    text, flags=re.MULTILINE)  # ## headers
    text = re.sub(r'`{1,3}',        '',    text)   # `code`
    return text.strip()


def _get_cached(repo_url: str) -> dict | None:
    """Try Neo4j first, return None if unavailable or not found."""
    try:
        return db.load_graph(repo_url)
    except Exception:
        return None


def _save_to_db(repo_url: str, result: dict):
    """Save graph to Neo4j, silently skip if unavailable."""
    try:
        db.save_graph(repo_url, result["nodes"], result["edges"])
    except Exception as e:
        print(f"⚠ Neo4j save failed: {e}")


# ── Analyze ───────────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    repo_url = req.repo_url.strip().rstrip("/")

    # Private repos always re-clone with fresh token — skip cache
    if not req.token:
        cached = _get_cached(repo_url)
        if cached:
            return cached

    tmpdir = tempfile.mkdtemp()
    try:
        clone_repo(repo_url, tmpdir, token=req.token)
    except GitCommandError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to clone repo: {str(e)[:200]}")

    try:
        result = build_graph(tmpdir)
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

    # Skip AI summaries at analyze time — generated on-demand via /api/summary
    for node in result["nodes"]:
        node["summary"] = ""

    shutil.rmtree(tmpdir, ignore_errors=True)

    # Persist to Neo4j
    _save_to_db(repo_url, result)

    resp = {k: v for k, v in result.items() if k != "graph"}
    return resp


# ── Query ─────────────────────────────────────────────────────────────────────

@app.post("/api/query")
async def query(req: QueryRequest):
    repo_url = req.repo_url.strip().rstrip("/")

    result = _get_cached(repo_url)
    if not result:
        await analyze(AnalyzeRequest(repo_url=repo_url, is_private=req.is_private))
        result = _get_cached(repo_url)
    if not result:
        raise HTTPException(status_code=404, detail="Repo not analyzed yet.")

    # Build rich file context — include summary, functions, type, loc for every file
    file_lines = []
    for n in result["nodes"]:
        summary = n.get("summary", "")
        funcs   = ", ".join(n.get("functions", [])[:10])
        lc      = n.get("last_commit") or {}
        lc_str  = f", last commit: {lc.get('date','')} by {lc.get('author','')}" if lc else ""
        file_lines.append(
            f"FILE: {n['id']}\n"
            f"  type={n['type']}, language={n['ext']}, lines={n['loc']}, "
            f"impact={n['impact']:.3f}, used_by={n['in_degree']}, imports={n['out_degree']}{lc_str}\n"
            f"  functions: {funcs if funcs else 'none'}\n"
            f"  summary: {summary if summary else 'no summary yet'}"
        )
    file_context = "\n\n".join(file_lines[:80])  # top 80 files

    # Build focused context for @-mentioned files — include full snippet
    focused_context = ""
    if req.file_contexts:
        focused_parts = []
        for fid in req.file_contexts:
            node = next((n for n in result["nodes"]
                         if n["id"] == fid or n["id"].endswith(fid) or fid in n["id"]), None)
            if node:
                funcs = ", ".join(node.get("functions", []))
                lc    = node.get("last_commit") or {}
                lc_str = f"Last commit: {lc.get('date','')} by {lc.get('author','')} — {lc.get('message','')}" if lc else ""
                # Find what this file imports and what imports it
                imports  = [e["target"] for e in result["edges"] if e["source"] == node["id"]]
                used_by  = [e["source"] for e in result["edges"] if e["target"] == node["id"]]
                focused_parts.append(
                    f"=== FOCUSED FILE: {node['id']} ===\n"
                    f"Type: {node['type']} | Language: {node['ext']} | Lines: {node['loc']} | Impact: {node['impact']:.3f}\n"
                    f"Functions/classes: {funcs}\n"
                    f"Imports: {', '.join(imports) if imports else 'none'}\n"
                    f"Used by: {', '.join(used_by) if used_by else 'none'}\n"
                    f"{lc_str}\n"
                    f"Existing summary: {node.get('summary','none')}\n"
                    f"Code:\n{node['snippet'][:2000]}"
                )
        if focused_parts:
            focused_context = "\n\nUSER TAGGED THESE FILES WITH @ — answer primarily about them:\n" + \
                              "\n\n".join(focused_parts) + "\n"

    # Build conversation history — last 8 messages for full sub-query context
    history_text = ""
    if req.history:
        history_lines = []
        for m in req.history[-8:]:
            role = "Developer" if m["role"] == "user" else "Assistant"
            history_lines.append(f"{role}: {m['text']}")
        history_text = "CONVERSATION HISTORY (for context on follow-up questions):\n" + \
                       "\n".join(history_lines) + "\n\n"

    try:
        system = (
            "You are an expert code assistant embedded in a repository analysis tool. "
            "You have full knowledge of the codebase structure, every file, its purpose, "
            "its functions, and how files connect to each other. "
            "When answering, always reference specific file names and function names. "
            "For follow-up questions, use the conversation history to understand context "
            "and give answers that build on previous answers. "
            "Never say you don't have access to the code — you have the full file list, "
            "summaries, and code snippets provided below."
        )

        prompt = (
            f"CODEBASE: {repo_url}\n"
            f"Total files: {result['stats']['total_files']} | "
            f"Languages: {', '.join(result['stats']['languages'])}\n\n"
            f"ALL FILES IN THE CODEBASE:\n{file_context}\n\n"
            f"{focused_context}"
            f"{history_text}"
            f"QUESTION: {req.query}\n\n"
            f"Instructions:\n"
            f"- Answer the question clearly and in detail\n"
            f"- Always reference specific file names (e.g. 'In server.js...', 'The auth.py file handles...')\n"
            f"- For sub-questions or follow-ups, refer back to what was discussed and build on it\n"
            f"- If asked about a specific file, explain what it does, its functions, and how it connects to other files\n"
            f"- If asked about a concept (e.g. 'how does auth work'), trace through the actual files involved\n"
            f"- Do NOT start with filler phrases like 'Great question' or 'Certainly'\n"
            f"- Write in plain English, no jargon\n\n"
            f"Respond with a JSON object with exactly two keys:\n"
            f"  answer: your full detailed answer as a string\n"
            f"  files: array of file paths most relevant to this answer (max 10)\n"
            f"Return ONLY the raw JSON. No markdown fences."
        )
        text = await _call_ai(prompt, system=system, num_predict=400)
        text = _re.sub(r'^```(?:json)?\s*', '', text, flags=_re.MULTILINE)
        text = _re.sub(r'```\s*$',          '', text, flags=_re.MULTILINE).strip()
        json_match = _re.search(r'\{.*\}', text, _re.DOTALL)
        if json_match:
            parsed = _json.loads(json_match.group())
            return {
                "answer":      _strip_markdown(parsed.get("answer", "")),
                "highlighted": parsed.get("files", []),
                "query":       req.query,
            }
    except Exception:
        pass

    highlighted = nl_query_subgraph(req.query, result["nodes"], result["edges"])
    return {"answer": "", "highlighted": highlighted, "query": req.query}


# ── Summary ───────────────────────────────────────────────────────────────────

@app.post("/api/summary")
async def get_summary(req: SummaryRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    result = _get_cached(repo_url)
    if not result:
        raise HTTPException(status_code=404, detail="Repo not analyzed yet.")
    node = next((n for n in result["nodes"] if n["id"] == req.file_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="File not found.")
    if node["summary"]:
        return {"summary": node["summary"]}
    summary = await get_ai_summary(
        node["snippet"], node["path"], node["functions"], node.get("last_commit")
    )
    # Persist updated summary back to Neo4j
    try:
        db.update_summary(repo_url, req.file_id, summary)
    except Exception:
        pass
    return {"summary": summary}


@app.get("/api/health")
def health():
    try:
        db.get_driver().verify_connectivity()
        neo4j_status = "connected"
    except Exception:
        neo4j_status = "unavailable"
    return {"status": "ok", "neo4j": neo4j_status}


# ── GitHub OAuth ──────────────────────────────────────────────────────────────

@app.post("/api/auth/github")
async def github_oauth(req: GithubCodeRequest):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured.")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": req.code,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail=f"GitHub OAuth failed: {token_data.get('error_description', token_data)}"
            )
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}",
                     "Accept": "application/vnd.github+json"},
            timeout=15,
        )
        user = user_resp.json()

    return {
        "access_token": access_token,
        "user": {
            "login":      user.get("login"),
            "name":       user.get("name") or user.get("login"),
            "avatar_url": user.get("avatar_url"),
        },
    }


@app.post("/api/auth/repos")
async def list_repos(req: ReposRequest):
    headers = {"Authorization": f"Bearer {req.token}",
               "Accept": "application/vnd.github+json"}
    repos = []
    async with httpx.AsyncClient() as client:
        for page in range(1, 11):
            resp = await client.get(
                "https://api.github.com/user/repos",
                params={
                    "per_page": 100, "page": page,
                    "sort": "updated",
                    "affiliation": "owner,collaborator,organization_member",
                },
                headers=headers,
                timeout=20,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code,
                                    detail=f"GitHub API error: {resp.text[:200]}")
            batch = resp.json()
            if not batch:
                break
            repos.extend(batch)

    return {
        "repos": [
            {
                "full_name":        r["full_name"],
                "name":             r["name"],
                "owner":            r["owner"]["login"],
                "private":          r["private"],
                "description":      r.get("description") or "",
                "language":         r.get("language") or "",
                "updated_at":       r.get("updated_at") or "",
                "stargazers_count": r.get("stargazers_count", 0),
                "url":              r["clone_url"],
                "default_branch":   r.get("default_branch", "main"),
            }
            for r in repos
        ]
    }


# ── Code Review ───────────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    repo_url: str
    file_id: str

@app.post("/api/review")
async def review_file(req: ReviewRequest):
    """AI code review: improvements, better approaches, or 'already optimized'."""
    repo_url = req.repo_url.strip().rstrip("/")
    result = _get_cached(repo_url)
    if not result:
        raise HTTPException(status_code=404, detail="Repo not analyzed yet.")
    node = next((n for n in result["nodes"] if n["id"] == req.file_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="File not found.")

    complexity = node.get("complexity", {})
    funcs = ", ".join(node.get("functions", [])[:15])
    lc = node.get("last_commit") or {}
    commit_line = f"Last commit: {lc.get('date','')} — {lc.get('message','')}" if lc else ""

    prompt = (
        f"Review this file as a senior engineer. Reply with ONLY a JSON object, no markdown.\n"
        f"File: {node['path']} | {node['type']} | {node['loc']} lines | complexity {complexity.get('score',0)}/100\n"
        f"Functions: {funcs}\n"
        f"Code:\n{node['snippet'][:400]}\n\n"
        f'JSON keys: verdict("optimized" or "needs_work"), score(0-100), '
        f'improvements(array of {{title,severity,description,fix}}), '
        f'better_approach(string), strengths(array of strings).'
    )

    try:
        text = await asyncio.wait_for(_call_ai(prompt, num_predict=600), timeout=90)
        text = _re.sub(r'^```(?:json)?\s*', '', text, flags=_re.MULTILINE)
        text = _re.sub(r'```\s*$', '', text, flags=_re.MULTILINE).strip()
        json_match = _re.search(r'\{.*\}', text, _re.DOTALL)
        if json_match:
            parsed = _json.loads(json_match.group())
            return {
                "verdict":         parsed.get("verdict", "needs_work"),
                "score":           parsed.get("score", 50),
                "improvements":    [
                    {
                        "title":       _strip_markdown(i.get("title", "")),
                        "severity":    i.get("severity", "medium"),
                        "description": _strip_markdown(i.get("description", "")),
                        "fix":         _strip_markdown(i.get("fix", "")),
                    }
                    for i in parsed.get("improvements", [])
                ],
                "better_approach": _strip_markdown(parsed.get("better_approach", "")),
                "strengths":       [_strip_markdown(s) for s in parsed.get("strengths", [])],
                "complexity":      complexity,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI review failed: {str(e)[:200]}")

    raise HTTPException(status_code=500, detail="Could not parse AI review response.")


# ── Architecture Evolution ───────────────────────────────────────────────────



# ── Architecture Diagram ──────────────────────────────────────────────────────

class DiagramRequest(BaseModel):
    repo_url: str
    password: str = ""

@app.post("/api/diagram")
async def generate_diagram(req: DiagramRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    result = _get_cached(repo_url)
    if not result:
        raise HTTPException(status_code=404, detail="Repo not analyzed yet. Analyze it first.")

    nodes = result["nodes"]
    edges = result["edges"]
    stats = result["stats"]

    top_files = ", ".join(
        f"{n['id']} ({n['type']})"
        for n in sorted(nodes, key=lambda x: -x["impact"])[:12]
    )
    desc_prompt = (
        "In exactly 2 sentences, describe the overall architecture of this codebase.\n"
        f"Repo: {repo_url}\n"
        f"Top files by impact: {top_files}\n"
        f"Languages: {', '.join(stats.get('languages', []))}\n"
        "Be specific about what the system does and how it is structured. No filler phrases."
    )
    try:
        ai_description = _strip_markdown(
            await asyncio.wait_for(_call_ai(desc_prompt, num_predict=100), timeout=45)
        )
    except Exception:
        ai_description = ""

    try:
        data, fmt = await asyncio.to_thread(
            generate_architecture_png,
            nodes, edges, repo_url, ai_description, req.password
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagram generation failed: {str(e)[:200]}")

    repo_name = repo_url.rstrip("/").split("/")[-1]
    if fmt == "zip":
        filename = f"repoatlas_architecture_{repo_name}.zip"
        media_type = "application/zip"
    else:
        filename = f"repoatlas_architecture_{repo_name}.png"
        media_type = "image/png"

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

class EvolutionRequest(BaseModel):
    repo_url: str
    token: str = ""

@app.post("/api/evolution")
async def architecture_evolution(req: EvolutionRequest):
    """Returns full commit history per file + repo-level timeline."""
    repo_url = req.repo_url.strip().rstrip("/")

    # Need to clone to get full git history
    tmpdir = tempfile.mkdtemp()
    try:
        # Clone WITHOUT depth=1 so we get full history
        url = repo_url.strip()
        use_token = req.token or GITHUB_TOKEN
        if use_token and "github.com" in url:
            url = url.replace("https://", f"https://{use_token}@")
        from git import Repo as GitRepo
        GitRepo.clone_from(url, tmpdir)  # full clone for history
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to clone repo: {str(e)[:200]}")

    try:
        from analyzer import get_all_files
        files = get_all_files(tmpdir)
        evolution = await asyncio.to_thread(get_architecture_evolution, tmpdir, files)
        return evolution
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ── Export ───────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    repo_url: str
    password: str

@app.post("/api/export")
async def export_graph(req: ExportRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    if not req.password or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    result = _get_cached(repo_url)
    if not result:
        raise HTTPException(status_code=404, detail="Repo not analyzed yet. Analyze it first.")

    repo_name = repo_url.rstrip("/").split("/")[-1]
    exported_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    nodes = result["nodes"]
    edges = result["edges"]
    stats = result["stats"]

    # ── 1. Generate human-readable guide via Ollama ──────────────────────────
    entry_nodes   = [n for n in nodes if n["type"] == "entry"]
    high_impact   = sorted(nodes, key=lambda x: -x["impact"])[:10]
    has_summaries = [n for n in nodes if n.get("summary")]

    file_overview = "\n".join(
        f"- {n['path']} ({n['type']}, {n['loc']} lines): {n.get('summary','').splitlines()[0] if n.get('summary') else 'no summary'}"
        for n in sorted(nodes, key=lambda x: -x["impact"])[:30]
    )
    dep_overview = "\n".join(
        f"- {e['source']} → {e['target']}"
        for e in edges[:40]
    )

    guide_prompt = (
        f"You are writing a comprehensive, plain-English guide to a codebase for a brand new developer joining the team.\n"
        f"Repository: {repo_url}\n"
        f"Total files: {stats['total_files']}, Total dependencies: {stats['total_edges']}\n"
        f"Languages: {', '.join(stats['languages'])}\n\n"
        f"Top files by impact:\n{file_overview}\n\n"
        f"Key dependency relationships:\n{dep_overview}\n\n"
        f"Write a detailed guide with these exact sections:\n"
        f"1. WHAT IS THIS PROJECT — explain in 3-4 sentences what this project does, who uses it, and what problem it solves. Be specific based on the file names and types.\n"
        f"2. HOW IT IS STRUCTURED — explain the folder/file structure in plain English. What goes where and why.\n"
        f"3. HOW IT WORKS — explain the flow of the application. Where does it start? What happens step by step? How do the main files connect?\n"
        f"4. KEY FILES TO KNOW — for each of the top 8 most important files, explain in 2-3 sentences what it does and why it matters.\n"
        f"5. WHERE TO START READING — give a numbered reading order for a new developer. Which file to open first, second, third, and why.\n"
        f"6. COMMON TASKS — based on the file types and names, give 4-5 examples of common things a developer would do in this codebase (e.g. 'To add a new API endpoint, go to...').\n\n"
        f"Write in simple, clear English. No jargon. Imagine explaining to someone on their first day."
    )

    try:
        guide_text = await asyncio.wait_for(_call_ai(guide_prompt, num_predict=800), timeout=120)
    except Exception:
        guide_text = "AI guide could not be generated. See summaries.md for per-file explanations."

    # ── 2. summaries.md — per-file explanations in markdown ─────────────────
    summaries_md = f"# File Summaries — {repo_name}\n\nGenerated by RepoAtlas on {exported_at}\n\n---\n\n"
    for n in sorted(nodes, key=lambda x: -x["impact"]):
        if not n.get("summary"):
            continue
        lc = n.get("last_commit") or {}
        commit_line = f"\n> Last commit: {lc.get('date','')} by {lc.get('author','')} — {lc.get('message','')}" if lc else ""
        funcs = ", ".join(n.get("functions", [])[:8])
        summaries_md += (
            f"## `{n['path']}`\n"
            f"**Type:** {n['type']} | **Language:** {n['ext']} | "
            f"**Lines:** {n['loc']} | **Impact:** {n['impact']:.3f}\n"
            f"{commit_line}\n\n"
            f"{n['summary']}\n\n"
            f"{f'**Key symbols:** `{funcs}`' if funcs else ''}\n\n---\n\n"
        )

    # ── 3. dependency_map.md — human readable dependency list ────────────────
    dep_map: dict = {}
    for e in edges:
        dep_map.setdefault(e["source"], []).append(e["target"])

    dep_md = f"# Dependency Map — {repo_name}\n\nGenerated by RepoAtlas on {exported_at}\n\n---\n\n"
    for src, targets in sorted(dep_map.items()):
        dep_md += f"### `{src}`\nImports:\n"
        for t in targets:
            dep_md += f"- `{t}`\n"
        dep_md += "\n"

    # ── 4. onboarding.md — reading order for new joinee ─────────────────────
    onboarding_md = f"# Onboarding Reading Order — {repo_name}\n\nGenerated by RepoAtlas on {exported_at}\n\nRead these files in this order to understand the codebase:\n\n"
    for i, fid in enumerate(result["onboarding_path"], 1):
        node = next((n for n in nodes if n["id"] == fid), None)
        summary_line = node.get("summary", "").splitlines()[0] if node and node.get("summary") else ""
        onboarding_md += f"{i}. **`{fid}`**\n   {summary_line}\n\n"

    # ── 5. nodes.json + edges.json + stats.json (raw data) ───────────────────
    nodes_data = [
        {
            "id": n["id"], "path": n["path"], "type": n["type"],
            "language": n["ext"], "lines": n["loc"], "impact": n["impact"],
            "in_degree": n["in_degree"], "out_degree": n["out_degree"],
            "functions": n.get("functions", []),
            "summary": n.get("summary", ""),
            "last_commit": n.get("last_commit"),
        }
        for n in nodes
    ]
    stats_data = {
        "repo_url": repo_url, "exported_at": exported_at,
        "total_files": stats["total_files"], "total_edges": stats["total_edges"],
        "languages": stats["languages"],
        "high_impact_files": len([n for n in nodes if n["impact"] > 0.5]),
        "onboarding_path": result["onboarding_path"],
    }

    # ── 6. GUIDE.txt — the main human-readable document ──────────────────────
    guide_full = f"""REPOATLAS CODEBASE GUIDE
========================
Repository:  {repo_url}
Generated:   {exported_at}
Total files: {stats['total_files']} | Dependencies: {stats['total_edges']} | Languages: {', '.join(stats['languages'])}

{'='*60}

{guide_text}

{'='*60}
Generated by RepoAtlas — AI runs 100% locally via Ollama.
No code was sent to any external server.
{'='*60}
"""

    # ── Build encrypted ZIP ───────────────────────────────────────────────────
    buf = io.BytesIO()
    with pyzipper.AESZipFile(buf, "w",
                             compression=pyzipper.ZIP_DEFLATED,
                             encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(req.password.encode())
        # Human-readable documents first
        zf.writestr(f"{repo_name}/GUIDE.txt",           guide_full)
        zf.writestr(f"{repo_name}/summaries.md",        summaries_md)
        zf.writestr(f"{repo_name}/onboarding.md",       onboarding_md)
        zf.writestr(f"{repo_name}/dependency_map.md",   dep_md)
        # Raw data
        zf.writestr(f"{repo_name}/data/nodes.json",     _json.dumps(nodes_data, indent=2))
        zf.writestr(f"{repo_name}/data/edges.json",     _json.dumps(edges, indent=2))
        zf.writestr(f"{repo_name}/data/stats.json",     _json.dumps(stats_data, indent=2))
    buf.seek(0)

    filename = f"repoatlas_{repo_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Secrets ───────────────────────────────────────────────────────────────────

@app.post("/api/secrets")
async def scan_secrets(req: SecretsRequest):
    repo_url = req.repo_url.strip().rstrip("/")
    tmpdir = tempfile.mkdtemp()
    try:
        clone_repo(repo_url, tmpdir)
        findings = await asyncio.to_thread(scan_repo_for_secrets, tmpdir)
        return {"findings": findings, "total": len(findings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
