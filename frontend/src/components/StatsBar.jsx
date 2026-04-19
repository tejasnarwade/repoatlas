import { Files, GitBranch, Layers, Zap } from 'lucide-react';
import { TYPE_CONFIG } from '../constants';

export default function StatsBar({ stats, nodes, onFilterType, activeFilter }) {
  const typeCounts = nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  const highImpact = nodes.filter(n => n.impact > 0.5).length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {/* Global stats */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {[
          { icon: <Files size={11} />, val: stats.total_files, label: 'files' },
          { icon: <GitBranch size={11} />, val: stats.total_edges, label: 'deps' },
          { icon: <Zap size={11} color="#f59e0b" />, val: highImpact, label: 'high impact' },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#475569',
            background: '#0f1629', border: '1px solid #1e2d4a',
            borderRadius: 6, padding: '3px 8px',
          }}>
            {s.icon}
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>{s.val}</span>
            <span>{s.label}</span>
          </div>
        ))}

        {stats.languages?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
            <Layers size={11} />
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>{stats.languages.length}</span>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {stats.languages.map(lang => (
                <span key={lang} style={{
                  background: '#0f1629', border: '1px solid #1e2d4a',
                  borderRadius: 8, padding: '1px 6px', fontSize: 10, color: '#64748b',
                }}>{lang}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: '#1e2d4a', flexShrink: 0 }} />

      {/* Type filters */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.module;
          const isActive = activeFilter === type;
          return (
            <button key={type} onClick={() => onFilterType(isActive ? null : type)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: isActive ? cfg.bg : 'transparent',
              border: `1px solid ${isActive ? cfg.color : '#1e2d4a'}`,
              borderRadius: 16, padding: '2px 8px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.background = cfg.bg + '66'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#1e2d4a'; e.currentTarget.style.background = 'transparent'; } }}
            >
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, boxShadow: isActive ? `0 0 4px ${cfg.color}` : 'none' }} />
              <span style={{ fontSize: 10, color: isActive ? cfg.color : '#475569', fontWeight: 600 }}>
                {cfg.label}
              </span>
              <span style={{
                fontSize: 9, color: isActive ? cfg.color : '#334155',
                background: isActive ? `${cfg.color}22` : '#0f1629',
                borderRadius: 8, padding: '0 4px', fontWeight: 700,
              }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
