import { useState } from 'react';
import { GitBranch, Map, ArrowRight, Lock, LogOut, Zap, Search, Shield, Compass, Brain, GitCommit } from 'lucide-react';
import RepoPickerModal from './RepoPickerModal';

const EXAMPLES = [
  { label: 'tiangolo/fastapi', url: 'https://github.com/tiangolo/fastapi' },
  { label: 'pallets/flask',    url: 'https://github.com/pallets/flask' },
  { label: 'expressjs/express',url: 'https://github.com/expressjs/express' },
];

const FEATURES = [
  { icon: <Map size={14} />,       color: '#6366f1', title: 'Architecture Graph' },
  { icon: <Brain size={14} />,     color: '#3b82f6', title: 'AI Explanations' },
  { icon: <Zap size={14} />,       color: '#f59e0b', title: 'Impact Analysis' },
  { icon: <Search size={14} />,    color: '#10b981', title: 'NL Chat' },
  { icon: <Compass size={14} />,   color: '#8b5cf6', title: 'Guided Tour' },
  { icon: <Shield size={14} />,    color: '#ef4444', title: 'Secret Scanner' },
  { icon: <GitCommit size={14} />, color: '#ec4899', title: 'Evolution' },
  { icon: <Lock size={14} />,      color: '#06b6d4', title: 'Private Repos' },
];

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

export default function LandingPage({ onAnalyze, loading, githubUser, githubToken, onGithubLogout }) {
  const [url, setUrl] = useState('');
  const [showRepoPicker, setShowRepoPicker] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (url.trim()) onAnalyze(url.trim(), githubToken || '');
  }

  function handleGithubLogin() {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: 'repo read:user',
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  }

  function handleRepoSelect(repo) {
    setShowRepoPicker(false);
    onAnalyze(repo.url, githubToken);
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 24px',
      position: 'relative',
      overflow: 'hidden',
      background: '#060a14',
    }}>

      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
        <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 65%)', animation: 'glow 6s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '-5%', width: 350, height: 350, background: 'radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 65%)' }} />
      </div>

      {/* Content */}
      <div className="fade-in" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 0 40px rgba(99,102,241,0.35)',
            animation: 'float 4s ease-in-out infinite',
          }}>
            <Map size={26} color="white" />
          </div>

          <h1 style={{
            fontSize: 42, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1,
            marginBottom: 8,
            background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 50%, #6366f1 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Repo<span style={{
              background: 'linear-gradient(135deg, #818cf8, #3b82f6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Atlas</span>
          </h1>

          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
            Understand any codebase instantly — AI-powered graphs, dependency maps,
            guided tours & natural language queries.{' '}
            <span style={{ color: '#6366f1', fontWeight: 600 }}>100% local AI.</span>
          </p>
        </div>

        {/* Action card */}
        <div style={{
          background: 'rgba(12,18,32,0.9)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 18,
          padding: '20px 22px',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.04), 0 24px 60px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
        }}>

          {/* GitHub */}
          {githubUser ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <img src={githubUser.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.35)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{githubUser.name}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>@{githubUser.login}</div>
                </div>
                <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>✓ Connected</span>
                <button onClick={onGithubLogout} style={{ background: 'none', border: '1px solid #1e2d4a', borderRadius: 5, color: '#475569', cursor: 'pointer', padding: '3px 7px', fontSize: 10, transition: 'all 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#475569'; }}
                >Sign out</button>
              </div>
              <button onClick={() => setShowRepoPicker(true)} style={{
                width: '100%', height: 42,
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 13, fontWeight: 700, color: 'white',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                transition: 'all 0.18s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)'; }}
              >
                <GitBranch size={14} /> Browse my repositories
                <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.18)', borderRadius: 5, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Lock size={8} /> private
                </span>
              </button>
            </div>
          ) : GITHUB_CLIENT_ID ? (
            <div style={{ marginBottom: 16 }}>
              <button onClick={handleGithubLogin} style={{
                width: '100%', height: 42,
                background: 'linear-gradient(135deg, #21262d, #2d333b)',
                border: '1px solid #444c56', borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                fontSize: 13, fontWeight: 600, color: '#e2e8f0',
                transition: 'all 0.18s', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6e7681'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#444c56'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#e2e8f0">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Continue with GitHub
                <span style={{ fontSize: 10, color: '#64748b' }}>— access private repos</span>
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 16, fontSize: 11, color: '#475569', background: 'rgba(8,13,26,0.6)', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px' }}>
              ⚠️ Set <code style={{ color: '#94a3b8', fontFamily: 'monospace' }}>VITE_GITHUB_CLIENT_ID</code> in <code style={{ color: '#94a3b8', fontFamily: 'monospace' }}>frontend/.env</code>
            </div>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #1e2d4a)' }} />
            <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '1.5px' }}>OR PASTE A PUBLIC URL</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #1e2d4a, transparent)' }} />
          </div>

          {/* URL input */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <GitBranch size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#334155', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 34, fontSize: 12, height: 40, borderRadius: 9 }}
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || !url.trim()} style={{ height: 40, padding: '0 18px', fontSize: 12, borderRadius: 9 }}>
              {loading ? <><div className="spinner" style={{ width: 13, height: 13 }} /> Analyzing...</> : <><ArrowRight size={13} /> Analyze</>}
            </button>
          </form>

          {/* Examples */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>Try:</span>
            {EXAMPLES.map(ex => (
              <button key={ex.url} onClick={() => setUrl(ex.url)} style={{
                background: 'rgba(30,45,74,0.35)', border: '1px solid #1e2d4a',
                borderRadius: 20, padding: '2px 10px', fontSize: 10,
                color: '#475569', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'monospace',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'rgba(30,45,74,0.35)'; }}
              >{ex.label}</button>
            ))}
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(12,18,32,0.7)', border: '1px solid #1e2d4a',
              borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#475569',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '55'; e.currentTarget.style.color = f.color; e.currentTarget.style.background = f.color + '10'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'rgba(12,18,32,0.7)'; }}
            >
              <span style={{ color: f.color }}>{f.icon}</span>
              {f.title}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 10, color: '#1e2d4a', fontWeight: 600, letterSpacing: '0.3px' }}>
          🔒 AI runs 100% locally via Ollama — no code ever leaves your machine
        </p>
      </div>

      {showRepoPicker && (
        <RepoPickerModal
          user={githubUser}
          token={githubToken}
          onSelect={handleRepoSelect}
          onClose={() => setShowRepoPicker(false)}
        />
      )}
    </div>
  );
}
