import { Handle, Position } from '@xyflow/react';
import { getTypeConfig } from '../constants';

// Complexity heat → color
const HEAT_COLOR = {
  critical: '#ef4444',  // red
  high:     '#f97316',  // orange
  medium:   '#f59e0b',  // yellow
  low:      '#10b981',  // green
};

function getHeatColor(complexity) {
  if (!complexity) return null;
  return HEAT_COLOR[complexity.heat] || null;
}

export default function ArchNode({ data, selected }) {
  const cfg = getTypeConfig(data.type);
  const isHighImpact = data.impact > 0.5;
  const complexity = data.complexity;
  const heatColor = getHeatColor(complexity);
  const score = complexity?.score ?? null;

  // Border: selected → type color, else heat color if exists, else default
  const borderColor = selected
    ? cfg.color
    : heatColor || (isHighImpact ? cfg.color + '88' : '#1e2d4a');

  return (
    <div style={{
      background: selected
        ? `linear-gradient(135deg, ${cfg.bg}, rgba(10,14,26,0.98))`
        : 'rgba(10,14,26,0.97)',
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '9px 12px',
      minWidth: 150,
      maxWidth: 230,
      cursor: 'pointer',
      boxShadow: selected
        ? `0 0 0 1px ${cfg.color}33, 0 8px 24px rgba(0,0,0,0.5)`
        : heatColor
          ? `0 0 10px ${heatColor}33, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'all 0.15s ease',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{
        background: cfg.color, width: 5, height: 5, border: `1px solid ${cfg.color}66`,
      }} />

      {/* High impact dot */}
      {isHighImpact && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          width: 10, height: 10, borderRadius: '50%',
          background: '#f59e0b',
          boxShadow: '0 0 6px #f59e0b88',
          border: '1.5px solid #0a0e1a',
        }} title="High impact file" />
      )}

      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: cfg.color, flexShrink: 0,
          boxShadow: `0 0 4px ${cfg.color}`,
        }} />
        <span style={{
          fontSize: 9, color: cfg.color, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.6px',
        }}>{cfg.label}</span>
      </div>

      {/* Filename */}
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#e2e8f0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }} title={data.path}>
        {data.path.split('/').pop()}
      </div>

      {/* Directory path */}
      {data.path.includes('/') && (
        <div style={{
          fontSize: 10, color: '#334155', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.path.split('/').slice(0, -1).join('/')}
        </div>
      )}

      {/* Complexity bar */}
      {score !== null && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 3, background: '#1e2d4a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${score}%`,
              background: heatColor || '#10b981',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 6,
        paddingTop: 5, borderTop: '1px solid #1e2d4a11',
      }}>
        <span style={{ fontSize: 10, color: '#334155', display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ color: '#10b981', fontSize: 9 }}>↑</span>{data.in_degree}
        </span>
        <span style={{ fontSize: 10, color: '#334155', display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ color: '#3b82f6', fontSize: 9 }}>↓</span>{data.out_degree}
        </span>
        {score !== null && (
          <span style={{
            fontSize: 9, fontWeight: 700, marginLeft: 'auto',
            color: heatColor || '#10b981',
          }}>
            {score}
          </span>
        )}
        {score === null && (
          <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>{data.loc}L</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{
        background: cfg.color, width: 5, height: 5, border: `1px solid ${cfg.color}66`,
      }} />
    </div>
  );
}
