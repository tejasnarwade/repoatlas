import { useState } from 'react';
import { ShieldAlert, ShieldCheck, X, FileCode, AlertTriangle, Info, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000';

const SEV_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  icon: <ShieldAlert size={12} />, label: 'Critical' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', icon: <AlertTriangle size={12} />, label: 'High' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', icon: <AlertTriangle size={12} />, label: 'Medium' },
  low:      { color: '#64748b', bg: 'rgba(100,116,139,0.1)',border: 'rgba(100,116,139,0.3)',icon: <Info size={12} />, label: 'Low' },
};

export default function SecretsPanel({ repoUrl, onClose, onHighlightFiles }) {
  const [findings, setFindings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [copied, setCopied] = useState(null);

  async function runScan() {
    setLoading(true);
    setError('');
    setFindings(null);
    try {
      const { data } = await axios.post(`${API}/api/secrets`, { repo_url: repoUrl });
      setFindings(data.findings);
      // Highlight affected files on graph
      const affectedFiles = [...new Set(data.findings.map(f => f.file))];
      if (affectedFiles.length > 0) onHighlightFiles(affectedFiles);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoading(false);
  }

  function copyRedactCommand(finding) {
    const cmd = `# Redact in ${finding.file} line ${finding.line}\n# Replace the exposed value with an environment variable\nsed -i '${finding.line}s/${finding.value}/\$\{YOUR_SECRET_ENV_VAR\}/' ${finding.file}`;
    navigator.clipboard.writeText(cmd);
    setCopied(finding.file + finding.line);
    setTimeout(() => setCopied(null), 2000);
  }

  const filtered = findings
    ? (filter === 'all' ? findings : findings.filter(f => f.severity === filter))
    : [];

  const counts = findings ? {
    critical: findings.filter(f => f.severity === 'critical').length,
    high:     findings.filter(f => f.severity === 'high').length,
    medium:   findings.filter(f => f.severity === 'medium').length,
    low:      findings.filter(f => f.severity === 'low').length,
  } : {};

  const uniqueFiles = findings ? new Set(findings.map(f => f.file)).size : 0;

  return (
    <div className="fade-in" style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 400,
      background: '#0f1629', borderLeft: '1px solid #1e2d4a',
      display: 'flex', flexDirection: 'column', zIndex: 20,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={16} color="#ef4444" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Secret Scanner</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Scans all files for exposed API keys, tokens, and credentials
        </p>
      </div>

      {/* Scan button / results summary */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
        {!findings && !loading && (
          <button className="btn btn-primary" onClick={runScan} style={{ width: '100%', justifyContent: 'center' }}>
            <ShieldAlert size={14} /> Run Secret Scan
          </button>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '8px 0' }}>
            <div className="spinner" />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Scanning repository...</span>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {findings && (
          <>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {findings.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 13 }}>
                  <ShieldCheck size={16} /> No secrets found — repository looks clean
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>{findings.length}</span> finding{findings.length !== 1 ? 's' : ''} in{' '}
                    <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{uniqueFiles}</span> file{uniqueFiles !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(counts).filter(([, c]) => c > 0).map(([sev, count]) => {
                      const cfg = SEV_CONFIG[sev];
                      return (
                        <span key={sev} style={{
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          borderRadius: 20, padding: '2px 8px', fontSize: 11,
                          color: cfg.color, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {cfg.icon} {count} {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Severity filter */}
            {findings.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'critical', 'high', 'medium', 'low'].map(s => {
                  const cfg = s === 'all' ? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' } : SEV_CONFIG[s];
                  const isActive = filter === s;
                  const cnt = s === 'all' ? findings.length : counts[s];
                  if (s !== 'all' && !cnt) return null;
                  return (
                    <button key={s} onClick={() => setFilter(s)} style={{
                      background: isActive ? cfg.bg : 'transparent',
                      border: `1px solid ${isActive ? cfg.border : '#1e2d4a'}`,
                      borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                      fontSize: 11, color: isActive ? cfg.color : '#64748b',
                      fontWeight: isActive ? 700 : 400, transition: 'all 0.15s',
                    }}>
                      {s === 'all' ? 'All' : SEV_CONFIG[s].label} {cnt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Rescan */}
            <button onClick={runScan} style={{
              background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
              fontSize: 11, marginTop: 8, padding: 0, textDecoration: 'underline',
            }}>
              Re-scan
            </button>
          </>
        )}
      </div>

      {/* Findings list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered.map((f, i) => {
          const cfg = SEV_CONFIG[f.severity] || SEV_CONFIG.low;
          const isExpanded = expandedIdx === i;
          const isCopied = copied === f.file + f.line;

          return (
            <div key={i} style={{
              margin: '4px 12px',
              background: '#080d1a',
              border: `1px solid ${isExpanded ? cfg.border : '#1e2d4a'}`,
              borderRadius: 10, overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}>
              {/* Finding header */}
              <button onClick={() => setExpandedIdx(isExpanded ? null : i)} style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                textAlign: 'left',
              }}>
                {/* Severity dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: cfg.color, flexShrink: 0,
                  boxShadow: `0 0 6px ${cfg.color}`,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
                      {f.type}
                    </span>
                    {f.duplicate && (
                      <span style={{ fontSize: 10, color: '#475569', background: '#151d35', border: '1px solid #1e2d4a', borderRadius: 4, padding: '1px 5px' }}>
                        duplicate
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileCode size={10} color="#475569" />
                    <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.file}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>:{f.line}</span>
                  </div>
                </div>

                <div style={{ flexShrink: 0, color: '#475569' }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${cfg.border}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Redacted value */}
                  <div>
                    <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                      Exposed Value (redacted)
                    </div>
                    <code style={{
                      display: 'block', background: '#0a0e1a', border: `1px solid ${cfg.border}`,
                      borderRadius: 6, padding: '6px 10px', fontSize: 12,
                      color: cfg.color, fontFamily: 'monospace', wordBreak: 'break-all',
                    }}>
                      {f.value}
                    </code>
                  </div>

                  {/* Line content */}
                  <div>
                    <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                      Line {f.line} in {f.file.split('/').pop()}
                    </div>
                    <pre style={{
                      background: '#0a0e1a', border: '1px solid #1e2d4a', borderRadius: 6,
                      padding: '6px 10px', fontSize: 11, color: '#64748b',
                      fontFamily: 'monospace', overflow: 'auto', margin: 0,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      {f.line_content}
                    </pre>
                  </div>

                  {/* How to fix */}
                  <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>
                      ⚠ How to fix
                    </div>
                    <ol style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>
                      <li>Remove this value from the file and commit history</li>
                      <li>Move it to an environment variable (e.g. <code style={{ color: '#f59e0b', fontFamily: 'monospace' }}>.env</code>)</li>
                      <li>Rotate/revoke the exposed key immediately</li>
                      <li>Add <code style={{ color: '#f59e0b', fontFamily: 'monospace' }}>.env</code> to <code style={{ color: '#f59e0b', fontFamily: 'monospace' }}>.gitignore</code></li>
                    </ol>
                  </div>

                  {/* Copy fix command */}
                  <button onClick={() => copyRedactCommand(f)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                    background: isCopied ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                    border: `1px solid ${isCopied ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                    fontSize: 12, color: isCopied ? '#10b981' : '#3b82f6',
                    fontWeight: 600, transition: 'all 0.2s',
                  }}>
                    {isCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy remediation command</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && findings && findings.length > 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>
            No {filter} severity findings
          </div>
        )}
      </div>
    </div>
  );
}
