import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { alertService } from '../../../services/alertService';

export const OPERATOR_SYMBOLS = {
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUAL: '>=',
  LESS_THAN: '<',
  LESS_THAN_OR_EQUAL: '<=',
  EQUAL: '=',
  NOT_EQUAL: '!=',
};

export const getSeverityStyle = (severity) => {
  const s = String(severity || 'INFO').toUpperCase();
  if (s === 'CRITICAL') {
    return {
      bg: '#FEF2F2',
      text: '#DC2626',
      border: '#FECACA',
      label: 'CRITICAL',
      icon: ShieldAlert,
    };
  }
  if (s === 'WARNING') {
    return {
      bg: '#FFFBEB',
      text: '#D97706',
      border: '#FDE68A',
      label: 'WARNING',
      icon: AlertTriangle,
    };
  }
  return {
    bg: '#EFF6FF',
    text: '#2563EB',
    border: '#BFDBFE',
    label: 'INFO',
    icon: Info,
  };
};

export const getStatusStyle = (status) => {
  const st = String(status || 'ACTIVE').toUpperCase();
  if (st === 'ACTIVE') {
    return {
      bg: '#FEF2F2',
      text: '#DC2626',
      border: '#FECACA',
      dot: '#EF4444',
      label: 'ACTIVE',
    };
  }
  if (st === 'ACKNOWLEDGED') {
    return {
      bg: '#FFFBEB',
      text: '#D97706',
      border: '#FDE68A',
      dot: '#F59E0B',
      label: 'ACKNOWLEDGED',
    };
  }
  return {
    bg: '#ECFDF5',
    text: '#059669',
    border: '#A7F3D0',
    dot: '#10B981',
    label: 'RESOLVED',
  };
};

export const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const AlertDetailDrawer = ({
  alertItem,
  isOpen,
  onClose,
  canManageAlerts = false,
  currentOrgName = '',
  onAlertUpdated,
}) => {
  const [detailData, setDetailData] = useState(alertItem || null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [ackNote, setAckNote] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    setDetailData(alertItem || null);
    setActionError(null);
    setActionSuccess(null);
    setAckNote('');
    setResolveNote('');

    if (isOpen && alertItem?.id) {
      let mounted = true;
      setIsLoadingDetail(true);
      setDetailError(null);
      alertService
        .getAlertById(alertItem.id)
        .then((fresh) => {
          if (mounted && fresh) {
            setDetailData(fresh);
          }
        })
        .catch((err) => {
          if (mounted) {
            setDetailError(err.message || 'Không thể tải chi tiết sự kiện cảnh báo');
          }
        })
        .finally(() => {
          if (mounted) setIsLoadingDetail(false);
        });
      return () => {
        mounted = false;
      };
    }
  }, [isOpen, alertItem?.id]);

  if (!isOpen || !detailData) return null;

  const sevStyle = getSeverityStyle(detailData.severity);
  const stStyle = getStatusStyle(detailData.status);
  const SevIcon = sevStyle.icon;

  const operatorCode =
    detailData.rule_operator || detailData.details?.operator || 'GREATER_THAN';
  const opSymbol = OPERATOR_SYMBOLS[operatorCode] || operatorCode;
  const unitStr = detailData.unit ? ` ${detailData.unit}` : '';
  const namespaceVal =
    detailData.details?.namespace ||
    detailData.namespace ||
    null;

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    if (!canManageAlerts || detailData.status !== 'ACTIVE') return;
    setIsSubmittingAck(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await alertService.acknowledgeAlert(
        detailData.id,
        ackNote || 'Đã tiếp nhận và kiểm tra cảnh báo trên Dashboard'
      );
      const merged = { ...detailData, ...updated, status: 'ACKNOWLEDGED' };
      setDetailData(merged);
      setActionSuccess('Đã xác nhận (ACKNOWLEDGED) sự kiện cảnh báo thành công.');
      if (onAlertUpdated) onAlertUpdated(merged);
    } catch (err) {
      setActionError(err.message || 'Lỗi khi xác nhận sự kiện cảnh báo');
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!canManageAlerts || detailData.status === 'RESOLVED') return;
    setIsSubmittingResolve(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await alertService.resolveAlert(
        detailData.id,
        resolveNote || 'Đã xử lý và giải quyết thủ công từ Dashboard'
      );
      const merged = { ...detailData, ...updated, status: 'RESOLVED' };
      setDetailData(merged);
      setActionSuccess('Đã chuyển trạng thái cảnh báo sang RESOLVED thành công.');
      if (onAlertUpdated) onAlertUpdated(merged);
    } catch (err) {
      setActionError(err.message || 'Lỗi khi giải quyết sự kiện cảnh báo');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  return (
    <div
      data-testid="alert-detail-drawer-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 110,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        data-testid="alert-detail-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span
                data-testid="detail-severity-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: sevStyle.bg,
                  color: sevStyle.text,
                  border: `1px solid ${sevStyle.border}`,
                }}
              >
                <SevIcon size={13} />
                {sevStyle.label}
              </span>

              <span
                data-testid="detail-status-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: stStyle.bg,
                  color: stStyle.text,
                  border: `1px solid ${stStyle.border}`,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: stStyle.dot,
                  }}
                />
                {stStyle.label}
              </span>

              {detailData.category && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {detailData.category}
                </span>
              )}
            </div>

            <h2
              data-testid="detail-alert-name"
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: '0 0 4px 0',
                wordBreak: 'break-word',
              }}
            >
              {detailData.rule_name || 'Cảnh báo hệ thống'}
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'monospace' }}>
              Alert ID: <span data-testid="detail-alert-id">{detailData.id}</span>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-close-detail-drawer"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              color: 'var(--dash-text-secondary)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isLoadingDetail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
              <RefreshCw size={14} className="animate-spin" />
              <span>Đang đồng bộ chi tiết cảnh báo mới nhất từ máy chủ...</span>
            </div>
          )}

          {detailError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{detailError}</span>
            </div>
          )}

          {actionError && (
            <div
              data-testid="detail-action-error"
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div
              data-testid="detail-action-success"
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Description & Message */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--dash-border)',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Mô tả & Thông điệp Phát hiện
            </div>
            <div
              data-testid="detail-alert-message"
              style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-primary)', lineHeight: 1.5 }}
            >
              {detailData.message || 'Không có thông điệp chi tiết'}
            </div>
            {detailData.rule_description && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '6px' }}>
                Quy tắc: {detailData.rule_description}
              </div>
            )}
          </div>

          {/* Metric vs Threshold Highlight */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                Giá trị Quan sát
              </div>
              <div
                data-testid="detail-metric-value"
                style={{ fontSize: '1.25rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}
              >
                {detailData.observed_value !== null && detailData.observed_value !== undefined
                  ? `${detailData.observed_value}${unitStr}`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#7F1D1D', marginTop: '2px' }}>
                Metric: {detailData.metric_type}
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                border: '1px solid var(--dash-border)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                Ngưỡng Cấu hình
              </div>
              <div
                data-testid="detail-threshold-value"
                style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}
              >
                {detailData.threshold_value !== null && detailData.threshold_value !== undefined
                  ? `${opSymbol} ${detailData.threshold_value}${unitStr}`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                Operator: {operatorCode}
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                Số lần Lặp lại (Dedup)
              </div>
              <div
                data-testid="detail-occurrence-count"
                style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1D4ED8', marginTop: '4px' }}
              >
                {detailData.occurrence_count || 1} lần
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#1E3A8A', marginTop: '2px' }}>
                Chống trùng lặp tự động
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              border: '1px solid var(--dash-border)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid var(--dash-border)',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                textTransform: 'uppercase',
              }}
            >
              Thông tin Nguồn & Phạm vi Tài nguyên
            </div>

            <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.8125rem' }}>
              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Tổ chức (Organization)</div>
                <div data-testid="detail-organization" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.organization_name || currentOrgName || detailData.organization_id || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Cụm K8s (Cluster)</div>
                <div data-testid="detail-cluster" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.cluster_name || detailData.cluster_id || 'Toàn tổ chức (Org-Wide)'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Loại tài nguyên (Resource Type)</div>
                <div data-testid="detail-resource-type" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', textTransform: 'uppercase' }}>
                  {detailData.resource_type || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Tên tài nguyên (Resource Name)</div>
                <div data-testid="detail-resource-name" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {detailData.resource_id || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Namespace</div>
                <div data-testid="detail-namespace" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {namespaceVal || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Quy tắc (Alert Rule)</div>
                <div data-testid="detail-rule" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.rule_name || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Phát hiện lần đầu (First Seen)</div>
                <div data-testid="detail-first-seen" style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {formatDateTime(detailData.first_detected_at)}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Ghi nhận gần nhất (Last Seen)</div>
                <div data-testid="detail-last-seen" style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {formatDateTime(detailData.last_seen_at)}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Thời điểm giải quyết (Resolved At)</div>
                <div data-testid="detail-resolved-at" style={{ fontWeight: 600, color: detailData.resolved_at ? '#059669' : 'var(--dash-text-muted)', marginTop: '2px' }}>
                  {detailData.resolved_at ? formatDateTime(detailData.resolved_at) : 'Chưa giải quyết'}
                </div>
              </div>

              {detailData.fingerprint && (
                <div>
                  <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>Mã định danh (Fingerprint)</div>
                  <div style={{ fontWeight: 600, color: 'var(--dash-text-secondary)', marginTop: '2px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {detailData.fingerprint.slice(0, 16)}...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event Lifecycle & History */}
          <div
            style={{
              border: '1px solid var(--dash-border)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid var(--dash-border)',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                textTransform: 'uppercase',
              }}
            >
              Lịch sử Vòng đời Sự kiện (Event Lifecycle History)
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Clock size={15} color="#DC2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    Khởi phát cảnh báo (ACTIVE)
                  </div>
                  <div style={{ color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                    {formatDateTime(detailData.first_detected_at)} — Đã ghi nhận {detailData.occurrence_count || 1} chu kỳ vi phạm
                  </div>
                </div>
              </div>

              {detailData.acknowledged_at && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Check size={15} color="#D97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#B45309' }}>
                      Đã tiếp nhận xử lý (ACKNOWLEDGED)
                    </div>
                    <div style={{ color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {formatDateTime(detailData.acknowledged_at)}
                      {detailData.acknowledger_name ? ` bởi ${detailData.acknowledger_name}` : ''}
                    </div>
                    {detailData.details?.acknowledge_note && (
                      <div style={{ marginTop: '4px', padding: '6px 10px', backgroundColor: '#FFFBEB', borderRadius: '6px', color: '#92400E', fontSize: '0.75rem' }}>
                        Ghi chú: {detailData.details.acknowledge_note}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailData.resolved_at && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={15} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#065F46' }}>
                      Đã giải quyết (RESOLVED)
                    </div>
                    <div style={{ color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {formatDateTime(detailData.resolved_at)}
                      {detailData.details?.resolved_by ? ` (${detailData.details.resolved_by})` : ''}
                    </div>
                    {(detailData.details?.resolution_note || detailData.details?.message) && (
                      <div style={{ marginTop: '4px', padding: '6px 10px', backgroundColor: '#ECFDF5', borderRadius: '6px', color: '#065F46', fontSize: '0.75rem' }}>
                        {detailData.details?.resolution_note || detailData.details?.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Operations Section: Acknowledge & Resolve (Only shown if user has permission and status allows) */}
          {canManageAlerts && detailData.status !== 'RESOLVED' && (
            <div
              data-testid="detail-operations-panel"
              style={{
                border: '1px solid var(--dash-border)',
                borderRadius: '10px',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase' }}>
                Thao tác Vận hành Cảnh báo
              </div>

              {detailData.status === 'ACTIVE' && (
                <form onSubmit={handleAcknowledge} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                    Ghi chú xác nhận (Acknowledge Note):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      data-testid="input-acknowledge-note"
                      value={ackNote}
                      onChange={(e) => setAckNote(e.target.value)}
                      placeholder="Nhập ghi chú tiếp nhận xử lý..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--dash-border)',
                        fontSize: '0.8125rem',
                      }}
                    />
                    <button
                      type="submit"
                      data-testid="btn-acknowledge-alert"
                      disabled={isSubmittingAck}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #D97706',
                        backgroundColor: '#F59E0B',
                        color: '#FFFFFF',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: isSubmittingAck ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isSubmittingAck ? 'Đang xử lý...' : 'Xác nhận (Acknowledge)'}
                    </button>
                  </div>
                </form>
              )}

              <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                  Ghi chú giải quyết sự cố (Resolution Note):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    data-testid="input-resolve-note"
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    placeholder="Nhập nguyên nhân hoặc cách khắc phục..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      fontSize: '0.8125rem',
                    }}
                  />
                  <button
                    type="submit"
                    data-testid="btn-resolve-alert"
                    disabled={isSubmittingResolve}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #059669',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: isSubmittingResolve ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSubmittingResolve ? 'Đang xử lý...' : 'Giải quyết (Resolve)'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertDetailDrawer;
