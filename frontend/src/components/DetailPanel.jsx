import { useState, useEffect } from 'react';
import { X, FileCode, Zap, ArrowUp, ArrowDown, Code2, Clock, GitCommit, ChevronRight } from 'lucide-react';
import { getTypeConfig, EXT_LANG } from '../constants';
import axios from 'axios';

const API = 'http://localhost:8000';

const TAB_STYLE = (active) => ({
  flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600,
  background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
  color: active ? '#3b82f6' : '#475569', cursor: 'pointer', transition: 'all 0.15s',
});

export default function DetailPanel({ node, repoUrl, edges, allNodes, onClose, onNodeClick }) {
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(node.summary || '');
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    setTab('summary');
    setSummary(node.summary || '');
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

  const cfg = getTypeConfig(node.type);
  const deps = edges.filter(e => e.source === node.id).map(e => e.target);
  const dependents = edges.filter(e => e.target === node.id).map(e => e.source);
  const lc = node.last_commit;

  return (
    <div className="fade-in" style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 360,
      background: '#0a0e1a', borderLeft: '1px solid #1e2d4a',
      display: 'flex', flexDirection: 'column', zIndex: 10, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: cfg.color }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 10, color: '#334155', background: '#151d35', border: '1px solid #1e2d4a', borderRadius: 4, padding: '1px 6px' }}>
                {EXT_LANG[node.ext] || node.ext}
              </span>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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

        {/* Last commit timestamp — always visible in header */}
        {lc && (
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 7,
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 10px',
          }}>
            <Clock size={12} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>
                {lc.date}
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {lc.message}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                by {lc.author}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2d4a', flexShrink: 0, padding: '0 16px' }}>
        {[
          { key: 'summary', label: '🤖 Summary' },
          { key: 'deps',    label: `↔ Relations (${deps.length + dependents.length})` },
          { key: 'code',    label: '</> Code' },
        ].map(t => (
          <button key={t.key} style={TAB_STYLE(tab === t.key)} onClick={() => setTab(t.key)}>
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
              <div style={{
                fontSize: 13, color: '#cbd5e1', lineHeight: 1.8,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {summary || 'No summary available.'}
              </div>
            )}

            {/* Symbols */}
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
