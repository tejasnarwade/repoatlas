export const TYPE_CONFIG = {
  entry:   { color: '#6366f1', bg: 'rgba(99,102,241,0.15)',   label: 'Entry Point' },
  api:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',   label: 'API / Route' },
  model:   { color: '#10b981', bg: 'rgba(16,185,129,0.15)',   label: 'Model / DB' },
  service: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',   label: 'Service' },
  utility: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',   label: 'Utility' },
  config:  { color: '#64748b', bg: 'rgba(100,116,139,0.15)',  label: 'Config' },
  test:    { color: '#475569', bg: 'rgba(71,85,105,0.15)',    label: 'Test' },
  ui:      { color: '#ec4899', bg: 'rgba(236,72,153,0.15)',   label: 'UI / View' },
  auth:    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',    label: 'Auth' },
  payment: { color: '#f97316', bg: 'rgba(249,115,22,0.15)',   label: 'Payment' },
  module:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: 'Module' },
};

export const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.module;

export const EXT_LANG = {
  '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
  '.jsx': 'React JSX', '.tsx': 'React TSX',
};
