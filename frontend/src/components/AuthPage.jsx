import { useState } from 'react';
import { Map, Eye, EyeOff, User, Lock, Mail, ArrowRight, GitBranch, Zap, Search } from 'lucide-react';

const DEMO_USER = { email: 'demo@repoatlas.dev', password: 'demo1234' };

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | signup
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (mode === 'signup') {
        if (!form.name.trim()) { setError('Name is required.'); setLoading(false); return; }
        if (!form.email.includes('@')) { setError('Enter a valid email.'); setLoading(false); return; }
        if (form.password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return; }
        const user = { name: form.name.trim(), email: form.email.trim() };
        localStorage.setItem('repoatlas_user', JSON.stringify(user));
        onLogin(user);
      } else {
        // Check saved user or demo credentials
        const saved = JSON.parse(localStorage.getItem('repoatlas_user') || 'null');
        const matchesSaved = saved && saved.email === form.email.trim();
        const matchesDemo = form.email.trim() === DEMO_USER.email && form.password === DEMO_USER.password;
        if (matchesSaved || matchesDemo) {
          const user = matchesDemo ? { name: 'Demo User', email: DEMO_USER.email } : saved;
          localStorage.setItem('repoatlas_user', JSON.stringify(user));
          onLogin(user);
        } else {
          setError('Invalid email or password.');
        }
      }
      setLoading(false);
    }, 600);
  }

  const features = [
    { icon: <GitBranch size={16} color="#6366f1" />, text: 'Interactive architecture graphs' },
    { icon: <Zap size={16} color="#f59e0b" />, text: 'AI-powered code explanations' },
    { icon: <Search size={16} color="#3b82f6" />, text: 'Natural language queries' },
    { icon: <Map size={16} color="#10b981" />, text: 'Secret scanner & onboarding path' },
  ];

  return (
    <div style={{
      height: '100vh', display: 'flex', background: '#0a0e1a', overflow: 'hidden',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 64px',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 50%, #0a0e1a 100%)',
        borderRight: '1px solid #1e2d4a',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '30%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99,102,241,0.35)',
          }}>
            <Map size={26} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>
              Repo<span style={{ color: '#6366f1' }}>Atlas</span>
            </div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Repository Architecture Navigator</div>
          </div>
        </div>

        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3, marginBottom: 16, maxWidth: 420 }}>
          Understand any codebase in{' '}
          <span style={{ color: '#6366f1' }}>minutes</span>, not weeks.
        </h2>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, maxWidth: 400, marginBottom: 40 }}>
          Paste a GitHub URL and get an interactive architecture graph, AI explanations, and a guided onboarding path — instantly.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#151d35',
                border: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Demo hint */}
        <div style={{
          marginTop: 48, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Demo credentials
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
            {DEMO_USER.email} / {DEMO_USER.password}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: 480, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 48px',
        background: '#0a0e1a',
      }}>
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h3>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            {mode === 'login'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} style={{
              background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, padding: 0,
            }}>
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="John Doe"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                autoFocus={mode === 'login'}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                className="input"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                type={showPass ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4,
              }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !form.email || !form.password}
            style={{ height: 44, fontSize: 14, justifyContent: 'center', marginTop: 4 }}
          >
            {loading
              ? <><div className="spinner" style={{ width: 16, height: 16 }} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></>
            }
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#1e2d4a' }} />
            <span style={{ fontSize: 12, color: '#475569' }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: '#1e2d4a' }} />
          </div>
          <button
            onClick={() => {
              const user = { name: 'Demo User', email: DEMO_USER.email };
              localStorage.setItem('repoatlas_user', JSON.stringify(user));
              onLogin(user);
            }}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 13 }}
          >
            <Map size={15} color="#6366f1" /> Continue as Demo User
          </button>
        </div>

        <p style={{ marginTop: 32, fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 1.6 }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
