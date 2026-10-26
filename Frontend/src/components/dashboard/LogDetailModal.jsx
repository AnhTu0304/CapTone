import React, { useEffect, useState } from 'react';
import {
  X,
  Terminal,
  Copy,
  Check,
  Clock,
  Server,
  Box,
  Layers,
  Code,
  ShieldAlert,
} from 'lucide-react';

/**
 * Mask sensitive credentials or secrets in text
 */
export function maskSensitiveData(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(password|passwd|pwd|secret|token|api[_-]?key|bearer)\s*[:=]\s*([^\s,;]+)/gi, '$1=******')
    .replace(/(authorization\s*:\s*bearer\s+)([A-Za-z0-9-_=.]+)/gi, '$1******');
}

/**
 * Format timestamp safely into localized Vietnam time and UTC
 */
export function formatLogTimestamp(timestamp) {
  if (!timestamp) return { local: '--', utc: '--' };
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return { local: String(timestamp), utc: String(timestamp) };
    return {
      local: d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      }),
      utc: d.toISOString(),
    };
  } catch {
    return { local: String(timestamp), utc: String(timestamp) };
  }
}

/**
 * Level badge color helper
 */
export function getLogLevelBadgeStyle(level) {
  const norm = (level || 'INFO').toUpperCase();
  switch (norm) {
    case 'FATAL':
    case 'CRITICAL':
      return { bg: '#FFF1F2', text: '#BE123C', border: '#FDA4AF' };
    case 'ERROR':
      return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
    case 'WARN':
    case 'WARNING':
      return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
    case 'DEBUG':
      return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
    case 'INFO':
    default:
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
  }
}

export const LogDetailModal = ({ log, onClose }) => {
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!log) return null;

  const badgeStyle = getLogLevelBadgeStyle(log.level);
  const timeFormatted = formatLogTimestamp(log.occurred_at || log.timestamp);
  const maskedMessage = maskSensitiveData(log.message || log.msg || '');

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(log.message || log.msg || '');
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div
      data-testid="log-detail-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        data-testid="log-detail-modal"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#0F172A',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Terminal size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Chi tiết Bản ghi Nhật ký
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    backgroundColor: badgeStyle.bg,
                    color: badgeStyle.text,
                    border: `1px solid ${badgeStyle.border}`,
                  }}
                >
                  {log.level || 'INFO'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Mã định danh ID: <code style={{ fontFamily: 'var(--font-mono)' }}>#{log.id || 'N/A'}</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="log-detail-close-btn"
            onClick={onClose}
            aria-label="Đóng modal"
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Thời gian (GMT+7):
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                {timeFormatted.local}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Server size={12} /> Dịch vụ (Service):
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0284C7' }}>
                {log.service_name || log.service_id || 'Chưa định danh'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Box size={12} /> Pod ID / Container:
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', fontFamily: 'var(--font-mono)' }}>
                {log.pod_id || log.pod || 'Chưa gán'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={12} /> Nguồn thu thập (Source):
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#059669' }}>
                {log.source || 'k8s-agent'}
              </span>
            </div>

            {log.cluster_id && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B' }}>Cluster UID:</span>
                <span style={{ fontSize: '0.75rem', color: '#475569', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>
                  {log.cluster_id}
                </span>
              </div>
            )}
          </div>

          {/* Full Log Message */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                Thông điệp chi tiết (Message)
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                {copiedMsg ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                <span>{copiedMsg ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <div
              style={{
                backgroundColor: '#1E1E1E',
                color: log.level === 'FATAL' || log.level === 'ERROR' ? '#FCA5A5' : log.level === 'WARN' ? '#FDE68A' : '#F1F5F9',
                padding: '12px 14px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #334155',
              }}
            >
              {maskedMessage || 'Không có nội dung thông điệp'}
            </div>
          </div>

          {/* Metadata JSON Block */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Code size={14} color="#0284C7" /> Dữ liệu cấu trúc đính kèm (Metadata)
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  {copiedJson ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  <span>{copiedJson ? 'Đã sao chép JSON' : 'Sao chép JSON'}</span>
                </button>
              </div>
              <pre
                style={{
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  maxHeight: '160px',
                  margin: 0,
                  border: '1px solid #1E293B',
                }}
              >
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '0.75rem' }}>
            <ShieldAlert size={14} color="#059669" />
            <span>Mã hóa bảo vệ tự động các trường nhạy cảm</span>
          </div>

          <button
            type="button"
            data-testid="log-detail-close-footer-btn"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogDetailModal;
