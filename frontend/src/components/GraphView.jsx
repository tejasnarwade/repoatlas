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
import TourMode from './TourMode';
import EvolutionPanel from './EvolutionPanel';
import { getTypeConfig } from '../constants';
import { Map, BookOpen, X, RotateCcw, ShieldAlert, Compass, Download, GitBranch, AlertTriangle, Image } from 'lucide-react';

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

export default function GraphView({ data, repoUrl, onReset, isPrivate = false, githubToken = '' }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null); // track for edge highlighting
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [filterType, setFilterType] = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramPassword, setDiagramPassword] = useState('');
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState('');
  const [showEvolution, setShowEvolution] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);

  useEffect(() => {
    buildFlow(data.nodes, data.edges, null, null, null);
  }, [data]);

  function buildFlow(rawNodes, rawEdges, filter, highlight, selectedId = null) {
    const filteredNodes = filter ? rawNodes.filter(n => n.type === filter) : rawNodes;
    const filteredIds = new Set(filteredNodes.map(n => n.id));

    const laid = layoutNodes(filteredNodes, rawEdges);

    // When a node is selected, compute its direct neighbours
    const outNeighbours = new Set(); // nodes this file imports
    const inNeighbours  = new Set(); // nodes that import this file
    if (selectedId) {
      rawEdges.forEach(e => {
        if (e.source === selectedId) outNeighbours.add(e.target);
        if (e.target === selectedId) inNeighbours.add(e.source);
      });
    }
    const connectedIds = new Set([...outNeighbours, ...inNeighbours]);

    const flowNodes = laid.map(n => {
      const cfg = getTypeConfig(n.type);
      const isHighlighted = highlight ? highlight.has(n.id) : null;
      const isSelected    = n.id === selectedId;
      const isConnected   = selectedId && connectedIds.has(n.id);
      const dimmed = selectedId
        ? (!isSelected && !isConnected)
        : (highlight && !highlight.has(n.id));
      return {
        id: n.id,
        type: 'archNode',
        position: n.position,
        data: { ...n },
        selected: isSelected,
        style: {
          opacity: dimmed ? 0.15 : 1,
          filter: isSelected
            ? `drop-shadow(0 0 16px ${cfg.color})`
            : isConnected
              ? `drop-shadow(0 0 8px ${cfg.color}88)`
              : isHighlighted
                ? `drop-shadow(0 0 12px ${cfg.color})`
                : 'none',
          transition: 'opacity 0.2s, filter 0.2s',
          zIndex: isSelected ? 10 : isConnected ? 5 : 0,
        },
      };
    });

    const flowEdges = rawEdges
      .filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map(e => {
        const isOutgoing = selectedId && e.source === selectedId; // this file → dependency
        const isIncoming = selectedId && e.target === selectedId; // dependent → this file
        const isActive   = isOutgoing || isIncoming;
        const isQueryHit = highlight && highlight.has(e.source) && highlight.has(e.target);

        // Color: blue = outgoing (imports), green = incoming (used by)
        const activeColor = isOutgoing ? '#3b82f6' : '#10b981';

        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          animated: isActive,
          style: {
            stroke: isActive
              ? activeColor
              : isQueryHit
                ? '#3b82f6'
                : '#1e2d4a',
            strokeWidth: isActive ? 2 : 1,
            opacity: selectedId
              ? (isActive ? 1 : 0.06)
              : highlight
                ? (isQueryHit ? 1 : 0.06)
                : 0.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isActive ? activeColor : '#1e2d4a',
            width: isActive ? 10 : 8,
            height: isActive ? 10 : 8,
          },
          label: isActive ? (isOutgoing ? 'imports' : 'used by') : undefined,
          labelStyle: { fontSize: 9, fill: activeColor, fontWeight: 600 },
          labelBgStyle: { fill: '#0a0e1a', fillOpacity: 0.85 },
          labelBgPadding: [3, 4],
          labelBgBorderRadius: 3,
        };
      });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }

  function handleNodeClick(_, node) {
    const raw = data.nodes.find(n => n.id === node.id);
    setSelectedNode(raw || null);
    setSelectedNodeId(node.id);
    buildFlow(data.nodes, data.edges, filterType, highlighted, node.id);
  }

  function focusNode(nodeId) {
    const raw = data.nodes.find(n => n.id === nodeId);
    setSelectedNode(raw || null);
    setSelectedNodeId(nodeId);
    buildFlow(data.nodes, data.edges, filterType, highlighted, nodeId);
  }

  function handleFilterType(type) {
    setFilterType(type);
    setHighlighted(null);
    setSelectedNodeId(null);
    buildFlow(data.nodes, data.edges, type, null, null);
  }

  function handleQueryResults(ids) {
    const h = new Set(ids);
    setHighlighted(h);
    setFilterType(null);
    setSelectedNodeId(null);
    buildFlow(data.nodes, data.edges, null, h, null);
  }

  function handleTourHighlight(nodeSet) {
    setHighlighted(nodeSet);
    buildFlow(data.nodes, data.edges, null, nodeSet, null);
  }

  function handleTourClose() {
    setShowTour(false);
    setHighlighted(null);
    buildFlow(data.nodes, data.edges, filterType, null, null);
  }

  function handleClearQuery() {
    setHighlighted(null);
    buildFlow(data.nodes, data.edges, filterType, null, selectedNodeId);
  }

  function handleShowOrphans() {
    const orphanIds = data.orphans || [];
    if (showOrphans) {
      setShowOrphans(false);
      setHighlighted(null);
      buildFlow(data.nodes, data.edges, filterType, null, selectedNodeId);
    } else {
      setShowOrphans(true);
      const h = new Set(orphanIds);
      setHighlighted(h);
      buildFlow(data.nodes, data.edges, null, h, null);
    }
  }

  const repoName = repoUrl.split('/').slice(-2).join('/');

  async function handleExport() {
    if (!exportPassword || exportPassword.length < 4) {
      setExportError('Password must be at least 4 characters.');
      return;
    }
    setExportLoading(true);
    setExportError('');
    try {
      const resp = await fetch('http://localhost:8000/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl, password: exportPassword }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Export failed');
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : 'repoatlas_export.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setShowExport(false);
      setExportPassword('');
    } catch (err) {
      setExportError(err.message);
    }
    setExportLoading(false);
  }

  async function handleDiagram() {
    setDiagramLoading(true);
    setDiagramError('');
    try {
      const resp = await fetch('http://localhost:8000/api/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl, password: diagramPassword }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Diagram generation failed');
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : 'architecture.png';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setShowDiagram(false);
      setDiagramPassword('');
    } catch (err) {
      setDiagramError(err.message);
    }
    setDiagramLoading(false);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top toolbar */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid #1e2d4a',
        background: 'linear-gradient(180deg, #0c1120 0%, #0a0e1a 100%)',
        display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        boxShadow: '0 1px 0 #1e2d4a, 0 4px 20px rgba(0,0,0,0.3)',
      }}>
        {/* Row 1: branding + repo + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(99,102,241,0.4)',
            }}>
              <Map size={13} color="white" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }}>
              Repo<span style={{ color: '#6366f1' }}>Atlas</span>
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: '#1e2d4a' }} />

          <div style={{
            background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 6,
            padding: '3px 10px', fontSize: 11, color: '#64748b', fontFamily: 'monospace',
            maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {repoName}
          </div>

          <div style={{ flex: 1 }} />

          <button
            className={`btn btn-ghost${showTour ? ' active' : ''}`}
            onClick={() => { setShowTour(v => !v); setShowOnboarding(false); setSelectedNode(null); }}
            style={{ fontSize: 11, padding: '5px 10px', borderColor: showTour ? '#6366f1' : undefined, color: showTour ? '#6366f1' : undefined }}
          >
            <Compass size={12} />
            Guided Tour
          </button>

          <button
            className={`btn btn-ghost${showOnboarding ? ' active' : ''}`}
            onClick={() => setShowOnboarding(v => !v)}
            style={{ fontSize: 11, padding: '5px 10px' }}
          >
            <BookOpen size={12} />
            Onboarding
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => { setShowSecrets(v => !v); setSelectedNode(null); }}
            style={{ fontSize: 11, padding: '5px 10px', borderColor: showSecrets ? '#ef4444' : undefined, color: showSecrets ? '#ef4444' : undefined }}
          >
            <ShieldAlert size={12} />
            Secrets
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => { setShowExport(v => !v); setExportError(''); }}
            style={{ fontSize: 11, padding: '5px 10px', borderColor: showExport ? '#10b981' : undefined, color: showExport ? '#10b981' : undefined }}
          >
            <Download size={12} /> Export
          </button>

          <button
            className={`btn btn-ghost${showEvolution ? ' active' : ''}`}
            onClick={() => { setShowEvolution(v => !v); setSelectedNode(null); setShowSecrets(false); }}
            style={{ fontSize: 11, padding: '5px 10px', borderColor: showEvolution ? '#6366f1' : undefined, color: showEvolution ? '#6366f1' : undefined }}
          >
            <GitBranch size={12} /> Evolution
          </button>

          {(data.orphans?.length > 0) && (
            <button
              className={`btn btn-ghost${showOrphans ? ' active' : ''}`}
              onClick={handleShowOrphans}
              style={{ fontSize: 11, padding: '5px 10px', borderColor: showOrphans ? '#f59e0b' : undefined, color: showOrphans ? '#f59e0b' : undefined }}
            >
              <AlertTriangle size={12} /> Orphans ({data.orphans.length})
            </button>
          )}

          <div style={{ width: 1, height: 16, background: '#1e2d4a' }} />

          <button className="btn btn-ghost" onClick={onReset} style={{ fontSize: 11, padding: '5px 10px' }}>
            <RotateCcw size={12} /> New Repo
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
        <QueryBar repoUrl={repoUrl} onResults={handleQueryResults} onClear={handleClearQuery} allNodes={data.nodes} isPrivate={isPrivate} />
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
        <div style={{ position: 'absolute', bottom: 140, left: 16, zIndex: 5 }}>
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

        {/* Export modal */}
        {showExport && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: 'rgba(8,13,26,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={e => e.target === e.currentTarget && setShowExport(false)}>
            <div className="fade-in" style={{
              background: '#0a0e1a', border: '1px solid #1e2d4a',
              borderRadius: 14, padding: 24, width: 360,
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                Export Graph Data
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 20, lineHeight: 1.6 }}>
                Downloads an AES-256 encrypted ZIP containing all nodes, edges, AI summaries, and stats for <span style={{ color: '#94a3b8' }}>{repoName}</span>.
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Set ZIP Password
                </div>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter password (min 4 chars)"
                  value={exportPassword}
                  onChange={e => { setExportPassword(e.target.value); setExportError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleExport()}
                  autoFocus
                  style={{ fontSize: 13 }}
                />
              </div>

              {exportError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{exportError}</div>
              )}

              <div style={{ fontSize: 11, color: '#334155', marginBottom: 16, background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 7, padding: '8px 12px', lineHeight: 1.8 }}>
                📄 <b style={{color:'#64748b'}}>GUIDE.txt</b> — full AI-written plain-English explanation of the codebase<br/>
                📋 <b style={{color:'#64748b'}}>summaries.md</b> — per-file AI summaries with commit info<br/>
                🗺 <b style={{color:'#64748b'}}>onboarding.md</b> — numbered reading order for new joinee<br/>
                🔗 <b style={{color:'#64748b'}}>dependency_map.md</b> — what imports what<br/>
                📦 <b style={{color:'#64748b'}}>data/</b> — raw nodes, edges, stats as JSON
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={exportLoading || !exportPassword}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {exportLoading
                    ? <><div className="spinner" style={{ width: 13, height: 13 }} /> Exporting...</>
                    : <><Download size={13} /> Download ZIP</>
                  }
                </button>
                <button className="btn btn-ghost" onClick={() => { setShowExport(false); setExportPassword(''); setExportError(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tour mode overlay */}
        {showTour && (
          <TourMode
            path={data.onboarding_path}
            allNodes={data.nodes}
            edges={data.edges}
            onFocusNode={focusNode}
            onHighlight={handleTourHighlight}
            onClose={handleTourClose}
          />
        )}

        {/* Evolution panel */}
        {showEvolution && (
          <EvolutionPanel
            repoUrl={repoUrl}
            token={githubToken}
            onClose={() => setShowEvolution(false)}
            onFocusNode={focusNode}
          />
        )}

        {/* Detail panel */}
        {selectedNode && !showSecrets && (
          <DetailPanel
            node={selectedNode}
            repoUrl={repoUrl}
            edges={data.edges}
            allNodes={data.nodes}
            onClose={() => {
              setSelectedNode(null);
              setSelectedNodeId(null);
              buildFlow(data.nodes, data.edges, filterType, highlighted, null);
            }}
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
