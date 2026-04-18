import { useState, useRef, useEffect } from 'react';
import { Search, X, Send, Bot, User, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:8000';

const SUGGESTIONS = [
  'Where is authentication handled?',
  'Show the payment flow',
  'What does the main entry point do?',
  'Find all database models',
  'Show API routes',
  'What are the utility helpers?',
];

export default function QueryBar({ repoUrl, onResults, onClear }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function handleSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    const userMsg = { role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    setOpen(true);

    try {
      const { data } = await axios.post(`${API}/api/query`, { repo_url: repoUrl, query: q });
      const botMsg = {
        role: 'bot',
        text: data.answer || 'Here are the most relevant files I found:',
        files: data.highlighted || [],
      };
      setMessages(prev => [...prev, botMsg]);
      if (data.highlighted?.length > 0) onResults(data.highlighted);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'Error: ' + (err.response?.data?.detail || err.message),
        files: [],
        error: true,
      }]);
    }
    setLoading(false);
  }

  function handleClearAll() {
    setMessages([]);
    setQuery('');
    setOpen(false);
    onClear();
  }

  function handleSuggestion(s) {
    setQuery(s);
    setOpen(true);
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Input row */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none',
          }} />
          <input
            className="input"
            style={{ paddingLeft: 32, paddingRight: 14, fontSize: 13 }}
            placeholder="Ask anything about this codebase..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => messages.length > 0 && setOpen(true)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !query.trim()}
          style={{ padding: '8px 14px', gap: 6 }}
        >
          {loading
            ? <div className="spinner" style={{ width: 14, height: 14 }} />
            : <Send size={14} />}
          Ask
        </button>
        {messages.length > 0 && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(v => !v)} style={{ padding: '8px 10px' }}>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleClearAll} style={{ padding: '8px 10px' }}>
              <X size={14} />
            </button>
          </>
        )}
      </form>

      {/* Suggestion chips — only when no messages */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => handleSuggestion(s)} style={{
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

      {/* Chat panel dropdown */}
      {open && messages.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: 6, background: '#0f1629', border: '1px solid #1e2d4a',
          borderRadius: 12, maxHeight: 420, overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.2)',
                  border: `1px solid ${msg.role === 'user' ? '#6366f1' : '#3b82f6'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User size={13} color="#6366f1" />
                    : <Bot size={13} color="#3b82f6" />}
                </div>

                {/* Bubble */}
                <div style={{ flex: 1, maxWidth: '85%' }}>
                  <div style={{
                    background: msg.role === 'user' ? 'rgba(99,102,241,0.1)' : '#151d35',
                    border: `1px solid ${msg.error ? '#ef4444' : msg.role === 'user' ? '#6366f155' : '#1e2d4a'}`,
                    borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '10px 14px',
                  }}>
                    <p style={{
                      fontSize: 13, color: msg.error ? '#ef4444' : '#e2e8f0',
                      lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.text}
                    </p>
                  </div>

                  {/* Relevant files */}
                  {msg.files?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                        {msg.files.length} relevant file{msg.files.length > 1 ? 's' : ''} highlighted on graph
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {msg.files.slice(0, 8).map(f => (
                          <span key={f} style={{
                            background: '#080d1a', border: '1px solid #2a3f6a',
                            borderRadius: 6, padding: '2px 8px', fontSize: 11,
                            color: '#3b82f6', fontFamily: 'monospace',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <FileCode size={10} />
                            {f.split('/').pop()}
                          </span>
                        ))}
                        {msg.files.length > 8 && (
                          <span style={{ fontSize: 11, color: '#475569', padding: '2px 4px' }}>
                            +{msg.files.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading bubble */}
            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={13} color="#3b82f6" />
                </div>
                <div style={{
                  background: '#151d35', border: '1px solid #1e2d4a',
                  borderRadius: '4px 12px 12px 12px', padding: '12px 16px',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#3b82f6',
                      animation: 'pulse 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
