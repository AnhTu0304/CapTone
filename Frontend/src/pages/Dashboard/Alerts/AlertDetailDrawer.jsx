import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { alertService, formatAlertApiError } from '../../../services/alertService';
import i18n, { getIntlLocale } from '../../../i18n';

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
  return d.toLocaleString(getIntlLocale(i18n.language), {
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
  currentOrgId = '',
  currentOrgName = '',
  onAlertUpdated,
}) => {
  const { t } = useTranslation('dashHealing');
  const [detailData, setDetailData] = useState(alertItem || null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [timeline, setTimeline] = useState([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState(null);

  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [pendingReassignConfirm, setPendingReassignConfirm] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  const [ackNote, setAckNote] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchAuditTrail = useCallback(async (alertId) => {
    if (!alertId) return;
    setIsLoadingTimeline(true);
    setTimelineError(null);
    try {
      if (typeof alertService.getAlertAuditTrail === 'function') {
        const res = await alertService.getAlertAuditTrail(alertId, {
          page: 1,
          limit: 50,
          order: 'asc',
        });
        setTimeline(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
      } else if (typeof alertService.getAlertTimeline === 'function') {
        const tl = await alertService.getAlertTimeline(alertId);
        setTimeline(Array.isArray(tl) ? tl : []);
      } else {
        setTimeline([]);
      }
    } catch (err) {
      setTimelineError(formatAlertApiError(err, i18n.t('dashHealing:alertDetail.messages.loadTimelineError')));
    } finally {
      setIsLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    setDetailData(alertItem || null);
    setActionError(null);
    setActionSuccess(null);
    setAckNote('');
    setResolveNote('');
    setAssignNote('');
    setMemberSearch('');
    setPendingReassignConfirm(false);
    setSelectedAssigneeId(alertItem?.assigned_to || '');

    if (isOpen && alertItem?.id) {
      let mounted = true;
      setIsLoadingDetail(true);
      setDetailError(null);

      alertService
        .getAlertById(alertItem.id)
        .then((fresh) => {
          if (mounted && fresh) {
            setDetailData(fresh);
            setSelectedAssigneeId(fresh.assigned_to || '');
          }
        })
        .catch((err) => {
          if (mounted) {
            setDetailError(formatAlertApiError(err, i18n.t('dashHealing:alertDetail.messages.loadDetailError')));
          }
        })
        .finally(() => {
          if (mounted) setIsLoadingDetail(false);
        });

      fetchAuditTrail(alertItem.id);

      if (canManageAlerts && currentOrgId && typeof alertService.getAssignableMembers === 'function') {
        setIsLoadingMembers(true);
        Promise.resolve(alertService.getAssignableMembers(currentOrgId))
          .then((list) => {
            if (mounted && Array.isArray(list)) setMembers(list);
          })
          .catch(() => {
            if (mounted) setMembers([]);
          })
          .finally(() => {
            if (mounted) setIsLoadingMembers(false);
          });
      }

      return () => {
        mounted = false;
      };
    }
    return undefined;
  }, [isOpen, alertItem?.id, canManageAlerts, currentOrgId, fetchAuditTrail]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  if (!isOpen || !detailData) return null;

  const sevStyle = getSeverityStyle(detailData.severity);
  const stStyle = getStatusStyle(detailData.status);
  const SevIcon = sevStyle.icon;

  const operatorCode = detailData.rule_operator || detailData.details?.operator || 'GREATER_THAN';
  const opSymbol = OPERATOR_SYMBOLS[operatorCode] || operatorCode;
  const unitStr = detailData.unit ? ` ${detailData.unit}` : '';
  const namespaceVal = detailData.details?.namespace || detailData.namespace || null;
  const resolutionNoteVal =
    detailData.resolution_note || detailData.details?.resolution_note || null;

  const executeAssign = async () => {
    if (!canManageAlerts || !selectedAssigneeId || isSubmittingAssign) return;
    setIsSubmittingAssign(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await alertService.assignAlert(detailData.id, {
        assignedTo: selectedAssigneeId,
        note: assignNote,
        ...(detailData.version !== undefined ? { expectedVersion: detailData.version } : {}),
      });
      const merged = { ...detailData, ...updated };
      setDetailData(merged);
      setSelectedAssigneeId(merged.assigned_to || selectedAssigneeId);
      setPendingReassignConfirm(false);
      setAssignNote('');
      setActionSuccess(t('alertDetail.messages.assignSuccess'));
      fetchAuditTrail(detailData.id);
      if (onAlertUpdated) onAlertUpdated(merged);
    } catch (err) {
      setActionError(formatAlertApiError(err, t('alertDetail.messages.assignError')));
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!canManageAlerts || !selectedAssigneeId || isSubmittingAssign) return;
    if (detailData.assigned_to && detailData.assigned_to !== selectedAssigneeId && !pendingReassignConfirm) {
      setPendingReassignConfirm(true);
      return;
    }
    executeAssign();
  };

  const handleUnassign = async () => {
    if (!canManageAlerts || !detailData.assigned_to || isSubmittingAssign) return;
    setIsSubmittingAssign(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await alertService.unassignAlert(detailData.id, {
        ...(detailData.version !== undefined ? { expectedVersion: detailData.version } : {}),
      });
      const merged = { ...detailData, ...updated, assigned_to: null, assignee_name: null };
      setDetailData(merged);
      setSelectedAssigneeId('');
      setPendingReassignConfirm(false);
      setActionSuccess(t('alertDetail.messages.unassignSuccess'));
      fetchAuditTrail(detailData.id);
      if (onAlertUpdated) onAlertUpdated(merged);
    } catch (err) {
      setActionError(formatAlertApiError(err, t('alertDetail.messages.unassignError')));
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    if (!canManageAlerts || detailData.status !== 'ACTIVE' || isSubmittingAck) return;
    setIsSubmittingAck(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const notePayload = ackNote || t('alertDetail.messages.ackDefaultNote');
      const updated =
        detailData.version !== undefined
          ? await alertService.acknowledgeAlert(detailData.id, notePayload, detailData.version)
          : await alertService.acknowledgeAlert(detailData.id, notePayload);
      const merged = { ...detailData, ...updated, status: 'ACKNOWLEDGED' };
      setDetailData(merged);
      setActionSuccess(t('alertDetail.messages.ackSuccess'));
      fetchAuditTrail(detailData.id);
      if (onAlertUpdated) onAlertUpdated(merged);
    } catch (err) {
      setActionError(formatAlertApiError(err, t('alertDetail.messages.ackError')));
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!canManageAlerts || detailData.status === 'RESOLVED' || isSubmittingResolve) return;
    if (resolveNote && resolveNote.length > 2000) {
      setActionError(t('alertDetail.messages.resolveNoteTooLong'));
      return;
    }
    setIsSubmittingResolve(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const notePayload = resolveNote || t('alertDetail.messages.resolveDefaultNote');
      const updated =
        detailData.version !== undefined
          ? await alertService.resolveAlert(detailData.id, notePayload, detailData.version)
          : await alertService.resolveAlert(detailData.id, notePayload);
      const merged = { ...detailData, ...updated, status: 'RESOLVED' };
      setDetailData(merged);
      setActionSuccess(t('alertDetail.messages.resolveSuccess'));
      fetchAuditTrail(detailData.id);
      if (onAlertUpdated) onAlertUpdated(merged);
    } catch (err) {
      setActionError(formatAlertApiError(err, t('alertDetail.messages.resolveError')));
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
          maxWidth: '640px',
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
              {detailData.rule_name || detailData.title || t('alertDetail.header.defaultName')}
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'monospace' }}>
              {t('alertDetail.header.alertId')} <span data-testid="detail-alert-id">{detailData.id}</span>
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
            <div
              data-testid="detail-loading-state"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}
            >
              <RefreshCw size={14} className="animate-spin" />
              <span>{t('alertDetail.states.loading')}</span>
            </div>
          )}

          {detailError && (
            <div
              data-testid="detail-error-state"
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
              {t('alertDetail.summary.title')}
            </div>
            <div
              data-testid="detail-alert-message"
              style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-primary)', lineHeight: 1.5 }}
            >
              {detailData.message || t('alertDetail.summary.noMessage')}
            </div>
            {detailData.rule_description && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '6px' }}>
                {t('alertDetail.summary.rulePrefix')} {detailData.rule_description}
              </div>
            )}
          </div>

          {/* Metric vs Threshold Highlight */}
          <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                {t('alertDetail.metrics.observedTitle')}
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
                {t('alertDetail.metrics.metricPrefix')} {detailData.metric_type || '—'}
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
                {t('alertDetail.metrics.thresholdTitle')}
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
                {t('alertDetail.metrics.operatorPrefix')} {operatorCode}
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
                {t('alertDetail.metrics.dedupTitle')}
              </div>
              <div
                data-testid="detail-occurrence-count"
                style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1D4ED8', marginTop: '4px' }}
              >
                {t('common.times', { count: detailData.occurrence_count || 1 })}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#1E3A8A', marginTop: '2px' }}>
                {t('alertDetail.metrics.dedupSub')}
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
              {t('alertDetail.metadata.sectionTitle')}
            </div>

            <div className="dash-grid-2" style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.8125rem' }}>
              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.organization')}</div>
                <div data-testid="detail-organization" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.organization_name || currentOrgName || detailData.organization_id || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.cluster')}</div>
                <div data-testid="detail-cluster" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.cluster_name || detailData.cluster_id || t('alertDetail.metadata.orgWide')}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.resourceType')}</div>
                <div data-testid="detail-resource-type" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', textTransform: 'uppercase' }}>
                  {detailData.resource_type || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.resourceName')}</div>
                <div data-testid="detail-resource-name" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {detailData.resource_id || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.namespace')}</div>
                <div data-testid="detail-namespace" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {namespaceVal || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.rule')}</div>
                <div data-testid="detail-rule" style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.rule_name || '—'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.firstSeen')}</div>
                <div data-testid="detail-first-seen" style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {formatDateTime(detailData.first_detected_at)}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.lastSeen')}</div>
                <div data-testid="detail-last-seen" style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {formatDateTime(detailData.last_seen_at)}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.assignedTo')}</div>
                <div data-testid="detail-assigned-to" style={{ fontWeight: 700, color: detailData.assigned_to ? '#1D4ED8' : 'var(--dash-text-muted)', marginTop: '2px' }}>
                  {detailData.assignee_name || detailData.assignee_email || (detailData.assigned_to ? detailData.assigned_to : t('alertDetail.metadata.unassigned'))}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.acknowledgedBy')}</div>
                <div data-testid="detail-acknowledged-by" style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.acknowledger_name || detailData.acknowledger_email || '—'}
                </div>
                {detailData.acknowledged_at && (
                  <div data-testid="detail-acknowledged-at" style={{ fontSize: '0.7rem', color: 'var(--dash-text-muted)' }}>
                    {formatDateTime(detailData.acknowledged_at)}
                  </div>
                )}
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.resolvedBy')}</div>
                <div data-testid="detail-resolved-by" style={{ fontWeight: 600, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                  {detailData.resolver_name || detailData.resolver_email || (detailData.resolved_at ? t('alertDetail.metadata.systemResolver') : '—')}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.resolvedAt')}</div>
                <div data-testid="detail-resolved-at" style={{ fontWeight: 600, color: detailData.resolved_at ? '#059669' : 'var(--dash-text-muted)', marginTop: '2px' }}>
                  {detailData.resolved_at ? formatDateTime(detailData.resolved_at) : t('alertDetail.metadata.unresolved')}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>{t('alertDetail.metadata.resolutionNote')}</div>
                <div
                  data-testid="detail-resolution-note"
                  style={{
                    fontWeight: 600,
                    color: resolutionNoteVal ? '#065F46' : 'var(--dash-text-muted)',
                    marginTop: '4px',
                    padding: resolutionNoteVal ? '8px 10px' : 0,
                    backgroundColor: resolutionNoteVal ? '#ECFDF5' : 'transparent',
                    borderRadius: '6px',
                  }}
                >
                  {resolutionNoteVal || t('alertDetail.metadata.noResolutionNote')}
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Panel (RBAC-gated) */}
          {canManageAlerts && (
            <div
              data-testid="detail-assignment-panel"
              style={{
                border: '1px solid var(--dash-border)',
                borderRadius: '10px',
                padding: '14px 16px',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase' }}>
                  {t('alertDetail.assignment.title')}
                </span>
                {detailData.assigned_to && (
                  <button
                    type="button"
                    data-testid="btn-unassign-alert"
                    disabled={isSubmittingAssign}
                    onClick={handleUnassign}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isSubmittingAssign ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <UserMinus size={13} />
                    <span>{t('alertDetail.assignment.unassignBtn')}</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    data-testid="assign-member-search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={t('alertDetail.assignment.searchPlaceholder')}
                    style={{
                      flex: '1 1 180px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      fontSize: '0.8125rem',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                  <select
                    data-testid="assign-member-select"
                    value={selectedAssigneeId}
                    disabled={isLoadingMembers || isSubmittingAssign}
                    onChange={(e) => {
                      setSelectedAssigneeId(e.target.value);
                      setPendingReassignConfirm(false);
                    }}
                    style={{
                      flex: '1 1 220px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--dash-border)',
                      fontSize: '0.8125rem',
                      backgroundColor: '#FFFFFF',
                      fontWeight: 600,
                    }}
                  >
                    <option value="">{t('alertDetail.assignment.selectDefault')}</option>
                    {filteredMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.email ? `(${m.email})` : ''} {m.role ? `[${m.role}]` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    data-testid="btn-submit-assign"
                    disabled={!selectedAssigneeId || isSubmittingAssign}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #2563EB',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: !selectedAssigneeId || isSubmittingAssign ? 'not-allowed' : 'pointer',
                      opacity: !selectedAssigneeId || isSubmittingAssign ? 0.6 : 1,
                    }}
                  >
                    <UserPlus size={14} />
                    <span>
                      {isSubmittingAssign
                        ? t('alertDetail.assignment.saving')
                        : detailData.assigned_to && detailData.assigned_to !== selectedAssigneeId
                        ? t('alertDetail.assignment.reassignBtn')
                        : t('alertDetail.assignment.assignBtn')}
                    </span>
                  </button>
                </div>

                {pendingReassignConfirm && (
                  <div
                    data-testid="reassign-confirm-box"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      fontSize: '0.8125rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      {t('alertDetail.assignment.confirmTextPrefix')}{' '}
                      <strong>{detailData.assignee_name || t('alertDetail.assignment.otherMember')}</strong>. {t('alertDetail.assignment.confirmTextSuffix')}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        data-testid="btn-cancel-reassign"
                        onClick={() => setPendingReassignConfirm(false)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        data-testid="btn-confirm-reassign"
                        disabled={isSubmittingAssign}
                        onClick={executeAssign}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#D97706',
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {t('alertDetail.assignment.confirmReassignBtn')}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Event Audit Trail & Timeline [S5][PBI22 Task 4.3 & 4.4] */}
          <div
            data-testid="detail-timeline-section"
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{t('alertDetail.timeline.title')}</span>
              {detailData.duration_formatted && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, textTransform: 'none' }}>
                  {t('alertDetail.timeline.duration', { duration: detailData.duration_formatted })}
                </span>
              )}
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.8125rem' }}>
              {isLoadingTimeline ? (
                <div
                  data-testid="timeline-loading-state"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dash-text-secondary)' }}
                >
                  <RefreshCw size={14} className="animate-spin" />
                  <span>{t('alertDetail.timeline.loading')}</span>
                </div>
              ) : timelineError ? (
                <div
                  data-testid="timeline-error-state"
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <span>{timelineError}</span>
                  <button
                    type="button"
                    data-testid="timeline-btn-retry"
                    onClick={() => fetchAuditTrail(detailData.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.retry')}
                  </button>
                </div>
              ) : timeline.length === 0 ? (
                <div
                  data-testid="timeline-empty-state"
                  style={{ color: 'var(--dash-text-muted)', textAlign: 'center', padding: '16px 0' }}
                >
                  {t('alertDetail.timeline.empty')}
                </div>
              ) : (
                timeline.map((entry, idx) => {
                  const isActionResolved = entry.action === 'RESOLVED' || entry.action === 'AUTO_RESOLVED';
                  const isActionAck = entry.action === 'ACKNOWLEDGED';
                  const isActionEsc = entry.action === 'ESCALATED' || entry.action === 'REOPENED';
                  const isActionAssign =
                    entry.action === 'ASSIGNED' || entry.action === 'REASSIGNED' || entry.action === 'UNASSIGNED';
                  const actionColor = isActionResolved
                    ? '#059669'
                    : isActionAck
                    ? '#D97706'
                    : isActionEsc
                    ? '#DC2626'
                    : '#2563EB';
                  const ActionIcon = isActionResolved
                    ? CheckCircle2
                    : isActionAck
                    ? Check
                    : isActionEsc
                    ? AlertTriangle
                    : isActionAssign
                    ? UserPlus
                    : Clock;

                  const prevAssignee = entry.old_value?.assignee_name;
                  const nextAssignee = entry.new_value?.assignee_name;

                  return (
                    <div
                      key={entry.id || idx}
                      data-testid="timeline-item"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        paddingBottom: idx < timeline.length - 1 ? '12px' : 0,
                        borderBottom: idx < timeline.length - 1 ? '1px dashed var(--dash-border)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: `${actionColor}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        <ActionIcon size={15} color={actionColor} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: actionColor }}>
                            {entry.action}
                            {entry.new_status ? ` (${entry.new_status})` : ''}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                            {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                          {t('alertDetail.timeline.actorPrefix')} <strong>{entry.actor_name || entry.actor_type || 'SYSTEM'}</strong>
                          {entry.old_status && entry.old_status !== entry.new_status
                            ? ` ${t('alertDetail.timeline.statusTransition', { old: entry.old_status, new: entry.new_status })}`
                            : ''}
                          {isActionAssign && (prevAssignee || nextAssignee)
                            ? ` ${t('alertDetail.timeline.assigneeTransition', {
                                old: prevAssignee || t('alertDetail.metadata.unassigned'),
                                new: nextAssignee || t('alertDetail.metadata.unassigned'),
                              })}`
                            : ''}
                        </div>
                        {entry.note && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '6px 10px',
                              backgroundColor: isActionResolved ? '#ECFDF5' : isActionAck ? '#FFFBEB' : '#F8FAFC',
                              borderRadius: '6px',
                              color: isActionResolved ? '#065F46' : isActionAck ? '#92400E' : 'var(--dash-text-primary)',
                              fontSize: '0.75rem',
                              lineHeight: 1.4,
                            }}
                          >
                            {entry.note}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Operations Section: Acknowledge & Resolve (Only shown if user has permission and status != RESOLVED) */}
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
                {t('alertDetail.operations.title')}
              </div>

              {detailData.status === 'ACTIVE' && (
                <form onSubmit={handleAcknowledge} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                    {t('alertDetail.operations.ackNoteLabel')}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      data-testid="input-acknowledge-note"
                      value={ackNote}
                      onChange={(e) => setAckNote(e.target.value)}
                      placeholder={t('alertDetail.operations.ackPlaceholder')}
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
                      {isSubmittingAck ? t('alertDetail.operations.processing') : t('alertDetail.operations.ackBtn')}
                    </button>
                  </div>
                </form>
              )}

              <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>
                  {t('alertDetail.operations.resolveNoteLabel')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    data-testid="input-resolve-note"
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    placeholder={t('alertDetail.operations.resolvePlaceholder')}
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
                    {isSubmittingResolve ? t('alertDetail.operations.processing') : t('alertDetail.operations.resolveBtn')}
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
