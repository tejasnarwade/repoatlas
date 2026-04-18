import { useState } from 'react';
import { GitBranch, Zap, Map, Search, ArrowRight, Loader2 } from 'lucide-react';

const EXAMPLES = [
  'https://github.com/tiangolo/fastapi',
  'https://github.com/pallets/flask',
  'https://github.com/expressjs/express',
];

export default function LandingPage({ onAnalyze, loading, user }) {
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (url.trim()) onAnalyze(url.trim());
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 40, gap: 48,
      background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)',
    }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99,102,241,0.4)',
          }}>
            <Map size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>
              Repo<span style={{ color: '#6366f1' }}>Atlas</span>
            </h1>
            <p style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Repository Architecture Navigator</p>
          </div>
        </div>

        <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, marginBottom: 8 }}>
          {user ? <>Welcome back, <span style={{ color: '#94a3b8' }}>{user.name.split(' ')[0]}</span>! Paste a GitHub URL to generate an </> : 'Instantly understand any codebase. Paste a GitHub URL to generate an '}
          <span style={{ color: '#94a3b8' }}>interactive architecture graph</span> with
          AI-powered explanations, dependency maps, and a guided onboarding path.
        </p>
      </div>

      {/* Input */}
      <div style={{ width: '100%', maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <GitBranch size={16} style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569',
            }} />
            <input
              className="input"
              style={{ paddingLeft: 42, fontSize: 14, height: 48 }}
              placeholder="https://github.com/owner/repository"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !url.trim()} style={{ height: 48, padding: '0 24px', fontSize: 14 }}>
            {loading
              ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Analyzing...</>
              : <><ArrowRight size={16} /> Analyze</>
            }
          </button>
        </form>

        {/* Examples */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Try:</span>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setUrl(ex)} style={{
              background: 'none', border: '1px solid #1e2d4a', borderRadius: 6,
              padding: '3px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#64748b'; }}
            >
              {ex.replace('https://github.com/', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700 }}>
        {[
          { icon: <Map size={18} color="#6366f1" />, title: 'Architecture Graph', desc: 'Interactive dependency visualization with clickable nodes' },
          { icon: <Zap size={18} color="#f59e0b" />, title: 'Impact Analysis', desc: 'Identify high-risk files that affect multiple services' },
          { icon: <Search size={18} color="#3b82f6" />, title: 'NL Queries', desc: 'Ask "where is auth handled?" and get highlighted subgraphs' },
          { icon: <GitBranch size={18} color="#10b981" />, title: 'Onboarding Path', desc: 'Ordered reading list to understand the codebase fast' },
        ].map(f => (
          <div key={f.title} className="card" style={{ width: 160, textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
