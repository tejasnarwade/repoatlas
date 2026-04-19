import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Play, Pause, BookOpen, Zap, ArrowUp, ArrowDown, FileCode } from 'lucide-react';
import { getTypeConfig, EXT_LANG } from '../constants';

export default function TourMode({ path, allNodes, edges, onFocusNode, onHighlight, onClose }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [entered, setEntered] = useState(false);
  const timerRef = useRef(null);
  const AUTO_ADVANCE_MS = 8000;

  const nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]));
  const total = path.length;
  const currentId = path[step];
  const currentNode = nodeMap[currentId];
  const cfg = currentNode ? getTypeConfig(currentNode.type) : { color: '#64748b', label: 'File' };

  const deps = edges.filter(e => e.source === currentId).map(e => e.target);
  const dependents = edges.filter(e => e.target === currentId).map(e => e.source);

  // Animate entry
  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(t);
  }, [step]);

  // Focus node on graph whenever step changes
  useEffect(() => {
    if (!currentId) return;
    onFocusNode(currentId);
    // Highlight current + its direct connections
    const related = new Set([currentId, ...deps, ...dependents]);
    onHighlight(related);
  }, [step]);

  // Auto-play timer
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setStep(s => {
          if (s >= total - 1) { setPlaying(false); return s; }
          return s + 1;
        });
      }, AUTO_ADVANCE_MS);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, total]);

  function goTo(i) {
    setStep(i);
    setPlaying(false);
  }

  function prev() { if (step > 0) { setStep(s => s - 1); setPlaying(false); } }
  function next() {
    if (step < total - 1) { setStep(s => s + 1); setPlaying(false); }
    else { setPlaying(false); }
  }

  const progress = ((step + 1) / total) * 100;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(8,13,26,0.75)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 32px 0',
    }}>
      {/* Tour card */}
      <div style={{
        width: 580, background: '#0a0e1a',
        border: `1px solid ${cfg.color}55`,
        borderRadius: 16,
        boxShadow: `0 0 60px ${cfg.color}22, 0 24px 80px rgba(0,0,0,0.8)`,
        overflow: 'hidden',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: '#1e2d4a' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: `linear-gradient(90deg, ${cfg.color}, #6366f1)`,
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #1e2d4a',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `${cfg.color}22`, border: `1px solid ${cfg.color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={15} color={cfg.color} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Guided Tour · Step {step + 1} of {total}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              Understanding the Codebase
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: '#475569', cursor: 'pointer', padding: 4, borderRadius: 6,
            transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <X size={15} />
          </button>
        </div>

        {/* File info */}
        {currentNode && (
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #1e2d4a' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: `${cfg.color}15`, border: `1px solid ${cfg.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileCode size={18} color={cfg.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.5px', color: cfg.color,
                    background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`,
                    borderRadius: 4, padding: '1px 6px',
                  }}>{cfg.label}</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>{EXT_LANG[currentNode.ext] || currentNode.ext}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
                  {currentNode.path.split('/').pop()}
                </div>
                <div style={{ fontSize: 11, color: '#334155' }}>{currentNode.path}</div>
              </div>
              {/* Quick stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                {[
                  { icon: <FileCode size={10} />, val: `${currentNode.loc} lines` },
                  { icon: <ArrowUp size={10} />, val: `${currentNode.in_degree} used by` },
                  { icon: <ArrowDown size={10} />, val: `${currentNode.out_degree} imports` },
                  ...(currentNode.impact > 0.5 ? [{ icon: <Zap size={10} color="#f59e0b" />, val: 'High impact', highlight: true }] : []),
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: s.highlight ? '#f59e0b' : '#475569' }}>
                    {s.icon} {s.val}
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            {currentNode.summary && (
              <div style={{
                marginTop: 12, padding: '10px 12px',
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                borderRadius: 8, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {currentNode.summary}
              </div>
            )}

            {/* Connections */}
            {(deps.length > 0 || dependents.length > 0) && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dependents.length > 0 && (
                  <div style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '3px 8px' }}>
                    ↑ Used by {dependents.length} file{dependents.length > 1 ? 's' : ''}
                  </div>
                )}
                {deps.length > 0 && (
                  <div style={{ fontSize: 11, color: '#3b82f6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '3px 8px' }}>
                    ↓ Imports {deps.length} file{deps.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step dots + controls */}
        <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
            {path.map((id, i) => {
              const n = nodeMap[id];
              const c = n ? getTypeConfig(n.type) : { color: '#334155' };
              return (
                <button key={id} onClick={() => goTo(i)} title={id.split('/').pop()} style={{
                  width: i === step ? 20 : 8, height: 8,
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: i === step ? c.color : i < step ? `${c.color}66` : '#1e2d4a',
                  transition: 'all 0.25s ease', padding: 0,
                }} />
              );
            })}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={prev} disabled={step === 0} style={{
              background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 7,
              color: step === 0 ? '#334155' : '#94a3b8', cursor: step === 0 ? 'not-allowed' : 'pointer',
              padding: '6px 10px', display: 'flex', alignItems: 'center', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (step > 0) e.currentTarget.style.borderColor = '#475569'; }}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d4a'}
            >
              <ChevronLeft size={15} />
            </button>

            <button onClick={() => setPlaying(v => !v)} style={{
              background: playing ? 'rgba(59,130,246,0.15)' : '#0f1629',
              border: `1px solid ${playing ? '#3b82f6' : '#1e2d4a'}`,
              borderRadius: 7, color: playing ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer', padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            }}>
              {playing ? <Pause size={13} /> : <Play size={13} />}
              {playing ? 'Pause' : 'Auto'}
            </button>

            <button onClick={next} disabled={step === total - 1} style={{
              background: step === total - 1 ? '#0f1629' : `${cfg.color}22`,
              border: `1px solid ${step === total - 1 ? '#1e2d4a' : cfg.color + '55'}`,
              borderRadius: 7,
              color: step === total - 1 ? '#334155' : cfg.color,
              cursor: step === total - 1 ? 'not-allowed' : 'pointer',
              padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            }}>
              {step === total - 1 ? 'Done' : 'Next'} {step < total - 1 && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
