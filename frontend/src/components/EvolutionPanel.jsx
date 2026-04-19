import { useState } from 'react';
import { GitCommit, X, Clock, User, ChevronDown, ChevronUp, Loader2, GitBranch } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000';

export default function EvolutionPanel({ repoUrl, token, onClose, onFocusNode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('timeline'); // timeline | files
  const [expandedFile, setExpandedFile] = useState(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await axios.post(`${API}/api/evolution`, { repo_url: repoUrl, token: token || '' });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoading(false);
  }

  const timeline = data?.repo_timeline || [];
  const fileHistory = data?.file_history || {};

  const filteredFiles = Object.entries(fileHistory).filter(([path]) =>
    path.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b[1].length - a[1].length); // most commits first

  return (
    <div className="fade-in" style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 400,
      background: '#0a0e1a', borderLeft: '1px solid #1e2d4a',
      display: 'flex', flexDirection: 'column', zIndex: 20, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={15} color="#6366f1" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Architecture Evolution</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <X size={15} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Full commit history showing how the codebase evolved over time
        </p>
      </div>

      {/* Load button */}
      {!data && !loading && (
        <div style={{ padding: 16 }}>
          <button className="btn btn-primary" onClick={load} style={{ width: '100%', justifyContent: 'center' }}>
            <GitCommit size={14} /> Load Commit History
          </button>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 8, textAlign: 'center' }}>
            This does a full clone to fetch complete history — may take 30–60s
          </div>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#475569' }}>
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <div style={{ fontSize: 13 }}>Fetching full commit history...</div>
          <div style={{ fontSize: 11, color: '#334155' }}>Cloning without depth limit</div>
        </div>
      )}

      {error && (
        <div style={{ margin: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Stats + view toggle */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#94a3b8', flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 16 }}>{timeline.length}</div>
                <div>commits</div>
              </div>
              <div style={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#94a3b8', flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 16 }}>{Object.keys(fileHistory).length}</div>
                <div>files tracked</div>
              </div>
              <div style={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#94a3b8', flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 16 }}>
                  {new Set(timeline.map(c => c.author)).size}
                </div>
                <div>authors</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'timeline', label: '📅 Timeline' },
                { key: 'files',    label: '📁 Per File' },
              ].map(v => (
                <button key={v.key} onClick={() => setView(v.key)} style={{
                  flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600,
                  background: view === v.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: `1px solid ${view === v.key ? '#6366f1' : '#1e2d4a'}`,
                  borderRadius: 6, color: view === v.key ? '#6366f1' : '#475569',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* TIMELINE VIEW */}
            {view === 'timeline' && (
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.length === 0 && (
                  <div style={{ fontSize: 13, color: '#475569', padding: '20px 0' }}>No commits found.</div>
                )}
                {timeline.map((commit, i) => (
                  <div key={commit.hash} style={{ display: 'flex', gap: 12, paddingBottom: 12 }}>
                    {/* Timeline line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', marginTop: 3,
                        background: commit.files_changed.length > 0 ? '#6366f1' : '#1e2d4a',
                        border: `2px solid ${commit.files_changed.length > 0 ? '#6366f1' : '#1e2d4a'}`,
                        boxShadow: commit.files_changed.length > 0 ? '0 0 6px #6366f166' : 'none',
                        flexShrink: 0,
                      }} />
                      {i < timeline.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: '#1e2d4a', minHeight: 16 }} />
                      )}
                    </div>
                    {/* Commit info */}
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <code style={{ fontSize: 10, color: '#6366f1', fontFamily: 'monospace', background: 'rgba(99,102,241,0.1)', borderRadius: 3, padding: '1px 5px' }}>
                          {commit.hash}
                        </code>
                        <span style={{ fontSize: 10, color: '#334155' }}>{commit.date}</span>
                        <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>{commit.author}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 4 }}>
                        {commit.message}
                      </div>
                      {commit.files_changed.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {commit.files_changed.slice(0, 4).map(f => (
                            <button key={f} onClick={() => onFocusNode(f)} style={{
                              fontSize: 10, color: '#3b82f6', background: 'rgba(59,130,246,0.08)',
                              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4,
                              padding: '1px 6px', cursor: 'pointer', fontFamily: 'monospace',
                              transition: 'all 0.15s',
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                            >
                              {f.split('/').pop()}
                            </button>
                          ))}
                          {commit.files_changed.length > 4 && (
                            <span style={{ fontSize: 10, color: '#334155', padding: '1px 4px' }}>
                              +{commit.files_changed.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PER FILE VIEW */}
            {view === 'files' && (
              <div>
                <div style={{ padding: '8px 16px 4px' }}>
                  <input
                    className="input"
                    style={{ fontSize: 12, height: 32 }}
                    placeholder="Search files..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {filteredFiles.map(([path, commits]) => {
                  const isExpanded = expandedFile === path;
                  return (
                    <div key={path} style={{ borderBottom: '1px solid #1e2d4a' }}>
                      <button onClick={() => setExpandedFile(isExpanded ? null : path)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 16px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0f1629'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#e2e8f0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {path.split('/').pop()}
                          </div>
                          <div style={{ fontSize: 10, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {path}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#6366f1',
                          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                          borderRadius: 10, padding: '1px 7px', flexShrink: 0,
                        }}>
                          {commits.length} commit{commits.length > 1 ? 's' : ''}
                        </span>
                        {isExpanded ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />}
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {commits.map((c, i) => (
                            <div key={i} style={{
                              background: '#0f1629', border: '1px solid #1e2d4a',
                              borderRadius: 7, padding: '8px 10px',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <code style={{ fontSize: 10, color: '#6366f1', fontFamily: 'monospace', background: 'rgba(99,102,241,0.1)', borderRadius: 3, padding: '1px 5px' }}>
                                  {c.hash}
                                </code>
                                <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>{c.date}</span>
                              </div>
                              <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 3 }}>{c.message}</div>
                              <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <User size={9} /> {c.author}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
