import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Bell,
  Clock,
  Layers,
  Server,
  Box,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Code,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { K8sEventSeverityBadge } from './K8sEventSeverityBadge';
import { telemetryService } from '../../services/telemetryService';

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
 * Format timestamp safely into localized Vietnam time and ISO UTC
 */
export function formatEventDateTime(timestamp) {
  if (!timestamp) return { local: '—', utc: '—', relative: '—' };
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return { local: String(timestamp), utc: String(timestamp), relative: '—' };

    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    let relative = 'Vừa xong';
    if (diffSec >= 60) {
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) relative = `${diffMin} phút trước`;
      else {
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) relative = `${diffHours} giờ trước`;
        else {
          const diffDays = Math.floor(diffHours / 24);
          relative = `${diffDays} ngày trước`;
        }
      }
    } else if (diffSec > 0) {
      relative = `${diffSec} giây trước`;
    }

    return {
      local: d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      utc: d.toISOString(),
      relative,
    };
  } catch {
    return { local: String(timestamp), utc: String(timestamp), relative: '—' };
  }
}

/**
 * EventDetailModal component [S4][PB18] 4.3
 */
export const EventDetailModal = ({
  event: initialEvent,
  eventId,
  clusterContext,
  onClose,
  onApplyFilter,
}) => {
  const [eventData, setEventData] = useState(initialEvent || null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch event details if needed
  const loadEventDetail = useCallback(async () => {
    const targetId = eventId || initialEvent?.id;
    if (!targetId) return;

    // If initialEvent already has complete data and we didn't explicitly request fresh fetch, use it
    if (initialEvent && !eventId) {
      setEventData(initialEvent);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setIsNotFound(false);
    try {
      const res = await telemetryService.getKubernetesEventById(targetId);
      if (res) {
        setEventData(res);
      } else {
        setIsNotFound(true);
      }
    } catch (err) {
      if (err?.message && (err.message.includes('404') || err.message.toLowerCase().includes('không tìm thấy'))) {
        setIsNotFound(true);
      } else {
        setErrorMessage(err.message || 'Không thể tải chi tiết sự kiện Kubernetes');
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, initialEvent]);

  useEffect(() => {
    loadEventDetail();
  }, [loadEventDetail]);

  const handleCopyMessage = () => {
    if (!eventData?.message) return;
    navigator.clipboard.writeText(eventData.message);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleCopyJson = () => {
    if (!eventData) return;
    navigator.clipboard.writeText(JSON.stringify(eventData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleFilterClick = (filterUpdate) => {
    if (onApplyFilter) {
      onApplyFilter(filterUpdate);
      onClose?.();
    }
  };

  if (!initialEvent && !eventId) return null;

  const firstSeen = formatEventDateTime(eventData?.first_seen_at);
  const lastSeen = formatEventDateTime(eventData?.last_seen_at);
  const observedAt = formatEventDateTime(eventData?.observed_at);
  const maskedMessage = maskSensitiveData(eventData?.message || '');

  return (
    <div
      data-testid="event-detail-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        data-testid="event-detail-modal-content"
        className="dash-card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--dash-border, #E2E8F0)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="var(--dash-primary, #4F46E5)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  id="event-detail-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: 'var(--dash-text-primary, #0F172A)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {eventData?.reason || 'Chi tiết Sự kiện Kubernetes'}
                </h2>
                {eventData?.event_type && (
                  <K8sEventSeverityBadge type={eventData.event_type} showFullLabel={true} size="md" />
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary, #64748B)', marginTop: '2px', fontFamily: 'var(--font-mono, monospace)' }}>
                ID: {eventData?.id || eventId || '—'}
                {eventData?.event_uid ? ` • UID: ${eventData.event_uid}` : ''}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="event-detail-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ chi tiết sự kiện"
            style={{
              border: 'none',
              background: 'transparent',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--dash-text-muted, #94A3B8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Loading State */}
          {isLoading ? (
            <div
              data-testid="event-detail-loading"
              style={{
                padding: '40px',
                textAlign: 'center',
                color: 'var(--dash-text-secondary, #64748B)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <RotateCcw size={24} className="animate-spin" color="var(--dash-primary, #4F46E5)" />
              <span>Đang tải thông tin chi tiết sự kiện Kubernetes...</span>
            </div>
          ) : isNotFound || (!eventData && !errorMessage) ? (
            /* Not Found State */
            <div
              data-testid="event-detail-not-found"
              style={{
                padding: '30px',
                textAlign: 'center',
                color: 'var(--dash-text-secondary, #64748B)',
              }}
            >
              <AlertTriangle size={32} color="#D97706" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>Sự kiện không tồn tại</div>
              <p style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>
                Bản ghi này có thể đã bị dọn dẹp hoặc tài khoản không có quyền truy cập.
              </p>
            </div>
          ) : errorMessage ? (
            /* Error State with Retry */
            <div
              data-testid="event-detail-error"
              style={{
                padding: '16px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                color: '#991B1B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                data-testid="event-detail-retry-btn"
                onClick={loadEventDetail}
                style={{
                  padding: '5px 12px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Thử lại
              </button>
            </div>
          ) : (
            /* Full Event Data Details */
            <>
              {/* Primary Key-Value Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border, #E2E8F0)',
                }}
              >
                {/* Object Name & Type */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Đối tượng liên quan
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-primary, #4F46E5)', marginTop: '2px', wordBreak: 'break-all' }}>
                    {eventData.resource_type ? `${eventData.resource_type}/` : ''}
                    {eventData.resource_name || eventData.resource_uid || '—'}
                  </div>
                  {eventData.resource_type && (
                    <button
                      type="button"
                      data-testid="filter-by-resource-btn"
                      onClick={() => handleFilterClick({ resourceType: eventData.resource_type })}
                      style={{
                        marginTop: '4px',
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        fontSize: '0.6875rem',
                        color: 'var(--dash-primary, #4F46E5)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600,
                      }}
                    >
                      <Filter size={10} /> Lọc theo loại {eventData.resource_type}
                    </button>
                  )}
                </div>

                {/* Namespace */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Không gian tên (Namespace)
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary, #0F172A)', marginTop: '2px' }}>
                    {eventData.namespace || 'default'}
                  </div>
                  {eventData.namespace && (
                    <button
                      type="button"
                      data-testid="filter-by-namespace-btn"
                      onClick={() => handleFilterClick({ namespace: eventData.namespace })}
                      style={{
                        marginTop: '4px',
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        fontSize: '0.6875rem',
                        color: 'var(--dash-primary, #4F46E5)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600,
                      }}
                    >
                      <Filter size={10} /> Lọc theo namespace này
                    </button>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Lý do (Reason)
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary, #0F172A)', marginTop: '2px' }}>
                    {eventData.reason || '—'}
                  </div>
                  {eventData.reason && (
                    <button
                      type="button"
                      data-testid="filter-by-reason-btn"
                      onClick={() => handleFilterClick({ reason: eventData.reason })}
                      style={{
                        marginTop: '4px',
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        fontSize: '0.6875rem',
                        color: 'var(--dash-primary, #4F46E5)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600,
                      }}
                    >
                      <Filter size={10} /> Lọc theo lý do này
                    </button>
                  )}
                </div>

                {/* Repetition Count */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Số lần lặp lại
                  </span>
                  <div style={{ marginTop: '2px' }}>
                    <span
                      data-testid="event-detail-count"
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 700,
                        backgroundColor: (eventData.count || 1) > 1 ? 'rgba(99, 102, 241, 0.15)' : '#F1F5F9',
                        color: (eventData.count || 1) > 1 ? '#4F46E5' : 'var(--dash-text-secondary, #64748B)',
                      }}
                    >
                      {eventData.count || 1} lần
                    </span>
                  </div>
                </div>

                {/* Source & Reporting Controller */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Nguồn phát sinh / Controller
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: 'var(--dash-text-secondary, #64748B)', marginTop: '2px' }}>
                    {eventData.source_component ? `Component: ${eventData.source_component}` : ''}
                    {eventData.reporting_controller ? ` • Controller: ${eventData.reporting_controller}` : ''}
                    {!eventData.source_component && !eventData.reporting_controller ? '—' : ''}
                  </div>
                </div>

                {/* Cluster / Context */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Cụm máy chủ & Môi trường
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: 'var(--dash-text-secondary, #64748B)', marginTop: '2px' }}>
                    {eventData.cluster_name || clusterContext?.clusterName || eventData.cluster_id || 'Cụm mặc định'}
                    {(eventData.environment_name || clusterContext?.environmentName) ? ` (${eventData.environment_name || clusterContext?.environmentName})` : ''}
                  </div>
                </div>
              </div>

              {/* Timing Section (Distinguishing First Seen, Last Seen & Ingest Time) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  padding: '12px 14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border, #E2E8F0)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', fontWeight: 700 }}>
                    <Clock size={12} /> LẦN ĐẦU XUẤT HIỆN (FIRST SEEN)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary, #0F172A)', marginTop: '3px' }}>
                    {firstSeen.local}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', marginTop: '1px' }}>
                    {firstSeen.relative} ({firstSeen.utc})
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', fontWeight: 700 }}>
                    <Clock size={12} /> LẦN CUỐI XUẤT HIỆN (LAST SEEN)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary, #0F172A)', marginTop: '3px' }}>
                    {lastSeen.local}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', marginTop: '1px' }}>
                    {lastSeen.relative} ({lastSeen.utc})
                  </div>
                </div>

                {eventData.observed_at && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', fontWeight: 700 }}>
                      <Clock size={12} /> THỜI ĐIỂM QUAN SÁT (OBSERVED/SYNC)
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary, #0F172A)', marginTop: '3px' }}>
                      {observedAt.local}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Box */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary, #0F172A)' }}>
                    Thông điệp chi tiết (Message)
                  </span>
                  <button
                    type="button"
                    data-testid="copy-event-message-btn"
                    onClick={handleCopyMessage}
                    style={{
                      border: '1px solid var(--dash-border, #E2E8F0)',
                      backgroundColor: '#FFFFFF',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: copiedMsg ? '#059669' : 'var(--dash-text-secondary, #64748B)',
                    }}
                  >
                    {copiedMsg ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedMsg ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <div
                  data-testid="event-detail-message-box"
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#0F172A',
                    color: '#F8FAFC',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid #334155',
                  }}
                >
                  {maskedMessage || 'Không có nội dung thông điệp'}
                </div>
              </div>

              {/* Toggle Raw Metadata / JSON */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    data-testid="toggle-raw-json-btn"
                    onClick={() => setShowRawJson(!showRawJson)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--dash-primary, #4F46E5)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Code size={14} />
                    <span>{showRawJson ? 'Thu gọn JSON thô' : 'Xem chi tiết JSON thô (Metadata)'}</span>
                  </button>

                  {showRawJson && (
                    <button
                      type="button"
                      data-testid="copy-event-json-btn"
                      onClick={handleCopyJson}
                      style={{
                        border: '1px solid var(--dash-border, #E2E8F0)',
                        backgroundColor: '#FFFFFF',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: copiedJson ? '#059669' : 'var(--dash-text-secondary, #64748B)',
                      }}
                    >
                      {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedJson ? 'Đã sao chép JSON' : 'Sao chép JSON'}</span>
                    </button>
                  )}
                </div>

                {showRawJson && (
                  <pre
                    data-testid="event-raw-json-box"
                    style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: '#1E293B',
                      color: '#E2E8F0',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.75rem',
                      lineHeight: 1.4,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {JSON.stringify(eventData, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--dash-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: '#F8FAFC',
          }}
        >
          <button
            type="button"
            data-testid="event-detail-footer-close-btn"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border, #CBD5E1)',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--dash-text-primary, #0F172A)',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
