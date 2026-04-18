import ast
import os
import re
from pathlib import Path
from collections import defaultdict
from datetime import timezone
import networkx as nx
from git import Repo

SUPPORTED_EXTS = {".py", ".js", ".ts", ".jsx", ".tsx"}

def get_all_files(repo_path: str) -> list[str]:
    files = []
    skip_dirs = {"node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", ".next"}
    for root, dirs, filenames in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in filenames:
            if Path(f).suffix in SUPPORTED_EXTS:
                files.append(os.path.join(root, f))
    return files

def extract_python_deps(filepath: str, repo_path: str) -> list[str]:
    deps = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            tree = ast.parse(f.read(), filename=filepath)
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                module = ""
                if isinstance(node, ast.ImportFrom) and node.module:
                    module = node.module
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        module = alias.name
                if module:
                    # Convert module path to file path
                    rel = module.replace(".", "/")
                    for ext in [".py", "/__init__.py"]:
                        candidate = os.path.join(repo_path, rel + ext)
                        if os.path.exists(candidate):
                            deps.append(candidate)
                            break
    except Exception:
        pass
    return deps

def extract_js_deps(filepath: str, repo_path: str) -> list[str]:
    deps = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        patterns = [
            r'(?:import|require)\s*\(?["\']([^"\']+)["\']',
            r'from\s+["\']([^"\']+)["\']',
        ]
        base_dir = os.path.dirname(filepath)
        for pattern in patterns:
            for match in re.finditer(pattern, content):
                imp = match.group(1)
                if not imp.startswith("."):
                    continue
                resolved = os.path.normpath(os.path.join(base_dir, imp))
                for ext in ["", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"]:
                    candidate = resolved + ext
                    if os.path.isfile(candidate):
                        deps.append(candidate)
                        break
    except Exception:
        pass
    return deps

def extract_functions(filepath: str) -> list[str]:
    funcs = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        ext = Path(filepath).suffix
        if ext == ".py":
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    funcs.append(node.name)
        else:
            for m in re.finditer(r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|class\s+(\w+))', content):
                name = m.group(1) or m.group(2) or m.group(3)
                if name:
                    funcs.append(name)
    except Exception:
        pass
    return funcs[:20]

def get_file_snippet(filepath: str, lines: int = 30) -> str:
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return "".join(f.readlines()[:lines])
    except Exception:
        return ""

def classify_file(filepath: str, rel_path: str) -> str:
    lower = rel_path.lower()
    name = Path(filepath).stem.lower()
    if any(x in lower for x in ["test", "spec", "__test__"]):
        return "test"
    if any(x in lower for x in ["config", "setting", "env", ".env"]):
        return "config"
    if any(x in lower for x in ["util", "helper", "common", "shared"]):
        return "utility"
    if any(x in lower for x in ["route", "controller", "handler", "endpoint", "api"]):
        return "api"
    if any(x in lower for x in ["model", "schema", "entity", "db", "database", "migration"]):
        return "model"
    if any(x in lower for x in ["service", "manager", "provider"]):
        return "service"
    if any(x in lower for x in ["component", "view", "page", "screen", "ui"]):
        return "ui"
    if name in ["main", "index", "app", "server", "init", "__init__"]:
        return "entry"
    if any(x in lower for x in ["auth", "login", "jwt", "oauth", "session"]):
        return "auth"
    if any(x in lower for x in ["payment", "billing", "stripe", "checkout"]):
        return "payment"
    return "module"

def get_commit_times(repo_path: str, files: list[str]) -> dict:
    """Returns {rel_path: {date, message, author}} for each file."""
    result = {}
    try:
        repo = Repo(repo_path)
        for fp in files:
            rel = os.path.relpath(fp, repo_path)
            try:
                commit = next(repo.iter_commits(paths=rel, max_count=1))
                result[rel] = {
                    "date": commit.committed_datetime.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                    "message": commit.message.strip().splitlines()[0][:80],
                    "author": commit.author.name,
                }
            except StopIteration:
                pass
    except Exception:
        pass
    return result

def build_graph(repo_path: str) -> dict:
    files = get_all_files(repo_path)
    if not files:
        return {"nodes": [], "edges": [], "stats": {}}

    commit_times = get_commit_times(repo_path, files)
    G = nx.DiGraph()
    file_data = {}

    for fp in files:
        rel = os.path.relpath(fp, repo_path)
        ext = Path(fp).suffix
        funcs = extract_functions(fp)
        ftype = classify_file(fp, rel)
        snippet = get_file_snippet(fp)
        try:
            size = os.path.getsize(fp)
            with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                loc = len(f.readlines())
        except Exception:
            size, loc = 0, 0

        file_data[fp] = {
            "id": rel,
            "path": rel,
            "abs_path": fp,
            "type": ftype,
            "ext": ext,
            "functions": funcs,
            "snippet": snippet,
            "loc": loc,
            "size": size,
            "last_commit": commit_times.get(rel),
        }
        G.add_node(rel)

    for fp, data in file_data.items():
        ext = data["ext"]
        if ext == ".py":
            deps = extract_python_deps(fp, repo_path)
        else:
            deps = extract_js_deps(fp, repo_path)
        for dep in deps:
            if dep in file_data:
                dep_rel = file_data[dep]["id"]
                G.add_edge(data["id"], dep_rel)

    # Compute impact scores
    in_degree = dict(G.in_degree())
    out_degree = dict(G.out_degree())
    try:
        pagerank = nx.pagerank(G, alpha=0.85)
    except Exception:
        pagerank = {n: 0 for n in G.nodes()}

    nodes = []
    for fp, data in file_data.items():
        rel = data["id"]
        impact = round(pagerank.get(rel, 0) * 1000, 4)
        nodes.append({
            "id": rel,
            "path": rel,
            "type": data["type"],
            "ext": data["ext"],
            "functions": data["functions"],
            "snippet": data["snippet"],
            "loc": data["loc"],
            "impact": impact,
            "in_degree": in_degree.get(rel, 0),
            "out_degree": out_degree.get(rel, 0),
            "summary": "",
            "last_commit": data["last_commit"],
        })

    edges = [{"source": u, "target": v} for u, v in G.edges()]

    # Onboarding path: entry points first, then by impact
    entry_nodes = [n for n in nodes if n["type"] == "entry"]
    high_impact = sorted([n for n in nodes if n["type"] not in ["test"]], key=lambda x: -x["impact"])
    seen = set()
    onboarding = []
    for n in entry_nodes + high_impact:
        if n["id"] not in seen:
            onboarding.append(n["id"])
            seen.add(n["id"])
        if len(onboarding) >= 10:
            break

    stats = {
        "total_files": len(nodes),
        "total_edges": len(edges),
        "languages": list({n["ext"] for n in nodes}),
    }

    return {
        "nodes": nodes,
        "edges": edges,
        "onboarding_path": onboarding,
        "stats": stats,
        "graph": G,
    }

def nl_query_subgraph(query: str, nodes: list, edges: list) -> list[str]:
    """Return node IDs relevant to a natural language query."""
    keywords_map = {
        "auth": ["auth", "login", "jwt", "oauth", "session", "token", "password", "user"],
        "payment": ["payment", "billing", "stripe", "checkout", "invoice", "order"],
        "database": ["db", "database", "model", "schema", "migration", "query", "orm"],
        "api": ["api", "route", "endpoint", "controller", "handler", "rest", "graphql"],
        "test": ["test", "spec", "mock", "fixture"],
        "config": ["config", "setting", "env", "environment"],
    }
    q = query.lower()
    keywords = []
    for topic, kws in keywords_map.items():
        if any(kw in q for kw in kws) or topic in q:
            keywords.extend(kws)
    if not keywords:
        keywords = q.split()

    matched = []
    for node in nodes:
        path_lower = node["id"].lower()
        funcs_lower = " ".join(node.get("functions", [])).lower()
        if any(kw in path_lower or kw in funcs_lower for kw in keywords):
            matched.append(node["id"])
    return matched
