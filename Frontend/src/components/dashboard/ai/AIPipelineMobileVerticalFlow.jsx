import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import {
  getBranchedActions,
  getBranchedContextAgents,
  getBranchedRootCauses,
  getPolicyBranchMeta,
  normalizeActionCodeForBranch,
  normalizeCauseCodeFromText,
} from './BranchedPipelineCatalog';

const VerticalConnector = ({ active = false, color = '#94A3B8', label = '' }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 0',
      gap: '2px',
    }}
  >
    <div
      style={{
        width: '2px',
        height: '12px',
        borderLeft: `2px ${active ? 'solid' : 'dashed'} ${color}`,
      }}
    />
    {label ? (
      <span
        style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          color,
          backgroundColor: '#FFFFFF',
          border: `1px solid ${color}40`,
          borderRadius: '999px',
          padding: '1px 8px',
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    ) : null}
    <ArrowDown size={14} color={color} />
  </div>
);

const StageCard = ({ id, badge, badgeBg, badgeColor, borderColor, children, statusBadge = null }) => (
  <section
    id={id}
    style={{
      backgroundColor: '#FFFFFF',
      border: `1.5px solid ${borderColor}`,
      borderRadius: '14px',
      padding: '12px',
      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      scrollMarginTop: '64px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 9px',
          borderRadius: '999px',
          backgroundColor: badgeBg,
          color: badgeColor,
          fontSize: '0.6875rem',
          fontWeight: 800,
          letterSpacing: '0.03em',
        }}
      >
        {badge}
      </span>
      {statusBadge}
    </div>
    {children}
  </section>
);

const ActionLinkButton = ({ label, path, color = '#0F172A', onNavigate }) => {
  if (!onNavigate || !path) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        padding: '6px 10px',
        borderRadius: '8px',
        border: `1px solid ${color}33`,
        backgroundColor: `${color}10`,
        color,
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <ExternalLink size={12} />
    </button>
  );
};

/**
 * AIPipelineMobileVerticalFlow
 * Bố cục dọc tối ưu cho điện thoại (<= 860px hoặc chế độ mô phỏng Mobile)
 * thay thế sơ đồ pan-and-zoom ngang siêu rộng bằng các khối tuần tự 01→07 / 00→07 dễ chạm và cuộn tự nhiên.
 */
export const AIPipelineMobileVerticalFlow = ({
  showExtendedPipeline = true,
  activeDiagram = 'diagram1',
  onSwitchDiagram,
  onSwitchToHorizontal,
  selectedService = '',
  podCount = 1,
  isAgentConnected = true,
  metricConfigs = [],
  liveMetrics = {},
  effectiveTimesteps = [],
  chartMaxY = 100,
  activeSweepIdx = 0,
  currentStepLabel = 'T1',
  prediction = null,
  rawRiskScore = 0,
  isPredictionHealthy = true,
  isRiskDetected = false,
  isBenignDbCacheState = false,
  isScaleDownOptimization = false,
  allRiskEvaluations = [],
  triggeredRisksList = [],
  topRiskEval = null,
  ruleEngineChecks = [],
  triggeredRuleCount = 0,
  isRuleEngineTriggered = false,
  latestIncident = null,
  lastResolvedIncident = null,
  openServiceIncidentsCount = 0,
  latestRecommendation = null,
  latestAutoAction = null,
  latestHitlApproval = null,
  pendingApprovalsCount = 0,
  isCircuitBreakerTripped = false,
  actionTimeline = [],
  recoveryStats = {},
  pipelineContext = null,
  isRcaActive = false,
  isAutoActionActive = false,
  isAutoActionInProgress = false,
  isHitlActive = false,
  isAuditActive = false,
  isVerifyingInProgress = false,
  hasUnrecoveredStep = false,
  simulatedCauseCode = null,
  onSelectSimulatedCause,
  onClearSimulation,
  verifyOutcomeMode = 'auto',
  onChangeVerifyOutcome,
  onNavigate = null,
}) => {
  const { t } = useTranslation('dashboard');
  const [showTelemetryAll, setShowTelemetryAll] = useState(false);
  const [showRuleAll, setShowRuleAll] = useState(false);
  const [showRisksAll, setShowRisksAll] = useState(false);
  const [showCausesAll, setShowCausesAll] = useState(false);
  const [showActionsAll, setShowActionsAll] = useState(false);

  const isDiagram2 = showExtendedPipeline && activeDiagram === 'diagram2';

  const branchedContextAgents = useMemo(() => getBranchedContextAgents(t), [t]);
  const branchedRootCauses = useMemo(() => getBranchedRootCauses(t), [t]);
  const branchedActions = useMemo(() => getBranchedActions(t), [t]);
  const policyBranchMeta = useMemo(() => getPolicyBranchMeta(t), [t]);

  const brFlow = useMemo(() => {
    if (!isDiagram2) return null;
    if (simulatedCauseCode) {
      const causeObj = branchedRootCauses.find((c) => c.code === simulatedCauseCode);
      if (causeObj) {
        const actionObj = branchedActions.find((a) => a.code === causeObj.primaryActionCode) || branchedActions[9];
        const secondaryObj = causeObj.secondaryActionCode
          ? branchedActions.find((a) => a.code === causeObj.secondaryActionCode) || null
          : null;
        return {
          isFlowActive: true,
          isSimulated: true,
          activeCauseObj: causeObj,
          activeActionObj: actionObj,
          secondaryActionObj: secondaryObj,
          policyBranch: causeObj.policyBranch || actionObj.defaultBranch || 'AUTO',
          policyReasonVi: causeObj.policyReasonVi,
          activeAgents: new Set(causeObj.agents || ['metrics', 'log', 'k8s_event', 'history']),
        };
      }
    }
    const rawCode =
      normalizeCauseCodeFromText(latestIncident?.cause || latestIncident?.root_cause || latestIncident?.title) ||
      normalizeCauseCodeFromText(latestRecommendation?.root_cause_type);
    const activeCauseObj = branchedRootCauses.find((c) => c.code === rawCode) || null;
    const actCode = normalizeActionCodeForBranch(
      latestAutoAction?.action_type_code || latestRecommendation?.recommended_action || latestRecommendation?.action_type
    );
    const activeActionObj = branchedActions.find((a) => a.code === actCode) || null;
    const policyBranch = isAuditActive ? 'AUDIT' : isHitlActive ? 'HITL' : isAutoActionActive ? 'AUTO' : null;
    return {
      isFlowActive: Boolean(activeCauseObj || activeActionObj || policyBranch),
      isSimulated: false,
      activeCauseObj,
      activeActionObj,
      secondaryActionObj: null,
      policyBranch,
      policyReasonVi:
        activeCauseObj?.policyReasonVi ||
        (policyBranch
          ? t('pipeline.mobile.liveGateReason', { branch: policyBranch })
          : t('pipeline.mobile.idleSimReason')),
      activeAgents: new Set(activeCauseObj?.agents || (isRcaActive ? ['metrics', 'log', 'k8s_event', 'history'] : [])),
    };
  }, [
    isDiagram2,
    simulatedCauseCode,
    branchedRootCauses,
    branchedActions,
    t,
    latestIncident,
    latestRecommendation,
    latestAutoAction,
    isAuditActive,
    isHitlActive,
    isAutoActionActive,
    isRcaActive,
  ]);

  const miniChartW = 360;
  const miniChartH = 148;
  const chartSeries = useMemo(() => {
    const pad = { top: 14, right: 10, bottom: 20, left: 26 };
    const innerW = miniChartW - pad.left - pad.right;
    const innerH = miniChartH - pad.top - pad.bottom;
    const count = Math.max(effectiveTimesteps.length - 1, 1);
    const getX = (idx) => pad.left + (idx / count) * innerW;
    const getY = (v) => pad.top + innerH - (Math.max(0, Math.min(v, chartMaxY)) / chartMaxY) * innerH;
    const sweepX = getX(activeSweepIdx);

    const lines = metricConfigs.slice(0, 6).map((cfg) => {
      const points = effectiveTimesteps.map((t, idx) => `${getX(idx).toFixed(1)},${getY(Number(t[cfg.key] || 0)).toFixed(1)}`);
      return { key: cfg.key, color: cfg.color, points: points.join(' ') };
    });
    return { lines, sweepX, y80: getY(80), pad, innerW, innerH, getX };
  }, [effectiveTimesteps, metricConfigs, chartMaxY, activeSweepIdx]);

  const jumpSteps = isDiagram2
    ? [
        { id: 'mv-stage-00', label: '00' },
        { id: 'mv-stage-rule', label: 'Rule' },
        { id: 'mv-stage-01', label: '01' },
        { id: 'mv-stage-02', label: '02' },
        { id: 'mv-stage-03', label: '03' },
        { id: 'mv-stage-04a', label: '04A' },
        { id: 'mv-stage-04b', label: '04B' },
        { id: 'mv-stage-05', label: '05' },
        { id: 'mv-stage-06a', label: '06A' },
        { id: 'mv-stage-07', label: '07' },
      ]
    : [
        { id: 'mv-stage-rule', label: 'Rule' },
        { id: 'mv-stage-01', label: '01' },
        { id: 'mv-stage-02', label: '02' },
        { id: 'mv-stage-03', label: '03' },
        ...(showExtendedPipeline
          ? [
              { id: 'mv-stage-04', label: '04' },
              { id: 'mv-stage-05', label: '05' },
              { id: 'mv-stage-06', label: '06' },
              { id: 'mv-stage-07', label: '07' },
            ]
          : []),
      ];

  const scrollToStage = (stageId) => {
    const el = typeof document !== 'undefined' ? document.getElementById(stageId) : null;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const rcaAgents = pipelineContext?.rcaAgents || {};
  const activePoliciesCount = pipelineContext?.activePoliciesCount ?? 0;

  return (
    <div
      data-testid="ai-pipeline-mobile-vertical"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '8px 10px 28px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Thanh điều khiển Mobile dính nhẹ: chuyển Sơ đồ 1 / Sơ đồ 2 + chuyển Sơ đồ ngang + Bước nhảy nhanh */}
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
          {showExtendedPipeline ? (
            <div style={{ display: 'inline-flex', gap: '4px', padding: '2px', borderRadius: '8px', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1' }}>
              {[
                { id: 'diagram1', label: t('pipeline.canvas.diagram1'), testId: 'mobile-switch-diagram-1' },
                { id: 'diagram2', label: t('pipeline.canvas.diagram2'), testId: 'mobile-switch-diagram-2' },
              ].map((dTab) => {
                const selected = activeDiagram === dTab.id;
                return (
                  <button
                    key={dTab.id}
                    type="button"
                    data-testid={dTab.testId}
                    onClick={() => onSwitchDiagram && onSwitchDiagram(dTab.id)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: selected ? (dTab.id === 'diagram2' ? '#7C3AED' : '#0F172A') : 'transparent',
                      color: selected ? '#FFFFFF' : '#475569',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {dTab.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>{t('pipeline.mobile.verticalTitle')}</span>
          )}

          <button
            type="button"
            data-testid="toggle-mobile-layout-mode"
            onClick={onSwitchToHorizontal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '7px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#334155',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Layers size={12} />
            <span>{t('pipeline.mobile.viewHorizontal')}</span>
          </button>
        </div>

        {/* Thanh nhảy nhanh theo bước */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
          }}
        >
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', flexShrink: 0 }}>{t('pipeline.mobile.jumpTo')}</span>
          {jumpSteps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToStage(s.id)}
              style={{
                padding: '3px 8px',
                borderRadius: '999px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.68rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* SƠ ĐỒ 2 KHỐI 00: TARGET SERVICE */}
      {isDiagram2 && (
        <>
          <StageCard
            id="mv-stage-00"
            badge={t('pipeline.mobile.stage00Badge')}
            badgeBg="#EFF6FF"
            badgeColor="#1D4ED8"
            borderColor={isAgentConnected ? '#3B82F6' : '#CBD5E1'}
            statusBadge={
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: isAgentConnected ? '#ECFDF5' : '#FEF2F2',
                  color: isAgentConnected ? '#059669' : '#DC2626',
                }}
              >
                {isAgentConnected ? t('pipeline.mobile.podOnline', { count: podCount }) : t('pipeline.mobile.offline')}
              </span>
            }
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                  {selectedService || t('pipeline.mobile.noServiceSelected')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                  {t('pipeline.mobile.threeStreamsDesc')}
                </div>
              </div>
              <Server size={20} color="#2563EB" />
            </div>
            {simulatedCauseCode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  backgroundColor: '#F5F3FF',
                  border: '1px solid #C4B5FD',
                  borderRadius: '8px',
                  padding: '6px 10px',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6D28D9' }}>
                  {t('pipeline.mobile.simulatingPrefix', { label: brFlow?.activeCauseObj?.shortLabelVi || simulatedCauseCode })}
                </span>
                {onClearSimulation && (
                  <button
                    type="button"
                    onClick={onClearSimulation}
                    style={{
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: '#7C3AED',
                      color: '#FFFFFF',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('pipeline.mobile.stopSim')}
                  </button>
                )}
              </div>
            )}
          </StageCard>
          <VerticalConnector active={isAgentConnected} color="#3B82F6" label={t('pipeline.mobile.threeStreamsConnector')} />
        </>
      )}

      {/* NHÁNH SONG SONG: RULE ENGINE — 6 LUẬT NGƯỠNG TĨNH */}
      {showExtendedPipeline && (
        <>
          <StageCard
            id="mv-stage-rule"
            badge={t('pipeline.mobile.ruleBadge')}
            badgeBg="#FFF7ED"
            badgeColor="#C2410C"
            borderColor={isRuleEngineTriggered ? '#EA580C' : '#FDBA74'}
            statusBadge={
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: isRuleEngineTriggered ? '#FEF2F2' : '#ECFDF5',
                  color: isRuleEngineTriggered ? '#DC2626' : '#059669',
                }}
              >
                {t('pipeline.mobile.ruleViolatedCount', { count: triggeredRuleCount })}
              </span>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 800, color: '#9A3412' }}>
                <Zap size={15} color="#EA580C" />
                <span>{t('pipeline.mobile.ruleTitle')}</span>
              </div>
              <button
                type="button"
                data-testid="mobile-toggle-rules"
                onClick={() => setShowRuleAll((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  border: '1px solid #FED7AA',
                  backgroundColor: '#FFF7ED',
                  color: '#C2410C',
                  borderRadius: '7px',
                  padding: '3px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span>{showRuleAll ? t('pipeline.mobile.collapse') : t('pipeline.mobile.details')}</span>
                {showRuleAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            {showRuleAll && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                {ruleEngineChecks.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: rule.triggered ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                      backgroundColor: rule.triggered ? '#FEF2F2' : '#F8FAFC',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: rule.triggered ? '#DC2626' : '#0F172A' }}>
                      {rule.name}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B' }}>{rule.cond}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px', color: rule.triggered ? '#B91C1C' : '#059669' }}>
                      {rule.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StageCard>
          <VerticalConnector active={isRuleEngineTriggered} color={isRuleEngineTriggered ? '#EA580C' : '#94A3B8'} label={t('pipeline.mobile.parallelConnector')} />
        </>
      )}

      {/* BƯỚC 01: 8 CHỈ SỐ VIỄN TRẮC */}
      <StageCard
        id="mv-stage-01"
        badge={t('pipeline.mobile.telemetryBadge', { count: metricConfigs.length })}
        badgeBg="#ECFDF5"
        badgeColor="#047857"
        borderColor={isAgentConnected ? '#6EE7B7' : '#CBD5E1'}
        statusBadge={
          <button
            type="button"
            data-testid="mobile-toggle-telemetry"
            onClick={() => setShowTelemetryAll((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              borderRadius: '7px',
              padding: '3px 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>{showTelemetryAll ? t('pipeline.mobile.collapse8Metrics') : t('pipeline.mobile.expand8Metrics')}</span>
            {showTelemetryAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          {(showTelemetryAll ? metricConfigs : metricConfigs.slice(0, 4)).map((cfg) => {
            const metric = liveMetrics[cfg.key] || { latest: '0.00', isWarning: false };
            const IconComp = cfg.icon || Activity;
            return (
              <div
                key={cfg.key}
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: metric.isWarning ? '#FFFBEB' : '#F8FAFC',
                  border: metric.isWarning ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>{cfg.name}</span>
                  <IconComp size={13} color={cfg.color} />
                </div>
                <div
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: metric.isWarning ? '#D97706' : '#0F172A',
                    marginTop: '3px',
                  }}
                >
                  {metric.latest}
                  {cfg.unit ? ` ${cfg.unit}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </StageCard>

      <VerticalConnector active={isAgentConnected} color={isAgentConnected ? '#3B82F6' : '#94A3B8'} label={t('pipeline.mobile.twelveStepConnector')} />

      {/* BƯỚC 02: DỰ BÁO CHUỖI THỜI GIAN (GRU WAVEFORM) */}
      <StageCard
        id="mv-stage-02"
        badge={t('pipeline.mobile.stage02Badge')}
        badgeBg="#EFF6FF"
        badgeColor="#1D4ED8"
        borderColor={isRiskDetected ? '#F59E0B' : '#93C5FD'}
        statusBadge={
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: isRiskDetected ? '#FEF2F2' : '#ECFDF5',
              color: isRiskDetected ? '#DC2626' : '#059669',
            }}
          >
            {!isAgentConnected
              ? t('pipeline.mobile.disconnected')
              : isBenignDbCacheState
                ? t('pipeline.mobile.safeCache')
                : isRiskDetected
                  ? t('pipeline.mobile.alertPct', { pct: (rawRiskScore * 100).toFixed(0) })
                  : t('pipeline.mobile.healthy')}
          </span>
        }
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
            AI Analysis &amp; Health Assessment
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#2563EB' }}>
            {t('pipeline.mobile.stepProgress', { label: currentStepLabel, current: activeSweepIdx + 1, total: effectiveTimesteps.length || 12 })}
          </span>
        </div>

        <svg viewBox={`0 0 ${miniChartW} ${miniChartH}`} style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
          <line
            x1={chartSeries.pad.left}
            y1={chartSeries.y80}
            x2={miniChartW - chartSeries.pad.right}
            y2={chartSeries.y80}
            stroke="#EF4444"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1={chartSeries.sweepX}
            y1={chartSeries.pad.top}
            x2={chartSeries.sweepX}
            y2={miniChartH - chartSeries.pad.bottom}
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {chartSeries.lines.map((line) => (
            <polyline key={line.key} fill="none" stroke={line.color} strokeWidth="2" points={line.points} />
          ))}
        </svg>

        <div style={{ fontSize: '0.72rem', color: '#475569' }}>
          {t('pipeline.mobile.serviceLabel')} <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{selectedService || t('pipeline.mobile.notSelected')}</strong>
          {' • '}
          {t('pipeline.mobile.riskScoreLabel')} <strong style={{ fontFamily: 'var(--font-mono)' }}>{(rawRiskScore || 0).toFixed(4)}</strong>
        </div>
      </StageCard>

      <VerticalConnector active={isRiskDetected} color={isRiskDetected ? '#EF4444' : '#10B981'} label={t('pipeline.mobile.sevenHeadsConnector')} />

      {/* BƯỚC 03: 7 ĐẦU RỦI RO AI */}
      <StageCard
        id="mv-stage-03"
        badge={t('pipeline.mobile.stage03Badge', { count: triggeredRisksList.length })}
        badgeBg="#FFF1F2"
        badgeColor="#BE123C"
        borderColor={triggeredRisksList.length > 0 ? '#FDA4AF' : '#E2E8F0'}
        statusBadge={
          <button
            type="button"
            onClick={() => setShowRisksAll((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              border: '1px solid #FECDD3',
              backgroundColor: '#FFF1F2',
              color: '#BE123C',
              borderRadius: '7px',
              padding: '3px 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>{showRisksAll ? t('pipeline.mobile.collapse') : t('pipeline.mobile.expand7Branches')}</span>
            {showRisksAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(showRisksAll ? allRiskEvaluations : allRiskEvaluations.slice(0, 3)).map((r) => {
            const pct = Math.round((r.riskInfo?.prob || 0) * 100);
            const trig = Boolean(r.riskInfo?.isTriggered);
            return (
              <div
                key={r.id}
                style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  backgroundColor: trig ? '#FEF2F2' : '#F8FAFC',
                  border: trig ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', fontWeight: 700 }}>
                  <span style={{ color: trig ? '#B91C1C' : '#0F172A' }}>{r.title}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: trig ? '#DC2626' : '#059669' }}>
                    {r.riskInfo?.probPercent || `${pct}%`}
                  </span>
                </div>
                <div style={{ height: '4px', backgroundColor: '#E2E8F0', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: trig ? '#DC2626' : '#10B981' }} />
                </div>
              </div>
            );
          })}
          {!showRisksAll && topRiskEval && (
            <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
              {t('pipeline.mobile.highestNow')} <strong>{topRiskEval.title}</strong> ({topRiskEval.riskInfo?.probPercent || '0%'})
            </div>
          )}
        </div>
      </StageCard>

      {showExtendedPipeline && (
        <>
          <VerticalConnector active={isRcaActive || brFlow?.isFlowActive} color={isRcaActive ? '#7C3AED' : '#94A3B8'} label={t('pipeline.mobile.gatherRcaConnector')} />

          {/* SƠ ĐỒ 2: BƯỚC 04A & 04B */}
          {isDiagram2 ? (
            <>
              <StageCard
                id="mv-stage-04a"
                badge={t('pipeline.mobile.stage04aBadge')}
                badgeBg="#F5F3FF"
                badgeColor="#6D28D9"
                borderColor="#C4B5FD"
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  {branchedContextAgents.map((ag) => {
                    const IconC = ag.icon;
                    const active = brFlow?.activeAgents?.has(ag.id);
                    return (
                      <div
                        key={ag.id}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: active ? `1.5px solid ${ag.color}` : `1px solid ${ag.border}`,
                          backgroundColor: active ? ag.bg : '#FAFAFA',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.73rem', fontWeight: 800, color: ag.color }}>
                          <IconC size={13} />
                          <span>{ag.name}</span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>{ag.role}</div>
                      </div>
                    );
                  })}
                </div>
              </StageCard>

              <VerticalConnector active={brFlow?.isFlowActive} color="#7C3AED" label={t('pipeline.mobile.inferRootCauseConnector')} />

              <StageCard
                id="mv-stage-04b"
                badge={t('pipeline.mobile.stage04bBadge')}
                badgeBg="#F5F3FF"
                badgeColor="#6D28D9"
                borderColor={brFlow?.activeCauseObj ? '#7C3AED' : '#DDD6FE'}
                statusBadge={
                  <button
                    type="button"
                    onClick={() => setShowCausesAll((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      border: '1px solid #DDD6FE',
                      backgroundColor: '#F5F3FF',
                      color: '#6D28D9',
                      borderRadius: '7px',
                      padding: '3px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{showCausesAll ? t('pipeline.mobile.collapse16Causes') : t('pipeline.mobile.viewAll16Causes')}</span>
                    {showCausesAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                  {(showCausesAll ? branchedRootCauses : branchedRootCauses.slice(0, 4)).map((c) => {
                    const isSelected = brFlow?.activeCauseObj?.code === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => onSelectSimulatedCause && onSelectSimulatedCause(c.code)}
                        style={{
                          textAlign: 'left',
                          padding: '7px 8px',
                          borderRadius: '9px',
                          border: isSelected ? `1.5px solid ${c.color}` : '1px solid #E2E8F0',
                          backgroundColor: isSelected ? `${c.color}14` : '#F8FAFC',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: isSelected ? c.color : '#0F172A' }}>
                          #{c.index} {c.shortLabelVi}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>{c.code}</div>
                      </button>
                    );
                  })}
                </div>
              </StageCard>
            </>
          ) : (
            /* SƠ ĐỒ 1 BƯỚC 04: ĐA TÁC TỬ RCA & SỰ CỐ */
            <StageCard
              id="mv-stage-04"
              badge={t('pipeline.mobile.stage04Badge')}
              badgeBg="#F5F3FF"
              badgeColor="#6D28D9"
              borderColor={openServiceIncidentsCount > 0 ? '#DC2626' : '#C4B5FD'}
              statusBadge={
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: openServiceIncidentsCount > 0 ? '#FEF2F2' : '#ECFDF5',
                    color: openServiceIncidentsCount > 0 ? '#DC2626' : '#059669',
                  }}
                >
                  {openServiceIncidentsCount > 0 ? t('pipeline.mobile.openIncidentsCount', { count: openServiceIncidentsCount }) : t('pipeline.mobile.stableZeroOpen')}
                </span>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                {branchedContextAgents.map((ag) => (
                  <div
                    key={ag.id}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    {ag.name} •{' '}
                    <span style={{ color: isAgentConnected ? '#059669' : '#94A3B8' }}>
                      {isAgentConnected ? t('pipeline.mobile.ready') : t('pipeline.mobile.offline')}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '9px', padding: '8px', fontSize: '0.73rem', color: '#065F46' }}>
                <strong>{t('pipeline.mobile.rcaConclusion')}</strong>{' '}
                {latestIncident
                  ? latestIncident.cause || latestIncident.root_cause || latestIncident.title
                  : lastResolvedIncident
                    ? t('pipeline.mobile.latestHandled', { title: lastResolvedIncident.title || lastResolvedIncident.cause || t('pipeline.mobile.completed') })
                    : t('pipeline.mobile.optimalSla')}
                {rcaAgents?.rcaConfidencePct ? ` (${rcaAgents.rcaConfidencePct}%)` : ''}
              </div>
              <ActionLinkButton label={t('pipeline.mobile.openIncidentsRcaBtn')} path="/dashboard/incidents" color="#6D28D9" onNavigate={onNavigate} />
            </StageCard>
          )}

          <VerticalConnector active={isRcaActive || brFlow?.isFlowActive} color="#D97706" label={t('pipeline.mobile.checkPolicyConnector')} />

          {/* BƯỚC 05: POLICY ENGINE */}
          <StageCard
            id="mv-stage-05"
            badge={t('pipeline.mobile.stage05Badge')}
            badgeBg="#FFFBEB"
            badgeColor="#B45309"
            borderColor="#FCD34D"
            statusBadge={
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)' }}>
                {t('pipeline.mobile.activePoliciesCount', { count: activePoliciesCount })}
              </span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.74rem', color: '#334155' }}>
              <div>{t('pipeline.mobile.policyLine1', { auto: pipelineContext?.autoPoliciesCount ?? 0, hitl: pipelineContext?.hitlPoliciesCount ?? 0 })}</div>
              <div>{t('pipeline.mobile.policyLine2')}</div>
              {isDiagram2 && brFlow?.policyReasonVi && (
                <div style={{ fontSize: '0.71rem', color: '#92400E', backgroundColor: '#FFFBEB', padding: '6px 8px', borderRadius: '8px' }}>
                  {brFlow.policyReasonVi}
                </div>
              )}
            </div>
            <ActionLinkButton label={t('pipeline.mobile.autoPoliciesBtn')} path="/dashboard/self-healing/policies" color="#D97706" onNavigate={onNavigate} />
          </StageCard>

          <VerticalConnector active={isAutoActionActive || isHitlActive || isAuditActive || Boolean(brFlow?.policyBranch)} color="#059669" label={t('pipeline.mobile.dispatchConnector')} />

          {/* BƯỚC 06 / 06A-06B */}
          {isDiagram2 ? (
            <StageCard
              id="mv-stage-06a"
              badge={t('pipeline.mobile.stage06aBadge')}
              badgeBg="#ECFDF5"
              badgeColor="#047857"
              borderColor="#6EE7B7"
              statusBadge={
                <button
                  type="button"
                  onClick={() => setShowActionsAll((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    border: '1px solid #A7F3D0',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    borderRadius: '7px',
                    padding: '3px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span>{showActionsAll ? t('pipeline.mobile.collapse') : t('pipeline.mobile.tenActionsToggle')}</span>
                  {showActionsAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              }
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['AUTO', 'HITL', 'AUDIT'].map((branchKey) => {
                  const meta = policyBranchMeta[branchKey];
                  const isActiveBranch = brFlow?.policyBranch === branchKey;
                  return (
                    <span
                      key={branchKey}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        border: `1px solid ${isActiveBranch ? meta.color : '#E2E8F0'}`,
                        backgroundColor: isActiveBranch ? meta.bg : '#F8FAFC',
                        color: isActiveBranch ? meta.color : '#64748B',
                      }}
                    >
                      {meta.badge}
                    </span>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                {(showActionsAll ? branchedActions : branchedActions.slice(0, 4)).map((actItem) => {
                  const isActiveAct =
                    brFlow?.activeActionObj?.code === actItem.code || brFlow?.secondaryActionObj?.code === actItem.code;
                  return (
                    <div
                      key={actItem.code}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: isActiveAct ? '1.5px solid #059669' : '1px solid #E2E8F0',
                        backgroundColor: isActiveAct ? '#ECFDF5' : '#F8FAFC',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: isActiveAct ? '#047857' : '#0F172A' }}>
                        {actItem.labelVi}
                      </div>
                      <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: '#64748B' }}>{actItem.code}</div>
                    </div>
                  );
                })}
              </div>
            </StageCard>
          ) : (
            <StageCard
              id="mv-stage-06"
              badge={t('pipeline.mobile.stage06Badge')}
              badgeBg="#ECFDF5"
              badgeColor="#047857"
              borderColor={isHitlActive ? '#F59E0B' : isAutoActionActive ? '#10B981' : '#CBD5E1'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ padding: '7px 9px', borderRadius: '9px', backgroundColor: isAutoActionActive ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${isAutoActionActive ? '#6EE7B7' : '#E2E8F0'}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                  <strong>{t('pipeline.canvas.branches.b1Title')}</strong>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{isAutoActionInProgress ? t('pipeline.mobile.running') : isAgentConnected ? t('pipeline.mobile.ready') : t('pipeline.mobile.offline')}</span>
                </div>
                <div style={{ padding: '7px 9px', borderRadius: '9px', backgroundColor: isHitlActive ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${isHitlActive ? '#FCD34D' : '#E2E8F0'}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                  <strong>{t('pipeline.canvas.branches.b2Title')}</strong>
                  <span style={{ color: '#D97706', fontWeight: 700 }}>{t('pipeline.mobile.pendingCount', { count: pendingApprovalsCount })}</span>
                </div>
                <div style={{ padding: '7px 9px', borderRadius: '9px', backgroundColor: isCircuitBreakerTripped ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${isCircuitBreakerTripped ? '#FCA5A5' : '#E2E8F0'}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                  <strong>{t('pipeline.canvas.branches.b3Title')}</strong>
                  <span style={{ color: isCircuitBreakerTripped ? '#DC2626' : '#475569', fontWeight: 700 }}>
                    {isCircuitBreakerTripped ? t('pipeline.mobile.tripped') : t('pipeline.mobile.normal')}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <ActionLinkButton label={t('pipeline.mobile.healingActionsBtn')} path="/dashboard/self-healing/actions" color="#059669" onNavigate={onNavigate} />
                <ActionLinkButton label={t('pipeline.mobile.hitlApprovalsBtn')} path="/dashboard/self-healing/approvals" color="#D97706" onNavigate={onNavigate} />
              </div>
            </StageCard>
          )}

          <VerticalConnector active={isVerifyingInProgress || actionTimeline.length > 0} color="#0284C7" label={t('pipeline.mobile.verify60sConnector')} />

          {/* BƯỚC 07: HẬU KIỂM & TỰ ĐÓNG SỰ CỐ */}
          <StageCard
            id="mv-stage-07"
            badge={t('pipeline.mobile.stage07Badge')}
            badgeBg="#F0F9FF"
            badgeColor="#0369A1"
            borderColor={hasUnrecoveredStep ? '#EF4444' : '#7DD3FC'}
            statusBadge={
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284C7' }}>
                {isVerifyingInProgress ? t('pipeline.mobile.verifyingStatus') : 'Auto-Resolve'}
              </span>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', textAlign: 'center' }}>
              <div style={{ padding: '7px', borderRadius: '8px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                  {recoveryStats.succeededCount || 0}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>{t('pipeline.mobile.recoveredCountLabel')}</div>
              </div>
              <div style={{ padding: '7px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#DC2626', fontFamily: 'var(--font-mono)' }}>
                  {recoveryStats.failedCount || 0}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#B91C1C', fontWeight: 700 }}>{t('pipeline.mobile.unrecoveredCountLabel')}</div>
              </div>
            </div>

            {isDiagram2 && simulatedCauseCode && onChangeVerifyOutcome && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                {[
                  { id: 'auto', label: t('pipeline.mobile.optDefault') },
                  { id: 'recovered', label: t('pipeline.mobile.optRecovered') },
                  { id: 'unrecovered', label: t('pipeline.mobile.optUnrecovered') },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeVerifyOutcome(opt.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: verifyOutcomeMode === opt.id ? '1px solid #0284C7' : '1px solid #CBD5E1',
                      backgroundColor: verifyOutcomeMode === opt.id ? '#E0F2FE' : '#FFFFFF',
                      color: verifyOutcomeMode === opt.id ? '#0369A1' : '#475569',
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {actionTimeline.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {actionTimeline.slice(-3).map((step) => (
                  <div
                    key={step.stepIndex}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '0.7rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>
                      #{step.stepIndex} {step.actionLabelVi}
                    </span>
                    <span style={{ fontWeight: 700, color: step.isFailedOrUnrecovered ? '#DC2626' : '#059669', flexShrink: 0 }}>
                      {step.verdictLabel}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                {t('pipeline.mobile.noActions24h')}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 9px',
                borderRadius: '9px',
                border: '1px dashed #38BDF8',
                backgroundColor: '#F0F9FF',
                fontSize: '0.7rem',
                color: '#0369A1',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={13} />
              <span>{t('pipeline.mobile.closedLoopNote')}</span>
            </div>

            <ActionLinkButton label={t('pipeline.mobile.healingHistoryBtn')} path="/dashboard/self-healing/history" color="#0284C7" onNavigate={onNavigate} />
          </StageCard>
        </>
      )}
    </div>
  );
};

export default AIPipelineMobileVerticalFlow;
