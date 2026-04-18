import { TYPE_CONFIG } from '../constants';

export default function Legend() {
  return (
    <div style={{
      background: 'rgba(15,22,41,0.9)', border: '1px solid #1e2d4a',
      borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Legend
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'module').map(([type, cfg]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{cfg.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, paddingTop: 6, borderTop: '1px solid #1e2d4a' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#64748b' }}>High Impact</span>
        </div>
      </div>
    </div>
  );
}
