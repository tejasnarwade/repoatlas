import { Files, GitBranch, Layers, Zap } from 'lucide-react';
import { TYPE_CONFIG } from '../constants';

export default function StatsBar({ stats, nodes, onFilterType, activeFilter }) {
  const typeCounts = nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  const highImpact = nodes.filter(n => n.impact > 0.5).length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      {/* Global stats */}
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { icon: <Files size={13} />, val: stats.total_files, label: 'files' },
          { icon: <GitBranch size={13} />, val: stats.total_edges, label: 'deps' },
          { icon: <Zap size={13} color="#f59e0b" />, val: highImpact, label: 'high impact' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
            {s.icon}
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>{s.val}</span>
            <span>{s.label}</span>
          </div>
        ))}
        {stats.languages?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
            <Layers size={13} />
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>{stats.languages.length}</span>
            <span>lang{stats.languages.length > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 2 }}>
              {stats.languages.map(lang => (
                <span key={lang} style={{
                  background: '#151d35', border: '1px solid #1e2d4a',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11, color: '#94a3b8',
                }}>{lang}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: '#1e2d4a' }} />

      {/* Type filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
          const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.module;
          const isActive = activeFilter === type;
          return (
            <button key={type} onClick={() => onFilterType(isActive ? null : type)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: isActive ? cfg.bg : 'transparent',
              border: `1px solid ${isActive ? cfg.color : '#1e2d4a'}`,
              borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = cfg.color; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = '#1e2d4a'; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: 11, color: isActive ? cfg.color : '#64748b', fontWeight: 600 }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 10, color: isActive ? cfg.color : '#475569' }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
