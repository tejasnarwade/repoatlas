import { useState, useEffect } from 'react';
import { X, FileCode, Zap, ArrowUp, ArrowDown, Code2, Clock, ChevronRight, AlertTriangle, CheckCircle, XCircle, Lightbulb, TrendingUp } from 'lucide-react';
import { getTypeConfig, EXT_LANG } from '../constants';
import axios from 'axios';

const API = 'http://localhost:8000';

const HEAT_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981' };
const SEV_COLOR  = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#64748b' };

const TAB_STYLE = (active) => ({
  flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 600,
  background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
  color: active ? '#3b82f6' : '#475569', cursor: 'pointer', transition: 'all 0.15s',
});

export default function DetailPanel({ node, repoUrl, edges, allNodes, onClose, onNodeClick }) {
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(node.summary || '');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [review, setReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    setTab('summary');
    setSummary(node.summary || '');
    setReview(null);
    setReviewError('');
    if (!node.summary) fetchSummary();
  }, [node.id]);

  async function fetchSummary() {
    setLoadingSummary(true);
    try {
      const { data } = await axios.post(`${API}/api/summary`, { repo_url: repoUrl, file_id: node.id });
      setSummary(data.summary);
    } catch { }
    setLoadingSummary(false);
  }

  async function fetchReview() {
    if (review) return;
    setLoadingReview(true);
    setReviewError('');
    try {
      const { data } = await axios.post(`${API}/api/review`, { repo_url: repoUrl, file_id: node.id });
      setReview(data);
    } catch (err) {
      setReviewError(err.response?.data?.detail || err.message);
    }
    setLoadingReview(false);
  }

  const cfg = getTypeConfig(node.type);
  const deps = edges.filter(e => e.source === node.id).map(e => e.target);
  const dependents = edges.filter(e => e.target === node.id).map(e => e.source);
  const lc = node.last_commit;
  const callGraph = node.call_graph || [];
  const isOrphan = node.is_orphan;

  const tabs = [
    { key: 'summary',   label: '🤖 Summary' },
    { key: 'review',    label: '🔬 Review' },
    { key: 'deps',      label: `↔ Relations (${deps.length + dependents.length})` },
    { key: 'callgraph', label: `⚡ Calls (${callGraph.length})` },
    { key: 'code',      label: '</> Code' },
  ];

  return (
    <div className="fade-in" style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 370,
      background: '#0a0e1a', borderLeft: '1px solid #1e2d4a',
      display: 'flex', flexDirection: 'column', zIndex: 10, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: cfg.color }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 10, color: '#334155', background: '#151d35', border: '1px solid #1e2d4a', borderRadius: 4, padding: '1px 6px' }}>
                {EXT_LANG[node.ext] || node.ext}
              </span>
              {isOrphan && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  <AlertTriangle size={9} /> ORPHAN
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', wordBreak: 'break-all', lineHeight: 1.4 }}>
              {node.path.split('/').pop()}
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
              {node.path.split('/').slice(0, -1).join('/')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', padding: 4, marginLeft: 8, flexShrink: 0,
            borderRadius: 6, transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <X size={15} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { icon: <FileCode size={11} />, label: `${node.loc} lines` },
            { icon: <ArrowUp size={11} />, label: `${node.in_degree} used by` },
            { icon: <ArrowDown size={11} />, label: `${node.out_degree} imports` },
            { icon: <Zap size={11} />, label: `${node.impact.toFixed(3)} impact`, highlight: node.impact > 0.5 },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: s.highlight ? '#f59e0b' : '#475569',
              background: '#0f1629', border: '1px solid #1e2d4a',
              borderRadius: 6, padding: '3px 8px',
            }}>
              {s.icon} {s.label}
            </div>
          ))}
        </div>

        {/* Complexity meter */}
        {node.complexity && (
          <div style={{ marginTop: 10, background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Complexity</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: HEAT_COLOR[node.complexity.heat] || '#10b981' }}>
                {node.complexity.score}/100
              </span>
            </div>
            {/* Main bar */}
            <div style={{ height: 6, background: '#1e2d4a', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', width: `${node.complexity.score}%`,
                background: `linear-gradient(90deg, #10b981, ${HEAT_COLOR[node.complexity.heat] || '#10b981'})`,
                borderRadius: 3, transition: 'width 0.4s ease',
              }} />
            </div>
            {/* Breakdown */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(node.complexity.breakdown).map(([key, val]) => (
                <div key={key} style={{ flex: 1, minWidth: 40, textAlign: 'center' }}>
                  <div style={{ height: 3, background: '#1e2d4a', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: `${val}%`, background: '#3b82f6', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#334155', textTransform: 'capitalize' }}>{key}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orphan warning */}
        {isOrphan && (
          <div style={{
            marginTop: 10, background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 10px',
            fontSize: 11, color: '#f59e0b', lineHeight: 1.5,
          }}>
            <strong>⚠ Orphaned module</strong> — this file has no imports and nothing imports it.
            It adds cognitive load without contributing to the dependency graph. Consider removing or documenting it.
          </div>
        )}

        {/* Last commit */}
        {lc && (
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 7,
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 10px',
          }}>
            <Clock size={12} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{lc.date}</div>
              <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>{lc.message}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>by {lc.author}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2d4a', flexShrink: 0, padding: '0 12px' }}>
        {tabs.map(t => (
          <button key={t.key} style={TAB_STYLE(tab === t.key)} onClick={() => {
            setTab(t.key);
            if (t.key === 'review') fetchReview();
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* SUMMARY TAB */}
        {tab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loadingSummary ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#475569', fontSize: 13, padding: '20px 0' }}>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Analysing file with AI...
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {summary || 'No summary available.'}
              </div>
            )}
            {node.functions?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Code2 size={10} /> Symbols ({node.functions.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {node.functions.map(f => (
                    <span key={f} style={{
                      background: '#0f1629', border: '1px solid #1e2d4a',
                      borderRadius: 5, padding: '2px 8px', fontSize: 11,
                      color: '#64748b', fontFamily: 'monospace',
                    }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REVIEW TAB */}
        {tab === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loadingReview && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#475569', fontSize: 13, padding: '20px 0' }}>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                AI is reviewing the code...
              </div>
            )}
            {reviewError && (
              <div style={{ fontSize: 12, color: '#ef4444', padding: '10px 0' }}>{reviewError}</div>
            )}
            {!review && !loadingReview && !reviewError && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <button className="btn btn-primary" onClick={fetchReview} style={{ justifyContent: 'center' }}>
                  🔬 Run AI Code Review
                </button>
                <div style={{ fontSize: 11, color: '#334155', marginTop: 8 }}>Analyses code quality, improvements, and better approaches</div>
              </div>
            )}

            {review && (
              <>
                {/* Verdict + quality score */}
                <div style={{
                  background: review.verdict === 'optimized'
                    ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${review.verdict === 'optimized' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {review.verdict === 'optimized'
                      ? <CheckCircle size={16} color="#10b981" />
                      : <XCircle size={16} color="#ef4444" />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: review.verdict === 'optimized' ? '#10b981' : '#ef4444' }}>
                      {review.verdict === 'optimized' ? 'Already Optimized' : 'Needs Improvement'}
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 18, fontWeight: 800,
                      color: review.score >= 80 ? '#10b981' : review.score >= 50 ? '#f59e0b' : '#ef4444',
                    }}>
                      {review.score}/100
                    </span>
                  </div>
                  {/* Quality bar */}
                  <div style={{ height: 5, background: '#1e2d4a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${review.score}%`,
                      background: review.score >= 80 ? '#10b981' : review.score >= 50 ? '#f59e0b' : '#ef4444',
                      borderRadius: 3, transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

                {/* Strengths */}
                {review.strengths?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={10} /> What's good
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {review.strengths.map((s, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 7, lineHeight: 1.5 }}>
                          <span style={{ color: '#10b981', flexShrink: 0 }}>✓</span>{s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improvements */}
                {review.improvements?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={10} /> Improvements needed ({review.improvements.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {review.improvements.map((imp, i) => (
                        <div key={i} style={{
                          background: '#0f1629',
                          border: `1px solid ${SEV_COLOR[imp.severity] || '#1e2d4a'}33`,
                          borderLeft: `3px solid ${SEV_COLOR[imp.severity] || '#475569'}`,
                          borderRadius: '0 8px 8px 0', padding: '10px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                              color: SEV_COLOR[imp.severity] || '#475569',
                              background: `${SEV_COLOR[imp.severity] || '#475569'}15`,
                              border: `1px solid ${SEV_COLOR[imp.severity] || '#475569'}33`,
                              borderRadius: 3, padding: '1px 5px',
                            }}>{imp.severity}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{imp.title}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 6 }}>{imp.description}</div>
                          <div style={{ fontSize: 11, color: '#3b82f6', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 6, padding: '6px 8px', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 600 }}>Fix: </span>{imp.fix}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Better approach */}
                {review.better_approach && (
                  <div style={{
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Lightbulb size={10} /> Better Approach
                    </div>
                    <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>{review.better_approach}</div>
                  </div>
                )}

                {/* Re-run */}
                <button onClick={() => { setReview(null); fetchReview(); }} style={{
                  background: 'none', border: '1px solid #1e2d4a', borderRadius: 6,
                  color: '#475569', cursor: 'pointer', fontSize: 11, padding: '5px 10px',
                  transition: 'all 0.15s', alignSelf: 'flex-start',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#475569'; }}
                >
                  ↺ Re-run review
                </button>
              </>
            )}
          </div>
        )}

        {/* RELATIONS TAB */}
        {tab === 'deps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {deps.length === 0 && dependents.length === 0 && (
              <div style={{ fontSize: 13, color: '#475569', padding: '20px 0' }}>No dependencies found.</div>
            )}
            {dependents.length > 0 && (
              <NodeList title="Used by" items={dependents} allNodes={allNodes} onNodeClick={onNodeClick} color="#10b981" />
            )}
            {deps.length > 0 && (
              <NodeList title="Imports" items={deps} allNodes={allNodes} onNodeClick={onNodeClick} color="#3b82f6" />
            )}
          </div>
        )}

        {/* CALL GRAPH TAB */}
        {tab === 'callgraph' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {callGraph.length === 0 ? (
              <div style={{ fontSize: 13, color: '#475569', padding: '20px 0' }}>
                No function-level calls detected for this file.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>
                  Function calls detected in this file — showing which function calls which.
                </div>
                {callGraph.map((call, i) => (
                  <div key={i} style={{
                    background: '#0f1629', border: '1px solid #1e2d4a',
                    borderRadius: 8, padding: '8px 12px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <code style={{ fontSize: 11, color: '#6366f1', fontFamily: 'monospace', flexShrink: 0 }}>
                      {call.caller}
                    </code>
                    <span style={{ fontSize: 11, color: '#334155' }}>→</span>
                    <code style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace' }}>
                      {call.callee}
                    </code>
                    {call.callee_file !== node.id && (
                      <span style={{
                        fontSize: 10, color: '#475569', marginLeft: 'auto',
                        background: '#080d1a', border: '1px solid #1e2d4a',
                        borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 120,
                      }} title={call.callee_file}>
                        {call.callee_file.split('/').pop()}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* CODE TAB */}
        {tab === 'code' && (
          <div>
            {node.snippet ? (
              <pre style={{
                background: '#080d1a', border: '1px solid #1e2d4a', borderRadius: 8,
                padding: 12, fontSize: 11, color: '#64748b', overflow: 'auto',
                lineHeight: 1.6, fontFamily: 'monospace', margin: 0,
              }}>{node.snippet}</pre>
            ) : (
              <div style={{ fontSize: 13, color: '#475569', padding: '20px 0' }}>No preview available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NodeList({ title, items, allNodes, onNodeClick, color }) {
  const nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]));
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {title} ({items.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.slice(0, 12).map(id => {
          const n = nodeMap[id];
          const cfg = n ? getTypeConfig(n.type) : { color: '#64748b' };
          return (
            <button key={id} onClick={() => onNodeClick(id)} style={{
              background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 7,
              padding: '7px 10px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d4a'}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {id.split('/').pop()}
                </div>
                <div style={{ fontSize: 10, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {id.split('/').slice(0, -1).join('/')}
                </div>
              </div>
              <ChevronRight size={12} color="#334155" style={{ flexShrink: 0 }} />
            </button>
          );
        })}
        {items.length > 12 && (
          <span style={{ fontSize: 11, color: '#475569', paddingLeft: 4 }}>+{items.length - 12} more</span>
        )}
      </div>
    </div>
  );
}
