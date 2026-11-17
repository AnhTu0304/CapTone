import React, { useState } from 'react';
import { Check, X, ShieldAlert, Cpu } from 'lucide-react';

export const HITLYamlDiffViewer = ({ className = '', style = {} }) => {
  const [status, setStatus] = useState('pending');

  return (
    <div
      className={`hitl-yaml-diff-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: '260px',
        backgroundColor: '#1A1926',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(61, 59, 79, 0.3)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      data-testid="hitl-yaml-diff-viewer"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={15} color={status === 'approved' ? '#10B981' : status === 'rejected' ? '#EF4444' : '#F59E0B'} />
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', fontWeight: 700, color: '#E2E8F0' }}>
            HITL // KUBERNETES REMEDIATION DIFF
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.6875rem',
            padding: '2px 8px',
            borderRadius: '2px',
            backgroundColor: status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: status === 'approved' ? '#10B981' : status === 'rejected' ? '#EF4444' : '#F59E0B',
            fontWeight: 700,
          }}
        >
          {status === 'approved' ? 'ĐÃ PHÊ DUYỆT // AGENT EXECUTING' : status === 'rejected' ? 'ĐÃ TỪ CHỐI // ABORTED' : 'CHỜ KỸ SƯ PHÊ DUYỆT'}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          padding: '14px 16px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          color: '#CBD5E1',
          overflowX: 'auto',
        }}
      >
        <div style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '6px' }}># deployment.apps/checkout-service (namespace: production)</div>
        <div style={{ color: '#94A3B8' }}>&nbsp;&nbsp;spec:</div>
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#FCA5A5', padding: '1px 6px' }}>
          - &nbsp;replicas: 2
        </div>
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#86EFAC', padding: '1px 6px' }}>
          + &nbsp;replicas: 4 # AI Auto-Scale Surge Prevention
        </div>
        <div style={{ color: '#94A3B8' }}>&nbsp;&nbsp;&nbsp;&nbsp;resources:</div>
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#FCA5A5', padding: '1px 6px' }}>
          - &nbsp;&nbsp;&nbsp;limits.memory: "256Mi"
        </div>
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#86EFAC', padding: '1px 6px' }}>
          + &nbsp;&nbsp;&nbsp;limits.memory: "512Mi" # Fix OOMKilled Headroom
        </div>
      </div>

      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'var(--font-mono, monospace)' }}>
          Risk Radius: Single Pod • Rollback Ready
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setStatus('rejected')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#F87171',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            <X size={13} />
            <span>Từ chối</span>
          </button>
          <button
            type="button"
            onClick={() => setStatus('approved')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              backgroundColor: '#10B981',
              border: '1px solid #059669',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            <Check size={13} />
            <span>Phê duyệt</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HITLYamlDiffViewer;
