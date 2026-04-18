import { useState } from 'react';
import { Map, Eye, EyeOff, User, Lock, Mail, ArrowRight, GitBranch, Zap, Search } from 'lucide-react';
import { firebaseLogin, firebaseSignUp } from '../firebase';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  function friendlyError(code) {
    const map = {
      'auth/user-not-found':       'No account found with this email.',
      'auth/wrong-password':       'Incorrect password.',
      'auth/invalid-credential':   'Invalid email or password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password':        'Password must be at least 6 characters.',
      'auth/invalid-email':        'Enter a valid email address.',
      'auth/too-many-requests':    'Too many attempts. Please try again later.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !form.name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    try {
      const user = mode === 'signup'
        ? await firebaseSignUp(form.name.trim(), form.email.trim(), form.password)
        : await firebaseLogin(form.email.trim(), form.password);
      onLogin(user);
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  }

  const features = [
    { icon: <GitBranch size={16} color="#6366f1" />, text: 'Interactive architecture graphs' },
    { icon: <Zap size={16} color="#f59e0b" />,       text: 'AI-powered code explanations' },
    { icon: <Search size={16} color="#3b82f6" />,    text: 'Natural language queries' },
    { icon: <Map size={16} color="#10b981" />,       text: 'Secret scanner & onboarding path' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#0a0e1a', overflow: 'hidden' }}>

      {/* ── Left branding panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 64px', borderRight: '1px solid #1e2d4a', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(99,102,241,0.35)' }}>
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
          Understand any codebase in <span style={{ color: '#6366f1' }}>minutes</span>, not weeks.
        </h2>
        <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, maxWidth: 400, marginBottom: 40 }}>
          Paste a GitHub URL and get an interactive architecture graph, AI explanations, and a guided onboarding path — instantly.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#151d35', border: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {f.icon}
              </div>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ width: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: '#0a0e1a' }}>
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h3>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input className="input" style={{ paddingLeft: 36 }} placeholder="John Doe" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input className="input" style={{ paddingLeft: 36 }} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} autoFocus={mode === 'login'} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input className="input" style={{ paddingLeft: 36, paddingRight: 40 }} type={showPass ? 'text' : 'password'} placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'} value={form.password} onChange={e => set('password', e.target.value)} />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading || !form.email || !form.password} style={{ height: 44, fontSize: 14, justifyContent: 'center', marginTop: 4 }}>
            {loading
              ? <><div className="spinner" style={{ width: 16, height: 16 }} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></>
            }
          </button>
        </form>

        <p style={{ marginTop: 32, fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 1.6 }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
