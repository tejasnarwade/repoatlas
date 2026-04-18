import { useState, useEffect } from 'react';
import axios from 'axios';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import GraphView from './components/GraphView';
import { onAuthChange, firebaseLogout } from './firebase';

const API = 'http://localhost:8000';

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); // wait for Firebase to resolve
  const [state, setState] = useState('home');
  const [data, setData] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  // Listen to Firebase auth state — persists across page refreshes
  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  function handleLogin(u) { setUser(u); setState('home'); }

  async function handleLogout() {
    await firebaseLogout();
    setUser(null);
    setState('home');
    setData(null);
    setRepoUrl('');
  }

  async function handleAnalyze(url) {
    setState('loading');
    setRepoUrl(url);
    setError('');

    const steps = [
      'Cloning repository...',
      'Scanning files...',
      'Building dependency graph...',
      'Generating AI summaries...',
    ];
    let i = 0;
    setProgress(steps[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setProgress(steps[i]);
    }, 4000);

    try {
      const { data: result } = await axios.post(`${API}/api/analyze`, { repo_url: url }, { timeout: 180000 });
      clearInterval(interval);
      setData(result);
      setState('graph');
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
      setState('error');
    }
  }

  // Show nothing while Firebase resolves auth state (avoids flash of login screen)
  if (!authReady) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  // Not logged in → auth page
  if (!user) return <AuthPage onLogin={handleLogin} />;

  // Graph view
  if (state === 'graph' && data) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <GraphView
          data={data}
          repoUrl={repoUrl}
          user={user}
          onLogout={handleLogout}
          onReset={() => setState('home')}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 20px', borderBottom: '1px solid #1e2d4a', background: '#0a0e1a', flexShrink: 0,
      }}>
        <UserMenu user={user} onLogout={handleLogout} />
      </div>

      {state === 'loading' ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 24,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99,102,241,0.4)',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Analyzing Repository</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{repoUrl.replace('https://github.com/', '')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <div className="spinner" />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{progress}</span>
            </div>
          </div>
          <div style={{
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 10,
            padding: '12px 20px', fontSize: 12, color: '#475569', maxWidth: 360, textAlign: 'center',
          }}>
            This may take 30–120 seconds depending on repository size.
          </div>
        </div>
      ) : state === 'error' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>Analysis Failed</div>
          <div style={{
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 10,
            padding: 16, fontSize: 13, color: '#94a3b8', maxWidth: 480, textAlign: 'center',
          }}>{error}</div>
          <button className="btn btn-primary" onClick={() => setState('home')}>Try Again</button>
        </div>
      ) : (
        <LandingPage onAnalyze={handleAnalyze} loading={false} user={user} />
      )}
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const initials = user.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#151d35', border: '1px solid #1e2d4a', borderRadius: 20,
        padding: '4px 12px 4px 4px', cursor: 'pointer', transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#2a3f6a'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d4a'}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'white',
        }}>{initials}</div>
        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{user.name?.split(' ')[0]}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 6,
          background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 10,
          minWidth: 180, zIndex: 100, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e2d4a' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{user.email}</div>
          </div>
          <button onClick={() => { setOpen(false); onLogout(); }} style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 14px', textAlign: 'left', fontSize: 13, color: '#ef4444',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
