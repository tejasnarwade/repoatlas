import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TYPE_CONFIG } from '../constants';

export default function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: 'rgba(10,14,26,0.92)', border: '1px solid #1e2d4a',
      borderRadius: 10, backdropFilter: 'blur(12px)',
      overflow: 'hidden', minWidth: 120,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {/* Toggle header */}
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 11px', background: 'none', border: 'none', cursor: 'pointer',
        gap: 8,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Legend
        </span>
        {open ? <ChevronDown size={11} color="#475569" /> : <ChevronUp size={11} color="#475569" />}
      </button>

      {/* Items */}
      {open && (
        <div style={{ padding: '0 11px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'module').map(([type, cfg]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: cfg.color, flexShrink: 0,
                boxShadow: `0 0 4px ${cfg.color}66`,
              }} />
              <span style={{ fontSize: 10, color: '#64748b' }}>{cfg.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, paddingTop: 5, borderTop: '1px solid #1e2d4a' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, boxShadow: '0 0 4px #f59e0b66' }} />
            <span style={{ fontSize: 10, color: '#64748b' }}>High Impact</span>
          </div>
        </div>
      )}
    </div>
  );
}
