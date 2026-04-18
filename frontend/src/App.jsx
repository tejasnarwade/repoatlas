import { useState } from 'react';
import axios from 'axios';
import LandingPage from './components/LandingPage';
import GraphView from './components/GraphView';

const API = 'http://localhost:8000';

export default function App() {
  const [state, setState] = useState('landing'); // landing | loading | graph | error
  const [data, setData] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

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

  if (state === 'graph' && data) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <GraphView data={data} repoUrl={repoUrl} onReset={() => setState('landing')} />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Analyzing Repository
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              {repoUrl.replace('https://github.com/', '')}
            </div>
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
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>Analysis Failed</div>
          <div style={{
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 10,
            padding: 16, fontSize: 13, color: '#94a3b8', maxWidth: 480, textAlign: 'center',
          }}>{error}</div>
          <button className="btn btn-primary" onClick={() => setState('landing')}>Try Again</button>
        </div>
      ) : (
        <LandingPage onAnalyze={handleAnalyze} loading={state === 'loading'} />
      )}
    </div>
  );
}
