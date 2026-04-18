import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000';

export default function QueryBar({ repoUrl, onResults, onClear }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/query`, { repo_url: repoUrl, query });
      onResults(data.highlighted);
      setActive(true);
    } catch { }
    setLoading(false);
  }

  function handleClear() {
    setQuery('');
    setActive(false);
    onClear();
  }

  const suggestions = [
    'where is authentication handled?',
    'show the payment flow',
    'find database models',
    'show API routes',
  ];

  return (
    <div style={{ position: 'relative' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            className="input"
            style={{ paddingLeft: 32, paddingRight: active ? 32 : 14, fontSize: 13 }}
            placeholder="Ask: where is auth handled? show payment flow..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {active && (
            <button type="button" onClick={handleClear} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2,
            }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()} style={{ padding: '8px 14px' }}>
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Search size={14} />}
          Search
        </button>
      </form>

      {/* Suggestion chips */}
      {!active && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => setQuery(s)} style={{
              background: '#151d35', border: '1px solid #1e2d4a', borderRadius: 20,
              padding: '3px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#64748b'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
