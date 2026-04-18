import os
import re
from pathlib import Path

# Each pattern: (name, severity, regex)
# Regexes are anchored to actual secret formats — not generic "key=value"
SECRET_PATTERNS = [
    # AWS
    ("AWS Access Key ID",       "critical", re.compile(r'(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])')),
    ("AWS Secret Access Key",   "critical", re.compile(r'(?i)aws.{0,20}secret.{0,20}[=:"\s]+([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])')),
    # GitHub
    ("GitHub Personal Token",   "critical", re.compile(r'(ghp_[A-Za-z0-9]{36,})')),
    ("GitHub OAuth Token",      "critical", re.compile(r'(gho_[A-Za-z0-9]{36,})')),
    ("GitHub App Token",        "critical", re.compile(r'(ghs_[A-Za-z0-9]{36,})')),
    ("GitHub Refresh Token",    "high",     re.compile(r'(ghr_[A-Za-z0-9]{36,})')),
    # Google / Gemini
    ("Google API Key",          "critical", re.compile(r'(AIza[0-9A-Za-z\-_]{35})')),
    ("Google OAuth Client",     "high",     re.compile(r'([0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com)')),
    # Stripe
    ("Stripe Secret Key",       "critical", re.compile(r'(sk_live_[0-9A-Za-z]{24,})')),
    ("Stripe Restricted Key",   "high",     re.compile(r'(rk_live_[0-9A-Za-z]{24,})')),
    ("Stripe Publishable Key",  "medium",   re.compile(r'(pk_live_[0-9A-Za-z]{24,})')),
    ("Stripe Test Key",         "low",      re.compile(r'(sk_test_[0-9A-Za-z]{24,})')),
    # Slack
    ("Slack Bot Token",         "critical", re.compile(r'(xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,})')),
    ("Slack User Token",        "critical", re.compile(r'(xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{32,})')),
    ("Slack Webhook",           "high",     re.compile(r'(https://hooks\.slack\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+)')),
    # OpenAI
    ("OpenAI API Key",          "critical", re.compile(r'(sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20})')),
    ("OpenAI API Key (new)",    "critical", re.compile(r'(sk-proj-[A-Za-z0-9\-_]{50,})')),
    # Twilio
    ("Twilio Account SID",      "high",     re.compile(r'(AC[a-z0-9]{32})')),
    ("Twilio Auth Token",       "critical", re.compile(r'(?i)twilio.{0,20}auth.{0,20}[=:"\s]+([a-z0-9]{32})(?![a-z0-9])')),
    # SendGrid
    ("SendGrid API Key",        "critical", re.compile(r'(SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43})')),
    # Mailgun
    ("Mailgun API Key",         "critical", re.compile(r'(key-[0-9a-zA-Z]{32})')),
    # Heroku
    ("Heroku API Key",          "high",     re.compile(r'(?i)heroku.{0,20}[=:"\s]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')),
    # JWT
    ("JWT Token",               "medium",   re.compile(r'(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)')),
    # Private Keys
    ("RSA Private Key",         "critical", re.compile(r'-----BEGIN RSA PRIVATE KEY-----')),
    ("Private Key (generic)",   "critical", re.compile(r'-----BEGIN (?:EC |DSA |OPENSSH )?PRIVATE KEY-----')),
    # Database URLs with credentials
    ("Database URL w/ creds",   "critical", re.compile(r'(?i)((?:postgres|mysql|mongodb|redis)://[^:]+:[^@\s]+@[^\s"\']+)')),
    # Generic high-entropy assignments (last resort, only for clearly named vars)
    ("Generic Secret Var",      "medium",   re.compile(r'(?i)(?:secret_key|api_secret|app_secret|auth_secret)\s*[=:]\s*["\']([A-Za-z0-9\-_/+=]{20,})["\']')),
    ("Generic Password Var",    "medium",   re.compile(r'(?i)(?:password|passwd|db_pass|db_password)\s*[=:]\s*["\']([A-Za-z0-9\-_@#$%^&*!]{8,})["\']')),
]

# Files to scan — broader than just code
SCAN_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".env", ".env.local", ".env.production", ".env.development",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".sh", ".bash", ".zsh", ".rb", ".go", ".java", ".php",
    ".xml", ".properties", ".tf", ".tfvars",
}

SKIP_DIRS = {"node_modules", ".git", "__pycache__", "venv", ".venv", "dist", "build", ".next"}

# Values that are clearly placeholders — skip them
PLACEHOLDER_PATTERNS = re.compile(
    r'^(your[-_]|<|{|example|placeholder|xxx|test|dummy|fake|sample|changeme|todo|replace|insert|add[-_]your|my[-_]|enter[-_])',
    re.IGNORECASE
)

def redact(value: str) -> str:
    if len(value) <= 8:
        return "***"
    return value[:4] + "*" * (len(value) - 8) + value[-4:]

def is_placeholder(value: str) -> bool:
    return bool(PLACEHOLDER_PATTERNS.match(value.strip()))

def scan_file(filepath: str, repo_path: str) -> list[dict]:
    findings = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception:
        return []

    rel_path = os.path.relpath(filepath, repo_path)

    for lineno, line in enumerate(lines, start=1):
        # Skip comment-only lines that are clearly documentation
        stripped = line.strip()
        if stripped.startswith("#") and any(w in stripped.lower() for w in ["example", "your", "replace", "todo"]):
            continue

        for name, severity, pattern in SECRET_PATTERNS:
            for match in pattern.finditer(line):
                value = match.group(1) if match.lastindex else match.group(0)
                if is_placeholder(value):
                    continue
                # For private key headers, value is the header itself
                if "PRIVATE KEY" in name:
                    value = "-----BEGIN ... PRIVATE KEY-----"
                findings.append({
                    "file": rel_path,
                    "line": lineno,
                    "type": name,
                    "severity": severity,
                    "value": redact(value),
                    "raw_value": value,  # kept server-side only, not sent to frontend
                    "line_content": line.rstrip(),
                })

    return findings

def scan_repo_for_secrets(repo_path: str) -> list[dict]:
    all_findings = []
    seen = set()  # deduplicate exact same secret value across files

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            fpath = os.path.join(root, fname)
            ext = Path(fname).suffix.lower()
            # Also scan extensionless files like .env, Dockerfile, etc.
            basename = fname.lower()
            if ext not in SCAN_EXTS and not any(basename.startswith(x) for x in [".env", "dockerfile", "makefile"]):
                continue
            for finding in scan_file(fpath, repo_path):
                key = (finding["type"], finding["raw_value"])
                is_dupe = key in seen
                seen.add(key)
                # Remove raw_value before returning
                safe = {k: v for k, v in finding.items() if k != "raw_value"}
                safe["duplicate"] = is_dupe
                all_findings.append(safe)

    # Sort: critical first, then by file
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_findings.sort(key=lambda x: (sev_order.get(x["severity"], 9), x["file"]))
    return all_findings
