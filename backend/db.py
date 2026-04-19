"""
Neo4j persistence layer for RepoAtlas.

Schema:
  (:Repo   {url, analyzed_at})
  (:File   {id, repo_url, path, type, ext, loc, impact,
            in_degree, out_degree, summary, snippet,
            functions, last_commit_date, last_commit_msg, last_commit_author})
  (:File)-[:IMPORTS]->(:File)
  (:Repo)-[:HAS_FILE]->(:File)
"""

import os
import json
from datetime import datetime, timezone
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "repoatlas")

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return _driver


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def ensure_constraints():
    """Create uniqueness constraints once on startup."""
    with get_driver().session() as s:
        s.run("CREATE CONSTRAINT repo_url IF NOT EXISTS FOR (r:Repo) REQUIRE r.url IS UNIQUE")
        s.run("CREATE CONSTRAINT file_id  IF NOT EXISTS FOR (f:File) REQUIRE (f.repo_url, f.id) IS UNIQUE")


def repo_exists(repo_url: str) -> bool:
    """Return True if this repo has already been analyzed and stored."""
    with get_driver().session() as s:
        result = s.run("MATCH (r:Repo {url: $url}) RETURN r LIMIT 1", url=repo_url)
        return result.single() is not None


def save_graph(repo_url: str, nodes: list, edges: list):
    """Persist the full graph to Neo4j. Overwrites existing data for this repo."""
    with get_driver().session() as s:
        # Upsert Repo node
        s.run(
            "MERGE (r:Repo {url: $url}) SET r.analyzed_at = $ts",
            url=repo_url,
            ts=datetime.now(timezone.utc).isoformat(),
        )

        # Delete old File nodes for this repo (clean re-analysis)
        s.run(
            "MATCH (f:File {repo_url: $url}) DETACH DELETE f",
            url=repo_url,
        )

        # Batch-create File nodes
        s.run(
            """
            UNWIND $nodes AS n
            MATCH (r:Repo {url: n.repo_url})
            MERGE (f:File {repo_url: n.repo_url, id: n.id})
            SET f += {
                path:                n.path,
                type:                n.type,
                ext:                 n.ext,
                loc:                 n.loc,
                impact:              n.impact,
                in_degree:           n.in_degree,
                out_degree:          n.out_degree,
                summary:             n.summary,
                snippet:             n.snippet,
                functions:           n.functions,
                last_commit_date:    n.last_commit_date,
                last_commit_msg:     n.last_commit_msg,
                last_commit_author:  n.last_commit_author
            }
            MERGE (r)-[:HAS_FILE]->(f)
            """,
            nodes=[
                {
                    "repo_url":           repo_url,
                    "id":                 n["id"],
                    "path":               n["path"],
                    "type":               n["type"],
                    "ext":                n["ext"],
                    "loc":                n["loc"],
                    "impact":             n["impact"],
                    "in_degree":          n["in_degree"],
                    "out_degree":         n["out_degree"],
                    "summary":            n.get("summary", ""),
                    "snippet":            n.get("snippet", ""),
                    "functions":          json.dumps(n.get("functions", [])),
                    "last_commit_date":   (n.get("last_commit") or {}).get("date", ""),
                    "last_commit_msg":    (n.get("last_commit") or {}).get("message", ""),
                    "last_commit_author": (n.get("last_commit") or {}).get("author", ""),
                }
                for n in nodes
            ],
        )

        # Batch-create IMPORTS edges
        if edges:
            s.run(
                """
                UNWIND $edges AS e
                MATCH (a:File {repo_url: $url, id: e.source})
                MATCH (b:File {repo_url: $url, id: e.target})
                MERGE (a)-[:IMPORTS]->(b)
                """,
                url=repo_url,
                edges=edges,
            )


def load_graph(repo_url: str) -> dict | None:
    """Load a previously stored graph from Neo4j. Returns None if not found."""
    with get_driver().session() as s:
        # Check repo exists
        repo = s.run("MATCH (r:Repo {url: $url}) RETURN r", url=repo_url).single()
        if not repo:
            return None

        # Load all File nodes
        file_records = s.run(
            "MATCH (r:Repo {url: $url})-[:HAS_FILE]->(f:File) RETURN f",
            url=repo_url,
        ).data()

        # Load all IMPORTS edges
        edge_records = s.run(
            """
            MATCH (a:File {repo_url: $url})-[:IMPORTS]->(b:File {repo_url: $url})
            RETURN a.id AS source, b.id AS target
            """,
            url=repo_url,
        ).data()

    nodes = []
    for r in file_records:
        f = r["f"]
        lc = None
        if f.get("last_commit_date"):
            lc = {
                "date":    f["last_commit_date"],
                "message": f["last_commit_msg"],
                "author":  f["last_commit_author"],
            }
        nodes.append({
            "id":          f["id"],
            "path":        f["path"],
            "type":        f["type"],
            "ext":         f["ext"],
            "loc":         f["loc"],
            "impact":      f["impact"],
            "in_degree":   f["in_degree"],
            "out_degree":  f["out_degree"],
            "summary":     f.get("summary", ""),
            "snippet":     f.get("snippet", ""),
            "functions":   json.loads(f.get("functions", "[]")),
            "last_commit": lc,
        })

    edges = [{"source": e["source"], "target": e["target"]} for e in edge_records]

    # Rebuild onboarding path
    entry_nodes  = [n for n in nodes if n["type"] == "entry"]
    high_impact  = sorted([n for n in nodes if n["type"] != "test"], key=lambda x: -x["impact"])
    seen, onboarding = set(), []
    for n in entry_nodes + high_impact:
        if n["id"] not in seen:
            onboarding.append(n["id"])
            seen.add(n["id"])
        if len(onboarding) >= 10:
            break

    langs = list({n["ext"] for n in nodes})

    return {
        "nodes": nodes,
        "edges": edges,
        "onboarding_path": onboarding,
        "stats": {
            "total_files":  len(nodes),
            "total_edges":  len(edges),
            "languages":    langs,
        },
    }


def update_summary(repo_url: str, file_id: str, summary: str):
    """Update the summary of a single file node."""
    with get_driver().session() as s:
        s.run(
            "MATCH (f:File {repo_url: $url, id: $id}) SET f.summary = $summary",
            url=repo_url, id=file_id, summary=summary,
        )
