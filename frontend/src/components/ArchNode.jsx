import { Handle, Position } from '@xyflow/react';
import { getTypeConfig } from '../constants';

export default function ArchNode({ data, selected }) {
  const cfg = getTypeConfig(data.type);
  const isHighImpact = data.impact > 0.5;

  return (
    <div style={{
      background: selected ? cfg.bg : 'rgba(15,22,41,0.95)',
      border: `1.5px solid ${selected ? cfg.color : isHighImpact ? cfg.color : '#1e2d4a'}`,
      borderRadius: 10,
      padding: '8px 12px',
      minWidth: 140,
      maxWidth: 220,
      cursor: 'pointer',
      boxShadow: selected ? `0 0 16px ${cfg.color}55` : isHighImpact ? `0 0 8px ${cfg.color}33` : 'none',
      transition: 'all 0.15s ease',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: cfg.color, width: 6, height: 6 }} />

      {isHighImpact && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          width: 12, height: 12, borderRadius: '50%',
          background: '#f59e0b', border: '2px solid #0a0e1a',
        }} title="High impact file" />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
        <span style={{
          fontSize: 11, color: '#94a3b8', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>{cfg.label}</span>
      </div>

      <div style={{
        fontSize: 12, fontWeight: 600, color: '#e2e8f0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={data.path}>
        {data.path.split('/').pop()}
      </div>

      {data.path.includes('/') && (
        <div style={{
          fontSize: 10, color: '#475569', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.path.split('/').slice(0, -1).join('/')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>↑{data.in_degree}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>↓{data.out_degree}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{data.loc}L</span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: cfg.color, width: 6, height: 6 }} />
    </div>
  );
}
