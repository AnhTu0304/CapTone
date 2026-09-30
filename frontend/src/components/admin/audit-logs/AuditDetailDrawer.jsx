import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  X, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  FileText, 
  ArrowRight,
  Fingerprint,
  Info
} from 'lucide-react';
import ActorTypeBadge from './ActorTypeBadge';
import AuditStatusBadge from './AuditStatusBadge';

/**
 * AuditDetailDrawer Component
 * Ngăn kéo chi tiết nhật ký kiểm toán trượt từ cạnh phải:
 * - description
 * - before data
 * - after data
 * - metadata (SHA-256, Session ID, Correlation ID, v.v.)
 * 
 * Ranh giới an toàn: Bản ghi bất biến, nghiêm cấm chỉnh sửa từ UI.
 */
export const AuditDetailDrawer = ({ log, onClose }) => {
  const [copiedHash, setCopiedHash] = useState(false);

  // Close drawer on Escape key
  React.useEffect(() => {
    if (!log) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [log, onClose]);

  if (!log) return null;

  const handleCopyHash = () => {
    if (log.metadata?.sha256) {
      navigator.clipboard.writeText(log.metadata.sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #A7F3D0',
              }}
            >
              <Fingerprint size={20} color="#059669" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    fontSize: '1.0625rem',
                    fontWeight: 800,
                    color: 'var(--dash-text-primary)',
                    fontFamily: 'var(--font-mono)',
                    margin: 0,
                  }}
                >
                  {log.id}
                </h2>
                <AuditStatusBadge status={log.status} />
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--dash-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '2px',
                }}
              >
                <Clock size={12} />
                <span>{log.timestamp}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng ngăn kéo chi tiết kiểm toán"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--dash-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Security & Immutability Notice */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <ShieldCheck size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.75rem', color: '#065F46', lineHeight: 1.5 }}>
              <strong>Bản Ghi Bất Biến (Cryptographically Sealed SHA-256):</strong> Hệ thống ghi nhận theo cơ chế Append-Only. Toàn bộ thông tin nhật ký kiểm toán được niêm phong mật mã, nghiêm cấm chỉnh sửa hoặc ghi đè từ giao diện UI.
            </div>
          </div>

          {/* Quick Context Metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              padding: '14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.8125rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TÁC NHÂN (ACTOR)</div>
              <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>{log.actor}</div>
              <div style={{ marginTop: '4px' }}>
                <ActorTypeBadge actorType={log.actorType} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>HÀNH ĐỘNG (ACTION)</div>
              <div style={{ fontWeight: 700, color: '#1E40AF', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {log.action}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TÀI NGUYÊN MỤC TIÊU</div>
              <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {log.resourceId}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Loại: {log.resourceType}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỔ CHỨC (TENANT)</div>
              <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>{log.organization}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>IP: {log.ipAddress}</div>
            </div>
          </div>

          {/* 1. Description */}
          <div>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="#2563EB" /> Diễn Giải Hành Động (Description)
            </h3>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                fontSize: '0.8125rem',
                color: 'var(--dash-text-primary)',
                lineHeight: 1.6,
              }}
            >
              {log.description}
            </div>
          </div>

          {/* 2. Before Data vs After Data (Diff View) */}
          <div>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight size={15} color="#059669" /> Dữ Liệu Thay Đổi (Before & After State)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {/* Before Data */}
              <div
                style={{
                  borderRadius: '8px',
                  border: '1px solid #FECACA',
                  backgroundColor: '#FEF2F2',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FEE2E2',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    color: '#991B1B',
                    borderBottom: '1px solid #FECACA',
                  }}
                >
                  TRẠNG THÁI TRƯỚC (BEFORE DATA)
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {log.beforeData ? (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#7F1D1D',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(log.beforeData, null, 2)}
                    </pre>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#991B1B', fontStyle: 'italic' }}>
                      (Không có dữ liệu trước - Khởi tạo tài nguyên mới)
                    </span>
                  )}
                </div>
              </div>

              {/* After Data */}
              <div
                style={{
                  borderRadius: '8px',
                  border: '1px solid #BBF7D0',
                  backgroundColor: '#F0FDF4',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#DCFCE7',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    color: '#166534',
                    borderBottom: '1px solid #BBF7D0',
                  }}
                >
                  TRẠNG THÁI SAU (AFTER DATA)
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {log.afterData ? (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#14532D',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(log.afterData, null, 2)}
                    </pre>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#166534', fontStyle: 'italic' }}>
                      (Không có dữ liệu sau - Hành động truy xuất/đọc)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Metadata & Cryptographic Proof */}
          <div>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={15} color="#D97706" /> Siêu Dữ Liệu Kiểm Toán (Metadata & Cryptographic Proof)
            </h3>
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                padding: '14px',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* SHA-256 Hash with Copy button */}
              <div>
                <span style={{ color: 'var(--dash-text-muted)', fontWeight: 600 }}>Chữ ký băm mật mã SHA-256:</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                    backgroundColor: '#0F172A',
                    color: '#F8FAFC',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    wordBreak: 'break-all',
                  }}
                >
                  <span style={{ flex: 1 }}>{log.metadata?.sha256}</span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    aria-label="Sao chép mã băm SHA-256"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedHash ? '#34D399' : '#94A3B8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px',
                    }}
                  >
                    {copiedHash ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '4px' }}>
                <div>
                  <span style={{ color: 'var(--dash-text-muted)', fontWeight: 600 }}>Mã tương quan (Correlation ID):</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {log.metadata?.correlationId || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--dash-text-muted)', fontWeight: 600 }}>Thời gian trễ thực thi:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#059669' }}>
                    {log.metadata?.executionLatency || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--dash-text-muted)', fontWeight: 600 }}>Phiên làm việc (Session ID):</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>
                    {log.metadata?.sessionId || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--dash-text-muted)', fontWeight: 600 }}>Địa chỉ IP nguồn:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>
                    {log.ipAddress}
                  </div>
                </div>
              </div>

              {log.metadata?.userAgent && (
                <div style={{ borderTop: '1px solid var(--dash-border)', paddingTop: '6px' }}>
                  <span style={{ color: 'var(--dash-text-muted)', fontWeight: 600 }}>User Agent / Probe Version:</span>
                  <div style={{ color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', marginTop: '2px' }}>
                    {log.metadata.userAgent}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px 24px',
            borderTop: '1px solid var(--dash-border)',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Info size={13} /> Chế độ chỉ đọc (Read-only view)
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đóng ngăn kéo
          </button>
        </div>
      </div>
    </div>
  );
};

AuditDetailDrawer.propTypes = {
  log: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default AuditDetailDrawer;
