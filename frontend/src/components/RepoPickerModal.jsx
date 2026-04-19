import { useState, useEffect, useRef } from 'react';
import { Search, Lock, Globe, Star, GitBranch, X, Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000';

export default function RepoPickerModal({ user, token, onSelect, onClose }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | private | public
  const searchRef = useRef(null);

  useEffect(() => {
    fetchRepos();
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  async function fetchRepos() {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/api/auth/repos`, { token });
      setRepos(data.repos);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoading(false);
  }

  const filtered = repos.filter(r => {
    const matchSearch = r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'private' ? r.private : !r.private);
    return matchSearch && matchFilter;
  });

  const privateCount = repos.filter(r => r.private).length;
  const publicCount = repos.filter(r => !r.private).length;

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(8,13,26,0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0a0e1a', border: '1px solid #1e2d4a',
        borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e2d4a', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <img src={user.avatar_url} alt={user.login} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #1e2d4a' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>@{user.login}</div>
            </div>
            <button onClick={onClose} style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: '#475569', cursor: 'pointer', padding: 4, borderRadius: 6,
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.color = '#475569'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              className="input"
              style={{ paddingLeft: 32, fontSize: 13, height: 36 }}
              placeholder="Search repositories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: `All (${repos.length})` },
              { key: 'private', label: `Private (${privateCount})`, icon: <Lock size={10} /> },
              { key: 'public', label: `Public (${publicCount})`, icon: <Globe size={10} /> },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: `1px solid ${filter === f.key ? '#3b82f6' : '#1e2d4a'}`,
                background: filter === f.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: filter === f.key ? '#3b82f6' : '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {f.icon}{f.label}
              </button>
            ))}
            <button onClick={fetchRepos} style={{
              marginLeft: 'auto', background: 'none', border: '1px solid #1e2d4a',
              borderRadius: 6, color: '#475569', cursor: 'pointer', padding: '4px 8px',
              display: 'flex', alignItems: 'center', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#475569'; }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Repo list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: '#475569', fontSize: 13 }}>
              <div className="spinner" style={{ width: 18, height: 18 }} /> Fetching your repositories...
            </div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</div>
              <button className="btn btn-ghost" onClick={fetchRepos} style={{ fontSize: 12 }}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#475569' }}>
              No repositories found{search ? ` for "${search}"` : ''}.
            </div>
          ) : (
            filtered.map(repo => (
              <button key={repo.full_name} onClick={() => onSelect(repo)} style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '11px 12px', borderRadius: 9, border: '1px solid transparent',
                background: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', marginBottom: 2,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0f1629'; e.currentTarget.style.borderColor = '#1e2d4a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                {/* Private/public icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0, marginTop: 1,
                  background: repo.private ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${repo.private ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {repo.private
                    ? <Lock size={12} color="#ef4444" />
                    : <Globe size={12} color="#10b981" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {repo.full_name}
                    </span>
                    {repo.private && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3, padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Private
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {repo.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {repo.language && (
                      <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Star size={9} /> {repo.stargazers_count}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#334155' }}>
                      Updated {timeAgo(repo.updated_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #1e2d4a', fontSize: 11, color: '#334155', flexShrink: 0 }}>
            {filtered.length} of {repos.length} repositories · includes private repos you own or collaborate on
          </div>
        )}
      </div>
    </div>
  );
}
