import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import { selfHealingService } from '../../../services/selfHealingService';
import { translateIncidentTitle, translateActionMessageToVi } from '../Incidents/incidentUtils';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  ShieldCheck,
  FileText,
  RefreshCw,
  Server,
  Zap,
  Cpu
} from 'lucide-react';

export const ActionDetailModal = ({ actionId, initialItem, onClose }) => {
  const { t, i18n: i18nInstance } = useTranslation('dashHealing');
  const [detail, setDetail] = useState(initialItem || null);
  const [isLoading, setIsLoading] = useState(!initialItem);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      if (!actionId) return;
      setIsLoading(true);
      try {
        const data = await selfHealingService.getActionById(actionId);
        if (isMounted && data) {
          setDetail(data);
        }
      } catch (err) {
        console.warn('[ActionDetailModal] Lỗi nạp chi tiết:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [actionId]);

  const isSucceeded = detail?.execution_status === 'COMPLETED' || detail?.execution_status === 'SUCCEEDED';
  const isFailed = detail?.execution_status === 'FAILED';
  const isCancelled = detail?.execution_status === 'CANCELLED';
  const isWaitingApproval = !isSucceeded && !isFailed && !isCancelled && (
    detail?.approval_status === 'PENDING' ||
    detail?.execution_status === 'PENDING' ||
    (detail?.title || '').toLowerCase().includes('chờ phê duyệt') ||
    (detail?.title || '').toLowerCase().includes('awaiting hitl')
  );
  const isRunning = !isWaitingApproval && !isSucceeded && !isFailed && !isCancelled && (
    detail?.execution_status === 'RUNNING'
  );

  let statusBg = '#DCFCE7';
  let statusColor = '#15803D';
  let statusBorder = '#86EFAC';
  let statusLabel = t('actionDetail.status.succeeded');

  if (isWaitingApproval) {
    statusBg = '#FEF3C7';
    statusColor = '#B45309';
    statusBorder = '#FDE68A';
    statusLabel = t('actionDetail.status.pending');
  } else if (isFailed) {
    statusBg = '#FEE2E2';
    statusColor = '#B91C1C';
    statusBorder = '#FCA5A5';
    statusLabel = t('actionDetail.status.failed');
  } else if (isCancelled) {
    statusBg = '#F1F5F9';
    statusColor = '#475569';
    statusBorder = '#CBD5E1';
    statusLabel = t('actionDetail.status.cancelled');
  } else if (isRunning) {
    statusBg = '#E0F2FE';
    statusColor = '#0369A1';
    statusBorder = '#7DD3FC';
    statusLabel = t('actionDetail.status.running');
  }

  const cleanTargetName = (val) => {
    if (!val) return t('common.unknown');
    return String(val).replace(/^[A-Za-z0-9_-]+\//i, '').trim();
  };

  const formatProbeLabel = (val, isFail, isWaiting, isRun) => {
    if (val === 'K8S_POST_HEALING_PROBE') return t('actionDetail.probes.k8s');
    if (val === 'SLO_HEALTH_CHECK') return t('actionDetail.probes.slo');
    if (val) return val;
    if (isFail) return t('actionDetail.probes.failed');
    if (isWaiting) return t('actionDetail.probes.waiting');
    if (isRun) return t('actionDetail.probes.running');
    return t('actionDetail.probes.notTriggered');
  };

  const shortId = actionId ? `ACT-${actionId.slice(0, 8).toUpperCase()}` : 'ACT-UNKNOWN';
  const attempts = detail?.attempts || [];
  const verifications = detail?.verifications || (detail?.verification ? [detail.verification] : []);
  const resultObj = typeof detail?.result === 'object' && detail?.result !== null ? detail.result : {};

  let durationMs = 0;
  if (detail?.started_at && detail?.completed_at) {
    const s = new Date(detail.started_at).getTime();
    const e = new Date(detail.completed_at).getTime();
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      durationMs = e - s;
    }
  }
  if (!durationMs) {
    durationMs = resultObj?.duration_ms || (attempts[0]?.duration_ms) || (detail?.elapsed_seconds ? Math.round(detail.elapsed_seconds * 1000) : 0);
  }

  const detectedNamespace = resultObj?.details?.namespace ||
    detail?.namespace ||
    (detail?.result?.message?.match(/namespace "([^"]+)"/)?.[1]) ||
    (detail?.error_message?.match(/namespace "([^"]+)"/)?.[1]) ||
    'default';

  const translateRcaText = (str) => {
    if (!str) return '';
    let res = String(str);
    res = res.replace(/\bPROBABLE\b/g, t('actionDetail.rcaTerms.probable'));
    res = res.replace(/\bCONFIRMED\b/g, t('actionDetail.rcaTerms.confirmed'));
    res = res.replace(/\bSUSPECTED\b/g, t('actionDetail.rcaTerms.suspected'));
    res = res.replace(/\bCRITICAL\b/g, t('actionDetail.rcaTerms.critical'));
    res = res.replace(/\bHIGH\b/g, t('actionDetail.rcaTerms.high'));
    res = res.replace(/\bMEDIUM\b/g, t('actionDetail.rcaTerms.medium'));
    res = res.replace(/\bLOW\b/g, t('actionDetail.rcaTerms.low'));
    res = res.replace(/\bRESOLVED\b/g, t('actionDetail.rcaTerms.resolved'));
    res = res.replace(/\bVerification\b/g, t('actionDetail.rcaTerms.verificationCap'));
    res = res.replace(/\bverification\b/g, t('actionDetail.rcaTerms.verificationLow'));
    return res;
  };

  const formatActionMessageVi = (rawMsg) => {
    const actionLabel = detail?.action_type_name || t('actionDetail.summary.actionFallback');
    const targetClean = cleanTargetName(detail?.target_name);
    if (!rawMsg) {
      return t('actionDetail.summary.successFallback', { action: actionLabel, target: targetClean });
    }
    return translateActionMessageToVi(rawMsg, targetClean, actionLabel, detectedNamespace);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--dash-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <Zap size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9375rem', color: '#0F172A' }}>
                  {shortId}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: statusBg,
                    color: statusColor,
                    border: `1px solid ${statusBorder}`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                UUID: {actionId}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLoading && <RefreshCw size={16} className="animate-spin" color="#059669" />}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div
          className="dash-grid-4"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {t('actionDetail.highlights.duration')}
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: isFailed ? '#DC2626' : '#059669', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {durationMs > 0
                ? `${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`
                : (isRunning ? t('actionDetail.highlights.running') : (isWaitingApproval ? t('actionDetail.highlights.pending') : '-'))}
            </div>
          </div>

          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} /> {t('actionDetail.highlights.sloCheck')}
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: isFailed ? '#64748B' : '#0284C7', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {formatProbeLabel(verifications[0]?.verification_type, isFailed, isWaitingApproval, isRunning)}
            </div>
          </div>

          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} /> {t('actionDetail.highlights.target')}
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cleanTargetName(detail?.target_name || resultObj?.details?.target || detail?.target_id || t('common.unknown'))}
            </div>
          </div>

          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={12} /> {t('actionDetail.highlights.agent')}
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#4338CA', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {resultObj?.executed_by_agent || attempts[0]?.request_payload?.agent || detail?.agent_name || (detail?.cluster_name ? `${detail.cluster_name}-agent` : 'In-Cluster Agent')}
            </div>
          </div>
        </div>

        {/* Tab Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 16px', gap: '6px' }}>
          <div
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: '#059669',
              borderBottom: '2px solid #059669',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={14} />
            <span>{t('actionDetail.tabTitle')}</span>
          </div>
        </div>

        {/* Modal Content Body */}
        <div style={{ padding: '10px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Execution Summary Alert */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: isFailed ? '#FEF2F2' : (isWaitingApproval ? '#FFFBEB' : (isRunning ? '#EFF6FF' : '#F0FDF4')),
                  border: `1px solid ${isFailed ? '#FECACA' : (isWaitingApproval ? '#FDE68A' : (isRunning ? '#BFDBFE' : '#BBF7D0'))}`,
                  borderLeft: `4px solid ${isFailed ? '#EF4444' : (isWaitingApproval ? '#F59E0B' : (isRunning ? '#3B82F6' : '#10B981'))}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: isFailed ? '#991B1B' : (isWaitingApproval ? '#92400E' : (isRunning ? '#1E40AF' : '#166534')),
                    fontWeight: 700,
                    fontSize: '0.875rem',
                  }}
                >
                  {isFailed ? (
                    <AlertCircle size={16} />
                  ) : isWaitingApproval ? (
                    <Clock size={16} />
                  ) : isRunning ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>
                    {isWaitingApproval
                      ? t('actionDetail.summary.pendingTitle')
                      : isRunning
                      ? t('actionDetail.summary.runningTitle')
                      : isFailed
                      ? t('actionDetail.summary.failedTitle')
                      : t('actionDetail.summary.successTitle')}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '0.8125rem',
                    color: isFailed ? '#7F1D1D' : (isWaitingApproval ? '#78350F' : (isRunning ? '#1E3A8A' : '#14532D')),
                    lineHeight: 1.5,
                  }}
                >
                  {isSucceeded
                    ? (resultObj?.message && !resultObj.message.toLowerCase().includes('chờ phê duyệt') && !resultObj.message.toLowerCase().includes('awaiting hitl')
                        ? formatActionMessageVi(resultObj.message)
                        : t('actionDetail.summary.successFallback', {
                            action: detail?.action_type_name || t('actionDetail.summary.actionFallback'),
                            target: detail?.target_name || '',
                          }))
                    : formatActionMessageVi(resultObj?.message || detail?.title || t('actionDetail.summary.defaultTitle', { action: detail?.action_type_name || t('actionDetail.summary.actionFallback') }))}
                </div>
              </div>

              {/* Linked Incident Box */}
              <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} color="#059669" />
                    {t('actionDetail.incidentContext.title')}
                  </span>
                  {detail?.incident_severity && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: detail.incident_severity === 'CRITICAL' ? '#FEE2E2' : '#FEF3C7',
                        color: detail.incident_severity === 'CRITICAL' ? '#DC2626' : '#D97706',
                      }}
                    >
                      {t('actionDetail.incidentContext.severityBadge', {
                        level: detail.incident_severity === 'CRITICAL'
                          ? t('actionDetail.incidentContext.sevCritical')
                          : detail.incident_severity === 'HIGH'
                          ? t('actionDetail.incidentContext.sevHigh')
                          : detail.incident_severity === 'MEDIUM'
                          ? t('actionDetail.incidentContext.sevMedium')
                          : t('actionDetail.incidentContext.sevLow'),
                      })}
                    </span>
                  )}
                </div>

                <div className="dash-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('actionDetail.incidentContext.titleLabel')}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {translateIncidentTitle(detail?.incident_title) || t('actionDetail.incidentContext.unlinked')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('actionDetail.incidentContext.statusLabel')}</div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: detail?.incident_status === 'RESOLVED' ? '#059669' : (detail?.incident_status === 'INVESTIGATING' ? '#D97706' : '#DC2626'),
                      marginTop: '2px'
                    }}>
                      {detail?.incident_status === 'RESOLVED'
                        ? t('actionDetail.incidentContext.statusResolved')
                        : detail?.incident_status === 'INVESTIGATING'
                        ? t('actionDetail.incidentContext.statusInvestigating')
                        : (detail?.incident_status === 'OPEN'
                          ? t('actionDetail.incidentContext.statusOpen')
                          : (detail?.incident_status || (isSucceeded ? t('actionDetail.incidentContext.statusResolved') : t('actionDetail.incidentContext.statusOpen'))))}
                    </div>
                  </div>

                  {detail?.incident_description && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('actionDetail.incidentContext.rcaLabel')}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#334155', marginTop: '2px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        {translateRcaText(detail.incident_description)}
                      </div>
                    </div>
                  )}

                  {detail?.recommendation_reasoning && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('actionDetail.incidentContext.aiReasonLabel')}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#334155', marginTop: '2px', backgroundColor: '#F0FDF4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #DCFCE7' }}>
                        {translateRcaText(detail.recommendation_reasoning)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Specifications */}
              <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  {t('actionDetail.specs.title')}
                </div>
                <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>{t('actionDetail.specs.targetLabel')}</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {cleanTargetName(detail?.target_name || resultObj?.details?.target || t('common.unknown'))}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>{t('actionDetail.specs.namespaceLabel')}</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {detectedNamespace}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>{t('actionDetail.specs.clusterLabel')}</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {detail?.cluster_name || detail?.cluster_id || t('actionDetail.specs.unlinkedCluster')}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>{t('actionDetail.specs.actionTypeLabel')}</span>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>
                      {detail?.action_type_name || detail?.action_type_code || resultObj?.details?.action_type || t('incidentUtils.actions.DEFAULT')}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>{t('actionDetail.specs.policyLabel')}</span>
                    <div style={{ fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono)' }}>
                      {detail?.policy_name || resultObj?.policy_name || (detail?.execution_mode === 'AUTO' ? t('actionDetail.specs.policyAuto') : t('actionDetail.specs.policyAi'))}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>{t('actionDetail.specs.approvalLabel')}</span>
                    <div style={{ fontWeight: 700, color: isWaitingApproval ? '#D97706' : (detail?.approval_status === 'REJECTED' ? '#DC2626' : '#059669') }}>
                      {detail?.execution_mode === 'AUTO'
                        ? t('actionDetail.specs.approvalAuto')
                        : (detail?.approval_status === 'APPROVED'
                            ? t('actionDetail.specs.approvalApproved')
                            : (detail?.approval_status === 'REJECTED'
                                ? t('actionDetail.specs.approvalRejected')
                                : (isWaitingApproval ? t('actionDetail.specs.approvalPending') : (detail?.approval_status || t('common.unknown')))))}
                    </div>
                  </div>
                </div>
              </div>
        </div>

        {/* Modal Footer */}
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
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {t('actionDetail.footer.recordedAt')}{' '}
            <strong>
              {(() => {
                const rawTs = detail?.completed_at || detail?.created_at;
                if (!rawTs) return t('common.justNow');
                const d = new Date(rawTs);
                return isNaN(d.getTime()) ? String(rawTs) : d.toLocaleString(getIntlLocale(i18nInstance.language));
              })()}
            </strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('common.closeWindow')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionDetailModal;
