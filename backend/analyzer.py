import ast
import os
import re
from pathlib import Path
from collections import defaultdict
from datetime import timezone
import networkx as nx
from git import Repo

SUPPORTED_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss", ".sass", ".less",
    ".java", ".kt", ".go", ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".rs", ".swift",
    ".json", ".yaml", ".yml", ".toml", ".xml", ".env", ".ini", ".cfg", ".conf",
    ".sh", ".bash", ".zsh", ".fish", ".ps1",
    ".md", ".mdx", ".rst", ".txt",
    ".sql",
    ".vue", ".svelte", ".graphql", ".gql", ".proto", ".r", ".scala", ".lua",
}

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
            r'(?:import|require)\s*\(?["\']([\./][^"\']+)["\']',
            r'from\s+["\']([\./][^"\']+)["\']',
        ]
        base_dir = os.path.dirname(filepath)
        for pattern in patterns:
            for match in re.finditer(pattern, content):
                imp = match.group(1)
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
        ext = Path(filepath).suffix.lower()
        if ext == ".py":
            try:
                tree = ast.parse(content)
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                        funcs.append(node.name)
            except Exception:
                pass
        elif ext in {".js", ".ts", ".jsx", ".tsx", ".vue", ".svelte"}:
            for m in re.finditer(r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\(|\w+\s*=>)|class\s+(\w+))', content):
                name = m.group(1) or m.group(2) or m.group(3)
                if name:
                    funcs.append(name)
        elif ext in {".java", ".kt", ".cs", ".scala"}:
            for m in re.finditer(r'(?:public|private|protected|static|\s)\s+\w+\s+(\w+)\s*\(', content):
                funcs.append(m.group(1))
        elif ext == ".go":
            for m in re.finditer(r'func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(', content):
                funcs.append(m.group(1))
        elif ext == ".rb":
            for m in re.finditer(r'def\s+(\w+)', content):
                funcs.append(m.group(1))
        elif ext == ".php":
            for m in re.finditer(r'function\s+(\w+)\s*\(', content):
                funcs.append(m.group(1))
        elif ext in {".c", ".cpp", ".h", ".rs", ".swift"}:
            for m in re.finditer(r'(?:fn|func|void|int|bool|string|auto)\s+(\w+)\s*\(', content):
                funcs.append(m.group(1))
        elif ext == ".sql":
            for m in re.finditer(r'(?:CREATE|ALTER)\s+(?:TABLE|VIEW|FUNCTION|PROCEDURE)\s+(\w+)', content, re.IGNORECASE):
                funcs.append(m.group(1))
        elif ext in {".graphql", ".gql"}:
            for m in re.finditer(r'(?:type|query|mutation|subscription|fragment)\s+(\w+)', content):
                funcs.append(m.group(1))
        elif ext == ".html":
            for m in re.finditer(r'id=["\']([\w-]+)["\']', content):
                funcs.append(m.group(1))
    except Exception:
        pass
    return funcs[:20]


def extract_call_graph(filepath: str, all_functions: dict) -> list[dict]:
    """
    Extract function-level call graph for a file.
    Returns list of {caller, callee, callee_file} dicts.
    all_functions: {func_name: file_rel_path} — global map of known functions
    """
    calls = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        ext = Path(filepath).suffix.lower()

        if ext == ".py":
            try:
                tree = ast.parse(content)
                # Build local function map
                local_funcs = {}
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        local_funcs[node.name] = node

                for func_name, func_node in local_funcs.items():
                    for node in ast.walk(func_node):
                        if isinstance(node, ast.Call):
                            callee = None
                            if isinstance(node.func, ast.Name):
                                callee = node.func.id
                            elif isinstance(node.func, ast.Attribute):
                                callee = node.func.attr
                            if callee and callee in all_functions and callee != func_name:
                                calls.append({
                                    "caller": func_name,
                                    "callee": callee,
                                    "callee_file": all_functions[callee],
                                })
            except Exception:
                pass
        else:
            # For JS/TS: regex-based call detection
            func_names = [m.group(1) or m.group(2) or m.group(3)
                          for m in re.finditer(r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\()|class\s+(\w+))', content)
                          if m.group(1) or m.group(2) or m.group(3)]
            for func_name in func_names:
                # Find calls inside this function's body (simplified: look for known function names called)
                # Find the function body
                pattern = rf'(?:function\s+{re.escape(func_name)}\s*\(|(?:const|let|var)\s+{re.escape(func_name)}\s*=\s*(?:async\s*)?(?:function|\())[^{{]*\{{([\s\S]{{0,2000}}?)\}}'
                body_match = re.search(pattern, content)
                if body_match:
                    body = body_match.group(1)
                    for callee in all_functions:
                        if callee != func_name and re.search(rf'\b{re.escape(callee)}\s*\(', body):
                            calls.append({
                                "caller": func_name,
                                "callee": callee,
                                "callee_file": all_functions[callee],
                            })
    except Exception:
        pass
    return calls[:50]  # cap per file


def compute_complexity(node_data: dict, in_deg: int, out_deg: int, call_count: int) -> dict:
    """
    Compute a complexity score 0-100 and breakdown for a file.
    Factors:
      - LOC (lines of code)
      - Function/class count
      - In-degree (how many files depend on this)
      - Out-degree (how many files this depends on)
      - Call graph size (function-level coupling)
      - Cyclomatic complexity proxy (if/else/for/while/try count in snippet)
    """
    loc   = node_data.get("loc", 0)
    funcs = len(node_data.get("functions", []))
    snippet = node_data.get("snippet", "")

    # Cyclomatic proxy: count branching keywords
    branch_keywords = len(re.findall(
        r'\b(if|elif|else|for|while|try|except|catch|switch|case|&&|\|\|)\b', snippet
    ))

    # Normalised scores (0-100 each)
    loc_score    = min(loc / 10, 100)           # 1000 LOC = 100
    func_score   = min(funcs * 5, 100)          # 20 funcs = 100
    dep_score    = min((in_deg + out_deg) * 4, 100)  # 25 deps = 100
    branch_score = min(branch_score_val := branch_keywords * 6, 100)  # 17 branches = 100
    call_score   = min(call_count * 3, 100)     # 33 calls = 100

    # Weighted average
    total = round(
        loc_score    * 0.25 +
        func_score   * 0.20 +
        dep_score    * 0.25 +
        branch_score * 0.20 +
        call_score   * 0.10
    )

    # Heat level
    if total >= 75:   heat = "critical"
    elif total >= 50: heat = "high"
    elif total >= 25: heat = "medium"
    else:             heat = "low"

    return {
        "score":        total,
        "heat":         heat,
        "breakdown": {
            "loc":        round(loc_score),
            "functions":  round(func_score),
            "coupling":   round(dep_score),
            "branching":  round(branch_score),
            "call_graph": round(call_score),
        }
    }


    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return "".join(f.readlines()[:lines])
    except Exception:
        return ""

def get_file_snippet(filepath: str, lines: int = 30) -> str:
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return "".join(f.readlines()[:lines])
    except Exception:
        return ""

def classify_file(filepath: str, rel_path: str) -> str:
    lower = rel_path.lower()
    name = Path(filepath).stem.lower()
    ext = Path(filepath).suffix.lower()
    if any(x in lower for x in ["test", "spec", "__test__", "_test"]):
        return "test"
    if ext in {".md", ".mdx", ".rst", ".txt"}:
        return "config"
    if ext in {".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".cfg", ".conf", ".env"} or any(x in lower for x in ["config", "setting", "env", ".env"]):
        return "config"
    if ext in {".sh", ".bash", ".zsh", ".fish", ".ps1"}:
        return "utility"
    if ext in {".sql"}:
        return "model"
    if ext in {".css", ".scss", ".sass", ".less"}:
        return "ui"
    if ext == ".html" or any(x in lower for x in ["template", "view", "page"]):
        return "ui"
    if ext in {".vue", ".svelte"}:
        return "ui"
    if ext in {".graphql", ".gql", ".proto"}:
        return "api"
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
    """Returns {rel_path: {date, message, author}} for each file — last commit only."""
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


def get_commit_history(repo_path: str, files: list[str], max_commits: int = 30) -> dict:
    """
    Returns full commit history per file (up to max_commits).
    Also returns repo-level timeline: list of {hash, date, message, author, files_changed}
    """
    file_history = {}   # rel_path -> [{date, message, author, hash}]
    repo_timeline = []  # [{hash, date, message, author, files_changed: [rel_path]}]

    try:
        repo = Repo(repo_path)
        rel_set = {os.path.relpath(fp, repo_path) for fp in files}

        # Per-file history
        for fp in files:
            rel = os.path.relpath(fp, repo_path)
            commits = []
            try:
                for commit in repo.iter_commits(paths=rel, max_count=max_commits):
                    commits.append({
                        "hash":    commit.hexsha[:8],
                        "date":    commit.committed_datetime.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                        "message": commit.message.strip().splitlines()[0][:80],
                        "author":  commit.author.name,
                    })
            except Exception:
                pass
            if commits:
                file_history[rel] = commits

        # Repo-level timeline: walk all commits, record which tracked files changed
        seen_hashes = set()
        for commit in repo.iter_commits(max_count=max_commits):
            if commit.hexsha in seen_hashes:
                continue
            seen_hashes.add(commit.hexsha)
            try:
                changed = []
                if commit.parents:
                    diff = commit.parents[0].diff(commit)
                    for d in diff:
                        p = d.b_path or d.a_path
                        if p in rel_set:
                            changed.append(p)
                else:
                    # Initial commit
                    for item in commit.tree.traverse():
                        if hasattr(item, 'path') and item.path in rel_set:
                            changed.append(item.path)
                repo_timeline.append({
                    "hash":          commit.hexsha[:8],
                    "date":          commit.committed_datetime.astimezone(timezone.utc).strftime("%Y-%m-%d"),
                    "message":       commit.message.strip().splitlines()[0][:80],
                    "author":        commit.author.name,
                    "files_changed": changed,
                })
            except Exception:
                continue

    except Exception:
        pass

    return {"file_history": file_history, "repo_timeline": repo_timeline}


def detect_orphans(nodes: list, edges: list) -> list[str]:
    """
    Detect orphaned/isolated modules:
    - in_degree == 0 AND out_degree == 0 (completely disconnected)
    - not an entry point, config, or test file
    These add cognitive load without contributing to the dependency graph.
    """
    skip_types = {"entry", "config", "test"}
    orphans = []
    for n in nodes:
        if n["type"] in skip_types:
            continue
        if n["in_degree"] == 0 and n["out_degree"] == 0:
            orphans.append(n["id"])
    return orphans


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
            "id":          rel,
            "path":        rel,
            "abs_path":    fp,
            "type":        ftype,
            "ext":         ext,
            "functions":   funcs,
            "snippet":     snippet,
            "loc":         loc,
            "size":        size,
            "last_commit": commit_times.get(rel),
        }
        G.add_node(rel)

    # Build global function → file map for call graph
    all_functions: dict[str, str] = {}
    for fp, data in file_data.items():
        for fn in data["functions"]:
            if fn not in all_functions:
                all_functions[fn] = data["id"]

    # Build file-level dependency edges
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

    # Build call graphs per file
    call_graphs: dict[str, list] = {}
    for fp, data in file_data.items():
        ext = data["ext"]
        if ext in {".py", ".js", ".ts", ".jsx", ".tsx"}:
            calls = extract_call_graph(fp, all_functions)
            if calls:
                call_graphs[data["id"]] = calls

    # Compute impact scores
    in_degree  = dict(G.in_degree())
    out_degree = dict(G.out_degree())
    try:
        pagerank = nx.pagerank(G, alpha=0.85)
    except Exception:
        pagerank = {n: 0 for n in G.nodes()}

    nodes = []
    for fp, data in file_data.items():
        rel = data["id"]
        impact = round(pagerank.get(rel, 0) * 1000, 4)
        call_count = len(call_graphs.get(rel, []))
        complexity = compute_complexity(
            data,
            in_degree.get(rel, 0),
            out_degree.get(rel, 0),
            call_count,
        )
        nodes.append({
            "id":          rel,
            "path":        rel,
            "type":        data["type"],
            "ext":         data["ext"],
            "functions":   data["functions"],
            "snippet":     data["snippet"],
            "loc":         data["loc"],
            "impact":      impact,
            "in_degree":   in_degree.get(rel, 0),
            "out_degree":  out_degree.get(rel, 0),
            "summary":     "",
            "last_commit": data["last_commit"],
            "call_graph":  call_graphs.get(rel, []),
            "complexity":  complexity,
        })

    edges = [{"source": u, "target": v} for u, v in G.edges()]

    # Detect orphaned modules
    orphans = detect_orphans(nodes, edges)

    # Mark orphan nodes
    for node in nodes:
        node["is_orphan"] = node["id"] in set(orphans)

    # Onboarding path
    entry_nodes = [n for n in nodes if n["type"] == "entry"]
    high_impact = sorted([n for n in nodes if n["type"] not in ["test"]], key=lambda x: -x["impact"])
    seen, onboarding = set(), []
    for n in entry_nodes + high_impact:
        if n["id"] not in seen:
            onboarding.append(n["id"])
            seen.add(n["id"])
        if len(onboarding) >= 10:
            break

    stats = {
        "total_files":  len(nodes),
        "total_edges":  len(edges),
        "languages":    list({n["ext"] for n in nodes}),
        "orphan_count": len(orphans),
    }

    return {
        "nodes":           nodes,
        "edges":           edges,
        "onboarding_path": onboarding,
        "orphans":         orphans,
        "stats":           stats,
        "graph":           G,
    }


def get_architecture_evolution(repo_path: str, files: list[str]) -> dict:
    """Public entry point for commit history — called from the API endpoint."""
    return get_commit_history(repo_path, files, max_commits=50)


def nl_query_subgraph(query: str, nodes: list, edges: list) -> list[str]:
    keywords_map = {
        "auth":     ["auth", "login", "jwt", "oauth", "session", "token", "password", "user"],
        "payment":  ["payment", "billing", "stripe", "checkout", "invoice", "order"],
        "database": ["db", "database", "model", "schema", "migration", "query", "orm"],
        "api":      ["api", "route", "endpoint", "controller", "handler", "rest", "graphql"],
        "test":     ["test", "spec", "mock", "fixture"],
        "config":   ["config", "setting", "env", "environment"],
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
