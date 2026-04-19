import { useState, useRef, useEffect } from 'react';
import { Search, X, Send, Bot, User, FileCode, ChevronDown, ChevronUp, AtSign } from 'lucide-react';
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

export default function QueryBar({ repoUrl, onResults, onClear, allNodes = [], isPrivate = false }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [taggedFiles, setTaggedFiles] = useState([]); // [{id, name}]
  const [atSearch, setAtSearch] = useState('');       // text after @ currently being typed
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [atMenuIdx, setAtMenuIdx] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Detect @ trigger in input
  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);

    const atMatch = val.match(/@([\w./\-]*)$/);
    if (atMatch) {
      setAtSearch(atMatch[1]);
      setShowAtMenu(true);
      setAtMenuIdx(0);
    } else {
      setShowAtMenu(false);
      setAtSearch('');
    }
  }

  // Filter nodes by @ search text
  const atResults = atSearch !== null && showAtMenu
    ? allNodes
        .filter(n => n.id.toLowerCase().includes(atSearch.toLowerCase()))
        .slice(0, 8)
    : [];

  function selectAtFile(node) {
    // Replace the @... at end of query with nothing (file goes to pill)
    const newQuery = query.replace(/@[\w./\-]*$/, '').trimEnd();
    setQuery(newQuery);
    setShowAtMenu(false);
    setAtSearch('');
    if (!taggedFiles.find(f => f.id === node.id)) {
      setTaggedFiles(prev => [...prev, { id: node.id, name: node.id.split('/').pop() }]);
    }
    inputRef.current?.focus();
  }

  function removeTag(id) {
    setTaggedFiles(prev => prev.filter(f => f.id !== id));
  }

  function handleKeyDown(e) {
    if (showAtMenu && atResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAtMenuIdx(i => Math.min(i + 1, atResults.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAtMenuIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectAtFile(atResults[atMenuIdx]); return; }
      if (e.key === 'Escape')    { setShowAtMenu(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !showAtMenu) handleSearch();
  }

  async function handleSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q && taggedFiles.length === 0) return;

    const displayText = taggedFiles.length > 0
      ? `${taggedFiles.map(f => `@${f.name}`).join(' ')} ${q}`.trim()
      : q;

    const userMsg = { role: 'user', text: displayText, tags: taggedFiles.map(f => f.id) };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setTaggedFiles([]);
    setLoading(true);
    setOpen(true);

    try {
      const { data } = await axios.post(`${API}/api/query`, {
        repo_url: repoUrl,
        query: q || `Explain this file`,
        history: messages,
        file_contexts: taggedFiles.map(f => f.id),
        is_private: isPrivate,
      });
      const botMsg = {
        role: 'bot',
        text: data.answer || (data.highlighted?.length > 0
          ? `Found ${data.highlighted.length} relevant file(s). No AI key configured — showing keyword matches only.`
          : 'No relevant files found.'),
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
    setTaggedFiles([]);
    setOpen(false);
    onClear();
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Input area */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Tagged file pills + input */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5,
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8,
            padding: '6px 10px', minHeight: 36,
          }}
            onClick={() => inputRef.current?.focus()}
          >
            <Search size={13} color="#334155" style={{ flexShrink: 0 }} />

            {/* Pills */}
            {taggedFiles.map(f => (
              <span key={f.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)',
                borderRadius: 5, padding: '1px 6px', fontSize: 11, color: '#3b82f6',
                fontFamily: 'monospace', flexShrink: 0,
              }}>
                <AtSign size={9} />
                {f.name}
                <button onClick={() => removeTag(f.id)} style={{
                  background: 'none', border: 'none', color: '#3b82f6',
                  cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 1,
                }}>×</button>
              </span>
            ))}

            <input
              ref={inputRef}
              style={{
                flex: 1, minWidth: 120, background: 'none', border: 'none',
                outline: 'none', fontSize: 13, color: '#e2e8f0',
                padding: 0,
              }}
              placeholder={taggedFiles.length > 0 ? 'Ask about tagged files...' : 'Ask anything... or type @ to tag a file'}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => messages.length > 0 && setOpen(true)}
            />
          </div>

          {/* @ autocomplete dropdown */}
          {showAtMenu && atResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              marginTop: 4, background: '#0f1629', border: '1px solid #1e2d4a',
              borderRadius: 8, overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}>
              <div style={{ padding: '6px 10px', fontSize: 10, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1e2d4a' }}>
                Tag a file
              </div>
              {atResults.map((node, i) => (
                <button key={node.id} onClick={() => selectAtFile(node)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', background: i === atMenuIdx ? '#151d35' : 'none',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid #0f1629',
                }}
                  onMouseEnter={() => setAtMenuIdx(i)}
                >
                  <FileCode size={12} color="#3b82f6" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#e2e8f0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.id.split('/').pop()}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.id}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{node.type}</span>
                </button>
              ))}
              <div style={{ padding: '5px 10px', fontSize: 10, color: '#334155', borderTop: '1px solid #1e2d4a' }}>
                ↑↓ navigate · Enter to select · Esc to close
              </div>
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSearch}
          className="btn btn-primary"
          disabled={loading || (!query.trim() && taggedFiles.length === 0)}
          style={{ padding: '8px 14px', gap: 6, flexShrink: 0 }}
        >
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={14} />}
          Ask
        </button>

        {messages.length > 0 && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(v => !v)} style={{ padding: '8px 10px', flexShrink: 0 }}>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleClearAll} style={{ padding: '8px 10px', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </>
        )}
      </div>

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setQuery(s); inputRef.current?.focus(); }} style={{
              background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 20,
              padding: '3px 10px', fontSize: 11, color: '#475569', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.color = '#475569'; }}
            >
              {s}
            </button>
          ))}
          <button onClick={() => { setQuery('@'); inputRef.current?.focus(); }} style={{
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20,
            padding: '3px 10px', fontSize: 11, color: '#3b82f6', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'}
          >
            <AtSign size={10} /> Tag a file with @
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && messages.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: 6, background: '#0a0e1a', border: '1px solid #1e2d4a',
          borderRadius: 12, maxHeight: 440, overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.2)',
                  border: `1px solid ${msg.role === 'user' ? '#6366f1' : '#3b82f6'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user'
                    ? <User size={12} color="#6366f1" />
                    : <Bot size={12} color="#3b82f6" />}
                </div>

                <div style={{ flex: 1, maxWidth: '88%' }}>
                  {/* Tagged file pills on user messages */}
                  {msg.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5, justifyContent: 'flex-end' }}>
                      {msg.tags.map(id => (
                        <span key={id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                          borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#3b82f6', fontFamily: 'monospace',
                        }}>
                          <AtSign size={8} />{id.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{
                    background: msg.role === 'user' ? 'rgba(99,102,241,0.1)' : '#0f1629',
                    border: `1px solid ${msg.error ? '#ef4444' : msg.role === 'user' ? '#6366f133' : '#1e2d4a'}`,
                    borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    padding: '10px 14px',
                  }}>
                    {msg.role === 'bot' && !msg.error
                      ? <BotAnswer text={msg.text} />
                      : <p style={{ fontSize: 13, color: msg.error ? '#ef4444' : '#e2e8f0', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                    }
                  </div>

                  {msg.files?.length > 0 && (
                    <div style={{ marginTop: 7 }}>
                      <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                        {msg.files.length} file{msg.files.length > 1 ? 's' : ''} highlighted
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {msg.files.slice(0, 8).map(f => (
                          <span key={f} style={{
                            background: '#080d1a', border: '1px solid #1e2d4a',
                            borderRadius: 5, padding: '2px 7px', fontSize: 11,
                            color: '#3b82f6', fontFamily: 'monospace',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <FileCode size={9} />{f.split('/').pop()}
                          </span>
                        ))}
                        {msg.files.length > 8 && (
                          <span style={{ fontSize: 11, color: '#334155', padding: '2px 4px' }}>+{msg.files.length - 8} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={12} color="#3b82f6" />
                </div>
                <div style={{
                  background: '#0f1629', border: '1px solid #1e2d4a',
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

// Renders bot answer — highlights file references inline as blue chips
function BotAnswer({ text }) {
  if (!text) return null;
  const FILE_RE = /((?:[\w.\-]+\/)*[\w\-]+\.(?:py|js|ts|jsx|tsx|go|java|rb|php|cs|cpp|c|h|rs|swift|vue|svelte|sql|sh|bash|md|json|yaml|yml|html|css|scss|toml|env))/g;
  const parts = text.split(FILE_RE);
  return (
    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <code key={i} style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 4, padding: '1px 5px',
              fontSize: 12, color: '#60a5fa',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}>{part}</code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
