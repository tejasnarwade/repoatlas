import { BookOpen, ChevronRight } from 'lucide-react';
import { getTypeConfig } from '../constants';

export default function OnboardingPanel({ path, allNodes, onNodeClick, activeNodeId }) {
  const nodeMap = Object.fromEntries(allNodes.map(n => [n.id, n]));

  return (
    <div style={{
      background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 12,
      overflow: 'hidden', width: 280,
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #1e2d4a',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <BookOpen size={14} color="#6366f1" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Onboarding Path</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, background: 'rgba(99,102,241,0.15)',
          color: '#6366f1', padding: '2px 6px', borderRadius: 10, fontWeight: 600,
        }}>{path.length} files</span>
      </div>
      <div style={{ padding: 8, maxHeight: 320, overflowY: 'auto' }}>
        {path.map((fileId, i) => {
          const node = nodeMap[fileId];
          const cfg = node ? getTypeConfig(node.type) : { color: '#64748b' };
          const isActive = fileId === activeNodeId;
          return (
            <button key={fileId} onClick={() => onNodeClick(fileId)} style={{
              width: '100%', background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: `1px solid ${isActive ? '#6366f1' : 'transparent'}`,
              borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#151d35'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%', background: '#151d35',
                border: `1px solid ${cfg.color}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 10, fontWeight: 700, color: cfg.color, flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileId.split('/').pop()}
                </div>
                <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileId.split('/').slice(0, -1).join('/')}
                </div>
              </div>
              <ChevronRight size={12} color="#475569" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
