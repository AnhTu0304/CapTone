import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import i18n, { getIntlLocale, normalizeLanguage } from '../../i18n';

/**
 * Mask sensitive credentials or secrets in text
 */
export function maskSensitiveData(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(password|passwd|pwd|secret|token|api[_-]?key|bearer)\s*[:=]\s*([^\s,;]+)/gi, '$1=******')
    .replace(/(authorization\s*:\s*bearer\s+)([A-Za-z0-9-_=.]+)/gi, '$1******');
}

const K8S_REASON_VI_MAP = {
  DeploymentRecovered: 'Phục hồi Deployment',
  DeploymentRollout: 'Triển khai phiên bản mới',
  MinimumReplicasUnavailable: 'Thiếu bản sao khả dụng',
  ScalingReplicaSet: 'Co giãn bản sao (ReplicaSet)',
  SuccessfulCreate: 'Khởi tạo Pod mới',
  SuccessfulDelete: 'Thu hồi / Xóa Pod',
  Scheduled: 'Đã lập lịch vào Node',
  Pulled: 'Đã nạp Container Image',
  Pulling: 'Đang tải Container Image',
  Created: 'Đã tạo Container',
  Started: 'Đã khởi chạy Container',
  Killing: 'Dừng / Khởi động lại Container',
  Unhealthy: 'Kiểm tra sức khỏe (Probe) thất bại',
  BackOff: 'Chờ khởi động lại (BackOff)',
  CrashLoopBackOff: 'Lặp lỗi khởi động (CrashLoopBackOff)',
  OOMKilled: 'Tràn bộ nhớ RAM (OOMKilled)',
  Error: 'Container dừng do lỗi',
  Failed: 'Thao tác Container thất bại',
  FailedScheduling: 'Không thể lập lịch Pod',
  NodeReady: 'Node sẵn sàng',
  NodeNotReady: 'Node mất kết nối',
};

export function translateK8sEventReasonVi(reason) {
  if (!reason || normalizeLanguage(i18n.language) === 'en') return '';
  return K8S_REASON_VI_MAP[reason] || '';
}

function translateProbeFailureDetailVi(detail) {
  if (!detail) return '';
  let d = String(detail);
  d = d.replace(
    /HTTP probe failed with statuscode:\s*(\d+)/gi,
    'Kiểm tra HTTP trả về mã lỗi: $1'
  );
  d = d.replace(
    /context deadline exceeded \(Client\.Timeout exceeded while awaiting headers\)/gi,
    'quá thời gian chờ phản hồi (Timeout khi chờ HTTP headers)'
  );
  d = d.replace(
    /net\/http: request canceled while waiting for connection \(Client\.Timeout exceeded while awaiting headers\)/gi,
    'yêu cầu HTTP bị hủy khi chờ kết nối (Timeout)'
  );
  d = d.replace(
    /net\/http: request canceled \(Client\.Timeout exceeded while awaiting headers\)/gi,
    'yêu cầu HTTP bị hủy do quá hạn chờ (Timeout)'
  );
  d = d.replace(/context deadline exceeded/gi, 'quá thời gian chờ phản hồi (Timeout)');
  d = d.replace(/connect: connection refused/gi, 'từ chối kết nối (connection refused)');
  d = d.replace(/read: connection reset by peer/gi, 'kết nối bị đóng đột ngột (connection reset by peer)');
  d = d.replace(/net\/http: TLS handshake timeout/gi, 'quá thời gian bắt tay TLS (TLS handshake timeout)');
  return d;
}

export function translateK8sEventMessageVi(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') return '';
  if (normalizeLanguage(i18n.language) === 'en') return rawMessage.trim();
  let msg = rawMessage.trim();
  let prefix = '';

  if (msg.startsWith('(combined from similar events):')) {
    prefix = '(Gộp từ các sự kiện tương tự): ';
    msg = msg.replace(/^\(combined from similar events\):\s*/i, '');
  }

  // 1. DeploymentRecovered (with or without [version: ..., rev: #...])
  const depRecMatch = msg.match(
    /^Deployment\s+'([^']+)'(?:\s+\[version:\s*([^,\]]+)(?:,\s*rev:\s*#?([^\]]+))?\])?\s+recovered from\s+(\S+)\s+to\s+Healthy\s+\(ready=([^,]+),\s*available=([^)]+)\)\.?$/i
  );
  if (depRecMatch) {
    const [, depName, ver, rev, prevReason, ready, avail] = depRecMatch;
    const verText = ver ? ` [phiên bản: ${ver.trim()}${rev ? `, bản ghi: #${rev.trim()}` : ''}]` : '';
    const prevVi = K8S_REASON_VI_MAP[prevReason] ? `${prevReason} (${K8S_REASON_VI_MAP[prevReason]})` : prevReason;
    return `${prefix}Deployment '${depName}'${verText} đã phục hồi từ trạng thái ${prevVi} về Khỏe mạnh (sẵn sàng=${ready}, khả dụng=${avail}).`;
  }

  // 2. DeploymentRollout
  const rolloutMatch = msg.match(
    /^Deployment\s+'([^']+)'\s+rolled out version\s+'([^']+)'\s+\(previous='([^']+)',\s*generation=([^,]+),\s*image='([^']+)',\s*ready=([^)]+)\)\.?$/i
  );
  if (rolloutMatch) {
    const [, depName, newVer, prevVer, gen, img, ready] = rolloutMatch;
    return `${prefix}Deployment '${depName}' đã triển khai phiên bản mới '${newVer}' (phiên bản trước='${prevVer}', thế hệ=${gen}, image='${img}', sẵn sàng=${ready}).`;
  }

  // 3. Deployment insufficient available replicas
  const depInsuffMatch = msg.match(
    /^Deployment\s+'([^']+)'(?:\s+\[version:\s*([^,\]]+)(?:,\s*rev:\s*#?([^\]]+))?\])?\s+has insufficient available replicas\s+\(([^)]+)\)\.?$/i
  );
  if (depInsuffMatch) {
    const [, depName, ver, rev, details] = depInsuffMatch;
    const verText = ver ? ` [phiên bản: ${ver.trim()}${rev ? `, bản ghi: #${rev.trim()}` : ''}]` : '';
    const detailsVi = details
      .replace(/desired=/g, 'yêu cầu=')
      .replace(/ready=/g, 'sẵn sàng=')
      .replace(/available=/g, 'khả dụng=')
      .replace(/unavailable=/g, 'chưa sẵn sàng=');
    return `${prefix}Deployment '${depName}'${verText} không đủ số lượng bản sao khả dụng (${detailsVi}).`;
  }

  // 4. MinimumReplicasUnavailable standard K8s messages
  if (/^Deployment does not have minimum availability\.?$/i.test(msg)) {
    return `${prefix}Deployment chưa đạt số lượng bản sao khả dụng tối thiểu (MinimumReplicasUnavailable).`;
  }
  if (/^Deployment has minimum availability\.?$/i.test(msg)) {
    return `${prefix}Deployment đã đạt số lượng bản sao khả dụng tối thiểu.`;
  }

  // 5. ScalingReplicaSet (Scaled up / Scaled down)
  const scaleMatch = msg.match(
    /^Scaled\s+(up|down)\s+replica set\s+(\S+)(?:\s+\[version:\s*([^\]]+)\])?\s+from\s+(\d+)\s+to\s+(\d+)\.?$/i
  );
  if (scaleMatch) {
    const [, dir, rsName, ver, fromCount, toCount] = scaleMatch;
    const isUp = dir.toLowerCase() === 'up';
    const verText = ver ? ` [phiên bản: ${ver.trim()}]` : '';
    return isUp
      ? `${prefix}Đã mở rộng (Scale Up) ReplicaSet ${rsName}${verText} từ ${fromCount} lên ${toCount} bản sao Pod.`
      : `${prefix}Đã thu hẹp (Scale Down) ReplicaSet ${rsName}${verText} từ ${fromCount} xuống ${toCount} bản sao Pod.`;
  }

  // 6. SuccessfulCreate / SuccessfulDelete
  const createPodMatch = msg.match(/^Created pod:\s+(\S+)$/i);
  if (createPodMatch) {
    return `${prefix}Đã khởi tạo Pod mới: ${createPodMatch[1]}`;
  }
  const deletePodMatch = msg.match(/^Deleted pod:\s+(\S+)$/i);
  if (deletePodMatch) {
    return `${prefix}Đã xóa / thu hồi Pod cũ: ${deletePodMatch[1]}`;
  }

  // 7. Scheduled
  const schedMatch = msg.match(/^Successfully assigned\s+(\S+)\s+to\s+(\S+)$/i);
  if (schedMatch) {
    return `${prefix}Đã lập lịch và phân bổ thành công Pod ${schedMatch[1]} vào Node ${schedMatch[2]}`;
  }

  // 8. Pulled / Pulling
  const pulledPresentMatch = msg.match(
    /^Container image\s+"([^"]+)"\s+already present on machine and can be accessed by the pod\.?$/i
  );
  if (pulledPresentMatch) {
    return `${prefix}Container image "${pulledPresentMatch[1]}" đã có sẵn trên máy chủ Node và sẵn sàng cho Pod sử dụng.`;
  }
  const pullingMatch = msg.match(/^Pulling image\s+"([^"]+)"$/i);
  if (pullingMatch) {
    return `${prefix}Đang tải Container image "${pullingMatch[1]}" về máy chủ Node.`;
  }
  const pulledSuccessMatch = msg.match(/^Successfully pulled image\s+"([^"]+)"(?:\s+in\s+(.+))?$/i);
  if (pulledSuccessMatch) {
    return `${prefix}Đã tải thành công Container image "${pulledSuccessMatch[1]}"${pulledSuccessMatch[2] ? ` (thời gian: ${pulledSuccessMatch[2]})` : ''}.`;
  }

  // 9. Created / Started / Stopping container
  if (/^Container created\.?$/i.test(msg)) {
    return `${prefix}Đã tạo Container thành công.`;
  }
  if (/^Container started\.?$/i.test(msg)) {
    return `${prefix}Đã khởi chạy Container thành công.`;
  }
  const stoppingMatch = msg.match(/^Stopping container\s+(\S+)$/i);
  if (stoppingMatch) {
    return `${prefix}Đang dừng Container '${stoppingMatch[1]}' (thu hồi hoặc khởi động lại Pod).`;
  }

  // 10. Killing due to failed probe
  const killingProbeMatch = msg.match(
    /^Container\s+(\S+)\s+failed\s+(liveness|readiness|startup)\s+probe,\s+will be restarted\.?$/i
  );
  if (killingProbeMatch) {
    const [, containerName, probeType] = killingProbeMatch;
    const probeVi =
      probeType.toLowerCase() === 'liveness'
        ? 'kiểm tra sống còn (Liveness Probe)'
        : probeType.toLowerCase() === 'readiness'
        ? 'kiểm tra sẵn sàng (Readiness Probe)'
        : 'kiểm tra khởi động (Startup Probe)';
    return `${prefix}Container '${containerName}' thất bại ${probeVi}, hệ thống sẽ tự động khởi động lại.`;
  }

  // 11. Container terminated with Error / OOMKilled
  const termMatch = msg.match(
    /^Container\s+'([^']+)'\s+in pod\s+'([^']+)'\s+terminated with\s+(\S+)\s+\(exit_code=([^,]+),\s*restart_count=([^)]+)\)\.?$/i
  );
  if (termMatch) {
    const [, cName, pName, termReason, exitCode, restartCount] = termMatch;
    const exitNote = String(exitCode).trim() === '137' ? '137 - SIGKILL/OOM' : exitCode;
    return `${prefix}Container '${cName}' trong Pod '${pName}' đã dừng đột ngột do ${termReason} (mã thoát=${exitNote}, số lần khởi động lại=${restartCount}).`;
  }

  // 12. Unhealthy: Readiness / Liveness / Startup probe failed
  const probeFailMatch = msg.match(/^(Readiness|Liveness|Startup)\s+probe failed:\s*(.+)$/i);
  if (probeFailMatch) {
    const [, probeType, detail] = probeFailMatch;
    const probeVi =
      probeType.toLowerCase() === 'liveness'
        ? 'Kiểm tra sống còn (Liveness Probe) thất bại'
        : probeType.toLowerCase() === 'readiness'
        ? 'Kiểm tra sẵn sàng (Readiness Probe) thất bại'
        : 'Kiểm tra khởi động (Startup Probe) thất bại';
    return `${prefix}${probeVi}: ${translateProbeFailureDetailVi(detail)}`;
  }

  // 13. BackOff
  const backOffMatch = msg.match(/^Back-off restarting failed container\s+(\S+)\s+in pod\s+(\S+)$/i);
  if (backOffMatch) {
    return `${prefix}Đang tạm hoãn chờ khởi động lại Container bị lỗi '${backOffMatch[1]}' trong Pod '${backOffMatch[2]}' (CrashLoopBackOff).`;
  }

  return `${prefix}${msg}`;
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
    let relative = i18n.t('dashMonitoring:common.justNow');
    if (diffSec >= 60) {
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) relative = i18n.t('dashMonitoring:common.minutesAgo', { count: diffMin });
      else {
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) relative = i18n.t('dashMonitoring:common.hoursAgo', { count: diffHours });
        else {
          const diffDays = Math.floor(diffHours / 24);
          relative = i18n.t('dashMonitoring:common.daysAgo', { count: diffDays });
        }
      }
    } else if (diffSec > 0) {
      relative = i18n.t('dashMonitoring:common.secondsAgo', { count: diffSec });
    }

    return {
      local: d.toLocaleString(getIntlLocale(i18n.language), {
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
  const { t } = useTranslation('dashMonitoring');
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
        setErrorMessage(err.message || t('events.modal.fetchError'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, initialEvent, t]);

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
  const translatedMessage = translateK8sEventMessageVi(maskedMessage);
  const reasonVi = translateK8sEventReasonVi(eventData?.reason);
  const resolvedNamespace = (() => {
    const rawNs = eventData?.namespace || eventData?.metadata?.namespace;
    if (rawNs && rawNs !== 'default') return rawNs;
    const m = typeof eventData?.message === 'string'
      ? eventData.message.match(/(?:pod|Deployment)\s+['"]([^/'"\s]+)\//i)
      : null;
    if (m && m[1]) return m[1];
    return rawNs || 'default';
  })();

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
                  {eventData?.reason || t('events.modal.defaultTitle')}
                  {reasonVi ? (
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569', marginLeft: '6px' }}>
                      ({reasonVi})
                    </span>
                  ) : null}
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
            aria-label={t('events.modal.closeAria')}
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
              <span>{t('events.modal.loading')}</span>
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
              <div style={{ fontWeight: 600 }}>{t('events.modal.notFoundTitle')}</div>
              <p style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>
                {t('events.modal.notFoundDesc')}
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
                {t('common.retry')}
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
                    {t('events.modal.objectLabel')}
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
                      <Filter size={10} /> {t('events.modal.filterByResource', { type: eventData.resource_type })}
                    </button>
                  )}
                </div>

                {/* Namespace */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {t('events.modal.namespaceLabel')}
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary, #0F172A)', marginTop: '2px' }}>
                    {resolvedNamespace}
                  </div>
                  {(eventData.namespace || resolvedNamespace) && (
                    <button
                      type="button"
                      data-testid="filter-by-namespace-btn"
                      onClick={() => handleFilterClick({ namespace: resolvedNamespace })}
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
                      <Filter size={10} /> {t('events.modal.filterByNamespace')}
                    </button>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {t('events.modal.reasonLabel')}
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary, #0F172A)', marginTop: '2px' }}>
                    {eventData.reason || '—'}
                    {reasonVi ? (
                      <div style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '0.73rem', fontWeight: 600, color: '#059669', marginTop: '2px' }}>
                        {reasonVi}
                      </div>
                    ) : null}
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
                      <Filter size={10} /> {t('events.modal.filterByReason')}
                    </button>
                  )}
                </div>

                {/* Repetition Count */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {t('events.modal.countLabel')}
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
                      {t('events.modal.countValue', { count: eventData.count || 1 })}
                    </span>
                  </div>
                </div>

                {/* Source & Reporting Controller */}
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {t('events.modal.sourceLabel')}
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
                    {t('events.modal.clusterLabel')}
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: 'var(--dash-text-secondary, #64748B)', marginTop: '2px' }}>
                    {eventData.cluster_name || clusterContext?.clusterName || eventData.cluster_id || t('events.modal.defaultCluster')}
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
                    <Clock size={12} /> {t('events.modal.firstSeen')}
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
                    <Clock size={12} /> {t('events.modal.lastSeen')}
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
                      <Clock size={12} /> {t('events.modal.observedAt')}
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
                    {t('events.modal.messageTitle')}
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
                    <span>{copiedMsg ? t('common.copied') : t('common.copy')}</span>
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
                  <div>{translatedMessage || maskedMessage || t('events.modal.emptyMessage')}</div>
                  {translatedMessage && translatedMessage !== maskedMessage && (
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px dashed #334155',
                        fontSize: '0.73rem',
                        color: '#94A3B8',
                      }}
                    >
                      {t('events.modal.originalMessagePrefix')} {maskedMessage}
                    </div>
                  )}
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
                    <span>{showRawJson ? t('events.modal.hideRawJson') : t('events.modal.showRawJson')}</span>
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
                      <span>{copiedJson ? t('common.copiedJson') : t('common.copyJson')}</span>
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
