import { useState, useEffect } from 'react';
import { X, FileCode, Zap, ArrowUp, ArrowDown, Code2, Loader2 } from 'lucide-react';
import { getTypeConfig, EXT_LANG } from '../constants';
import axios from 'axios';

const API = 'http://localhost:8000';

export default function DetailPanel({ node, repoUrl, edges, allNodes, onClose, onNodeClick }) {
  const [summary, setSummary] = useState(node.summary || '');
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
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

  return (
    <div className="fade-in" style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 340,
      background: '#0f1629', borderLeft: '1px solid #1e2d4a',
      display: 'flex', flexDirection: 'column', zIndex: 10, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.5px', color: cfg.color,
              }}>{cfg.label}</span>
              <span style={{ fontSize: 11, color: '#475569' }}>{EXT_LANG[node.ext] || node.ext}</span>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#e2e8f0',
              wordBreak: 'break-all', lineHeight: 1.4,
            }}>{node.path}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', padding: 4, marginLeft: 8, flexShrink: 0,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          {[
            { icon: <FileCode size={12} />, label: `${node.loc} lines` },
            { icon: <ArrowUp size={12} />, label: `${node.in_degree} dependents` },
            { icon: <ArrowDown size={12} />, label: `${node.out_degree} deps` },
            { icon: <Zap size={12} />, label: `Impact ${node.impact.toFixed(3)}`, highlight: node.impact > 0.5 },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: s.highlight ? '#f59e0b' : '#64748b',
            }}>
              {s.icon} {s.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* AI Summary */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            AI Summary
          </div>
          {loadingSummary ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
              <div className="spinner" style={{ width: 14, height: 14 }} /> Generating...
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              {summary || 'No summary available.'}
            </p>
          )}
        </div>

        {/* Functions */}
        {node.functions?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              <Code2 size={11} style={{ display: 'inline', marginRight: 4 }} />Symbols
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {node.functions.map(f => (
                <span key={f} style={{
                  background: '#151d35', border: '1px solid #1e2d4a',
                  borderRadius: 6, padding: '2px 8px', fontSize: 11,
                  color: '#94a3b8', fontFamily: 'monospace',
                }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {deps.length > 0 && (
          <NodeList title="Imports" items={deps} allNodes={allNodes} onNodeClick={onNodeClick} color="#3b82f6" />
        )}

        {/* Dependents */}
        {dependents.length > 0 && (
          <NodeList title="Used by" items={dependents} allNodes={allNodes} onNodeClick={onNodeClick} color="#10b981" />
        )}

        {/* Code snippet */}
        {node.snippet && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Preview
            </div>
            <pre style={{
              background: '#080d1a', border: '1px solid #1e2d4a', borderRadius: 8,
              padding: 12, fontSize: 11, color: '#64748b', overflow: 'auto',
              maxHeight: 200, lineHeight: 1.5, fontFamily: 'monospace',
            }}>{node.snippet}</pre>
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
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {title} ({items.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.slice(0, 10).map(id => {
          const n = nodeMap[id];
          const cfg = n ? getTypeConfig(n.type) : { color: '#64748b' };
          return (
            <button key={id} onClick={() => onNodeClick(id)} style={{
              background: '#080d1a', border: '1px solid #1e2d4a', borderRadius: 6,
              padding: '6px 10px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d4a'}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {id.split('/').pop()}
              </span>
              <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto', flexShrink: 0 }}>
                {id.split('/').slice(0, -1).join('/').slice(-20)}
              </span>
            </button>
          );
        })}
        {items.length > 10 && (
          <span style={{ fontSize: 11, color: '#475569', paddingLeft: 4 }}>+{items.length - 10} more</span>
        )}
      </div>
    </div>
  );
}
