import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ArchNode from './ArchNode';
import DetailPanel from './DetailPanel';
import OnboardingPanel from './OnboardingPanel';
import StatsBar from './StatsBar';
import QueryBar from './QueryBar';
import Legend from './Legend';
import SecretsPanel from './SecretsPanel';
import { getTypeConfig } from '../constants';
import { Map, BookOpen, X, RotateCcw, ShieldAlert } from 'lucide-react';

const NODE_TYPES = { archNode: ArchNode };

function layoutNodes(nodes, edges) {
  // Group by type for layered layout
  const typeOrder = ['entry', 'config', 'api', 'auth', 'payment', 'service', 'model', 'utility', 'ui', 'test', 'module'];
  const groups = {};
  nodes.forEach(n => {
    const g = typeOrder.includes(n.type) ? n.type : 'module';
    if (!groups[g]) groups[g] = [];
    groups[g].push(n);
  });

  const W = 240, H = 110, COL_GAP = 60, ROW_GAP = 30;
  const COLS = 5;
  const positioned = [];
  let col = 0, row = 0;

  typeOrder.forEach(type => {
    if (!groups[type]) return;
    groups[type].forEach(n => {
      positioned.push({ ...n, position: { x: col * (W + COL_GAP), y: row * (H + ROW_GAP) } });
      col++;
      if (col >= COLS) { col = 0; row++; }
    });
  });

  return positioned;
}

export default function GraphView({ data, repoUrl, onReset }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [filterType, setFilterType] = useState(null);
  const [highlighted, setHighlighted] = useState(null); // set of node ids

  useEffect(() => {
    buildFlow(data.nodes, data.edges, null, null);
  }, [data]);

  function buildFlow(rawNodes, rawEdges, filter, highlight) {
    const filteredNodes = filter ? rawNodes.filter(n => n.type === filter) : rawNodes;
    const filteredIds = new Set(filteredNodes.map(n => n.id));

    const laid = layoutNodes(filteredNodes, rawEdges);

    const flowNodes = laid.map(n => {
      const cfg = getTypeConfig(n.type);
      const isHighlighted = highlight ? highlight.has(n.id) : null;
      const dimmed = highlight && !highlight.has(n.id);
      return {
        id: n.id,
        type: 'archNode',
        position: n.position,
        data: { ...n },
        style: {
          opacity: dimmed ? 0.2 : 1,
          filter: isHighlighted ? `drop-shadow(0 0 12px ${cfg.color})` : 'none',
          transition: 'opacity 0.3s, filter 0.3s',
        },
      };
    });

    const flowEdges = rawEdges
      .filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map(e => ({
        id: `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: highlight ? (highlight.has(e.source) && highlight.has(e.target)) : false,
        style: {
          stroke: highlight
            ? (highlight.has(e.source) && highlight.has(e.target) ? '#3b82f6' : '#1e2d4a')
            : '#1e2d4a',
          strokeWidth: 1,
          opacity: highlight ? (highlight.has(e.source) && highlight.has(e.target) ? 1 : 0.15) : 0.6,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#1e2d4a', width: 8, height: 8 },
      }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }

  function handleNodeClick(_, node) {
    const raw = data.nodes.find(n => n.id === node.id);
    setSelectedNode(raw || null);
  }

  function focusNode(nodeId) {
    const raw = data.nodes.find(n => n.id === nodeId);
    setSelectedNode(raw || null);
    setNodes(prev => prev.map(n => ({
      ...n,
      selected: n.id === nodeId,
    })));
  }

  function handleFilterType(type) {
    setFilterType(type);
    setHighlighted(null);
    buildFlow(data.nodes, data.edges, type, null);
  }

  function handleQueryResults(ids) {
    const h = new Set(ids);
    setHighlighted(h);
    setFilterType(null);
    buildFlow(data.nodes, data.edges, null, h);
  }

  function handleClearQuery() {
    setHighlighted(null);
    buildFlow(data.nodes, data.edges, filterType, null);
  }

  const repoName = repoUrl.split('/').slice(-2).join('/');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top toolbar */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #1e2d4a',
        background: '#0a0e1a', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
      }}>
        {/* Row 1: branding + repo + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Map size={14} color="white" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>
              Repo<span style={{ color: '#6366f1' }}>Atlas</span>
            </span>
          </div>

          <div style={{ width: 1, height: 20, background: '#1e2d4a' }} />

          <div style={{
            background: '#151d35', border: '1px solid #1e2d4a', borderRadius: 8,
            padding: '4px 12px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace',
          }}>
            {repoName}
          </div>

          <div style={{ flex: 1 }} />

          <button
            className="btn btn-ghost"
            onClick={() => setShowOnboarding(v => !v)}
            style={{ fontSize: 12 }}
          >
            <BookOpen size={13} />
            Onboarding Path
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => { setShowSecrets(v => !v); setSelectedNode(null); }}
            style={{ fontSize: 12, borderColor: showSecrets ? '#ef4444' : undefined, color: showSecrets ? '#ef4444' : undefined }}
          >
            <ShieldAlert size={13} />
            Secret Scan
          </button>

          <button className="btn btn-ghost" onClick={onReset} style={{ fontSize: 12 }}>
            <RotateCcw size={13} /> New Repo
          </button>
        </div>

        {/* Row 2: stats */}
        <StatsBar
          stats={data.stats}
          nodes={data.nodes}
          onFilterType={handleFilterType}
          activeFilter={filterType}
        />

        {/* Row 3: query bar */}
        <QueryBar repoUrl={repoUrl} onResults={handleQueryResults} onClear={handleClearQuery} allNodes={data.nodes} />
      </div>

      {/* Graph area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          style={{ background: '#080d1a' }}
        >
          <Background color="#1e2d4a" gap={24} size={1} />
          <Controls style={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8 }} />
          <MiniMap
            style={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 8 }}
            nodeColor={n => getTypeConfig(n.data?.type)?.color || '#94a3b8'}
            maskColor="rgba(8,13,26,0.8)"
          />
        </ReactFlow>

        {/* Legend overlay */}
        <div style={{ position: 'absolute', bottom: 80, left: 16, zIndex: 5 }}>
          <Legend />
        </div>

        {/* Highlighted count badge */}
        {highlighted && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6',
            borderRadius: 20, padding: '6px 16px', fontSize: 12, color: '#3b82f6',
            fontWeight: 600, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {highlighted.size} files matched
            <button onClick={handleClearQuery} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Onboarding panel overlay */}
        {showOnboarding && (
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 5 }}>
            <OnboardingPanel
              path={data.onboarding_path}
              allNodes={data.nodes}
              onNodeClick={focusNode}
              activeNodeId={selectedNode?.id}
            />
          </div>
        )}

        {/* Detail panel */}
        {selectedNode && !showSecrets && (
          <DetailPanel
            node={selectedNode}
            repoUrl={repoUrl}
            edges={data.edges}
            allNodes={data.nodes}
            onClose={() => setSelectedNode(null)}
            onNodeClick={focusNode}
          />
        )}

        {/* Secrets panel */}
        {showSecrets && (
          <SecretsPanel
            repoUrl={repoUrl}
            onClose={() => setShowSecrets(false)}
            onHighlightFiles={(files) => handleQueryResults(files)}
          />
        )}
      </div>
    </div>
  );
}
