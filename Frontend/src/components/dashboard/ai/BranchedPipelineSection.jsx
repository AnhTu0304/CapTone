import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  BRANCHED_ACTIONS,
  BRANCHED_CONTEXT_AGENTS,
  BRANCHED_ROOT_CAUSES,
  POLICY_BRANCH_META,
  RISK_AGENT_MAP,
  RULE_AGENT_MAP,
  normalizeActionCodeForBranch,
  normalizeCauseCodeFromText,
} from './BranchedPipelineCatalog';

/**
 * BranchedPipelineSection (Sơ đồ 2 — Kiến trúc Toàn Luồng 00 Service → 07 Hậu Kiểm)
 * Cách A: Khối 00 Target Service nối 3 luồng thu thập thực tế (Metrics/Probe → 01, LogsCollector → Log Agent, EventsCollector → K8s Event Agent)
 * → Rule Engine 6 Luật Hàng Ngang & 02 AI Hub → 03 7 Đầu Rủi Ro → 04A 4 Agent Độc Lập → 04B 16 Nguyên Nhân Gốc → 05 Policy → 06A 10 Action → 06B 3 Cổng K8s → 07 Hậu Kiểm 60s.
 */
export const BranchedPipelineSection = ({
  topOffset = 18,
  canvasWidth = 4090,
  selectedService = 'service',
  isAgentConnected = true,
  liveMetrics = {},
  riskProbabilities = {},
  ruleEngineChecks = [],
  latestIncident = null,
  lastResolvedIncident = null,
  openServiceIncidentsCount = 0,
  latestRecommendation = null,
  latestAutoAction = null,
  latestHitlApproval = null,
  isCircuitBreakerTripped = false,
  isBenignDbCacheState = false,
  isVerifyingInProgress = false,
  isRcaActive = false,
  isAutoActionActive = false,
  isHitlActive = false,
  isAuditActive = false,
  actionTimeline = [],
  recoveryStats = {},
  pipelineContext = null,
  podCount = 1,
  currentActiveStep = 12,
  totalSteps = 12,
  metricConfigs = [],
  riskNodes = [],
  effectiveTimesteps = [],
  chartMaxY = 100,
  yTicks = [0, 25, 50, 75, 100],
  activeSweepIdx = 0,
  currentStepLabel = 'T1',
  prediction = null,
  rawRiskScore = 0,
  isPredictionHealthy = true,
  isRiskDetected = false,
  isScaleDownOptimization = false,
  topRiskEval = null,
  isTelemetryExpanded = false,
  isRuleExpanded = false,
  isRisksExpanded = false,
  isCausesExpanded = false,
  isActionsExpanded = false,
  onToggleTelemetry,
  onToggleRule,
  onToggleRisks,
  onToggleCauses,
  onToggleActions,
  onToggleAllBranches,
  simulatedCauseCode = null,
  onSelectSimulatedCause,
  onClearSimulation,
  verifyOutcomeMode = 'auto',
  onChangeVerifyOutcome,
}) => {
  const isSimulating = Boolean(simulatedCauseCode);

  // ==========================================
  // 1. XÁC ĐỊNH LUỒNG ĐANG CHẠY (MÔ PHỎNG HOẶC DỮ LIỆU THỰC LIVE)
  // ==========================================
  const baseFlow = useMemo(() => {
    const emptyFlow = {
      isFlowActive: false,
      isSimulated: false,
      activeCauseObj: null,
      activeActionObj: null,
      secondaryActionObj: null,
      activeMetrics: new Set(),
      activeRules: new Set(),
      activeRisks: new Set(),
      activeAgents: new Set(),
      policyBranch: null,
      policyReasonVi: 'Hệ thống đang ổn định — mở rộng các nhánh hoặc click vào 1/16 Nguyên nhân gốc để mô phỏng luồng.',
      liveModeLabel: isAgentConnected ? 'Dữ liệu thực (Live) • Ổn định' : 'Mất kết nối Agent',
    };

    if (simulatedCauseCode) {
      const causeObj = BRANCHED_ROOT_CAUSES.find((c) => c.code === simulatedCauseCode);
      if (causeObj) {
        const actionObj = BRANCHED_ACTIONS.find((a) => a.code === causeObj.primaryActionCode) || BRANCHED_ACTIONS[9];
        const secondaryObj = causeObj.secondaryActionCode
          ? BRANCHED_ACTIONS.find((a) => a.code === causeObj.secondaryActionCode) || null
          : null;
        return {
          isFlowActive: true,
          isSimulated: true,
          activeCauseObj: causeObj,
          activeActionObj: actionObj,
          secondaryActionObj: secondaryObj,
          activeMetrics: new Set(causeObj.triggerMetrics || []),
          activeRules: new Set(causeObj.triggerRules || []),
          activeRisks: new Set(causeObj.triggerRisks || []),
          activeAgents: new Set(causeObj.agents || ['metrics', 'log', 'k8s_event', 'history']),
          policyBranch: causeObj.policyBranch || actionObj.defaultBranch || 'AUTO',
          policyReasonVi: causeObj.policyReasonVi,
          liveModeLabel: `Mô phỏng: ${causeObj.shortLabelVi} → ${actionObj.code}`,
        };
      }
    }

    if (!isAgentConnected) {
      return emptyFlow;
    }

    const liveWarnMetrics = new Set(
      Object.entries(liveMetrics || {})
        .filter(([, val]) => Boolean(val?.isWarning))
        .map(([k]) => k)
    );
    const liveTriggeredRules = new Set(
      (ruleEngineChecks || []).filter((r) => r.triggered).map((r) => r.id)
    );
    const liveTriggeredRisks = new Set(
      Object.entries(riskProbabilities || {})
        .filter(([, val]) => Boolean(val?.isTriggered))
        .map(([k]) => k)
    );

    const hasLiveIncidentOrSignal =
      openServiceIncidentsCount > 0 ||
      isRcaActive ||
      isBenignDbCacheState ||
      liveTriggeredRules.size > 0 ||
      liveTriggeredRisks.size > 0;

    if (!hasLiveIncidentOrSignal) {
      return emptyFlow;
    }

    let detectedCauseCode = null;
    if (isBenignDbCacheState) {
      detectedCauseCode = 'database_cache_utilization';
    } else if (latestIncident) {
      detectedCauseCode =
        normalizeCauseCodeFromText(latestIncident.cause) ||
        normalizeCauseCodeFromText(latestIncident.root_cause) ||
        normalizeCauseCodeFromText(latestIncident.title) ||
        'unknown';
    } else if (liveTriggeredRisks.has('OOM')) {
      detectedCauseCode = 'memory_exhaustion';
    } else if (liveTriggeredRisks.has('DISK_FULL') || liveTriggeredRules.has('R6')) {
      detectedCauseCode = 'storage_exhaustion';
    } else if (liveTriggeredRisks.has('CPU_OVERLOAD') || liveTriggeredRules.has('R1')) {
      detectedCauseCode = 'cpu_saturation';
    } else if (liveTriggeredRisks.has('TRAFFIC_OVERLOAD') || liveTriggeredRules.has('R2')) {
      detectedCauseCode = 'traffic_overload';
    } else if (liveTriggeredRisks.has('HTTP_5XX_SPIKE') || liveTriggeredRules.has('R4')) {
      detectedCauseCode = 'application_failure';
    } else if (liveTriggeredRules.has('R5')) {
      detectedCauseCode = 'unstable_pod';
    } else if (liveTriggeredRisks.has('SCALE_DOWN_CANDIDATE')) {
      detectedCauseCode = 'underutilized';
    } else {
      detectedCauseCode = 'unknown';
    }

    const causeObj =
      BRANCHED_ROOT_CAUSES.find((c) => c.code === detectedCauseCode) ||
      BRANCHED_ROOT_CAUSES[BRANCHED_ROOT_CAUSES.length - 1];

    const hitlRawAction =
      latestHitlApproval &&
      (latestHitlApproval.action_type_code || latestHitlApproval.action_code || latestHitlApproval.action_name);
    const autoRawAction =
      latestAutoAction &&
      (latestAutoAction.display_action_name ||
        latestAutoAction.action_type_code ||
        latestAutoAction.action_code ||
        latestAutoAction.action_name);
    const recRawAction =
      latestRecommendation &&
      (latestRecommendation.action || latestRecommendation.action_code || latestRecommendation.recommendation);

    const recNormCode = normalizeActionCodeForBranch(recRawAction);
    const autoNormCode = normalizeActionCodeForBranch(autoRawAction);
    const hitlNormCode = normalizeActionCodeForBranch(hitlRawAction);

    // Đồng bộ 100% thứ tự ưu tiên cổng điều phối như Sơ đồ 1: HITL -> Audit/CircuitBreaker -> AUTO -> Recommendation
    let normalizedActCode = causeObj.primaryActionCode;
    let liveBranch = causeObj.policyBranch;

    if (isHitlActive) {
      normalizedActCode = hitlNormCode || recNormCode || causeObj.primaryActionCode;
      liveBranch = 'HITL';
    } else if (isAuditActive || isCircuitBreakerTripped) {
      normalizedActCode = 'NO_ACTION';
      liveBranch = 'AUDIT';
    } else if (isAutoActionActive) {
      normalizedActCode = autoNormCode || recNormCode || causeObj.primaryActionCode;
      liveBranch = normalizedActCode === 'NO_ACTION' ? 'AUDIT' : 'AUTO';
    } else {
      normalizedActCode = recNormCode || causeObj.primaryActionCode || autoNormCode || 'NO_ACTION';
      liveBranch =
        normalizedActCode === 'NO_ACTION'
          ? 'AUDIT'
          : BRANCHED_ACTIONS.find((a) => a.code === normalizedActCode)?.defaultBranch || causeObj.policyBranch;
    }

    const actionObj = BRANCHED_ACTIONS.find((a) => a.code === normalizedActCode) || BRANCHED_ACTIONS[9];

    const secondaryObj = causeObj.secondaryActionCode
      ? BRANCHED_ACTIONS.find((a) => a.code === causeObj.secondaryActionCode) || null
      : null;

    // Tránh hiển thị mô tả cũ của Scale Down khi hành động hiện tại là NO_ACTION / Ngắt mạch
    const rawRecReason = String(latestRecommendation?.reasoning || latestRecommendation?.reason || '').trim();
    const isStaleScaleReasonOnNoAction =
      actionObj.code === 'NO_ACTION' &&
      /scale|replica|thu hẹp|tăng bản sao/i.test(rawRecReason) &&
      !/ngắt mạch|circuit|an toàn|no_action|unknown/i.test(rawRecReason);
    const resolvedLiveReasonVi =
      rawRecReason && !isStaleScaleReasonOnNoAction && (!recNormCode || recNormCode === actionObj.code)
        ? rawRecReason
        : isCircuitBreakerTripped || isAuditActive
          ? 'Circuit Breaker / Audit đang kích hoạt: tạm dừng can thiệp K8s (NO_ACTION) và ghi Audit Log theo rào chắn an toàn.'
          : causeObj.policyReasonVi;

    // Kiểm tra bằng chứng thực tế của từng Agent (không gắn nhãn "Có bằng chứng" nếu Agent báo 0 lỗi / không bất thường)
    const logSubLower = String(pipelineContext?.rcaAgentsSummary?.logSub || '').toLowerCase();
    const k8sSubLower = String(pipelineContext?.rcaAgentsSummary?.k8sEventSub || '').toLowerCase();
    const liveActiveAgentsList = (causeObj.agents || ['metrics', 'log', 'k8s_event', 'history']).filter((agId) => {
      if (agId === 'log' && /0 lỗi|không có lỗi|0 error/.test(logSubLower) && !liveTriggeredRules.has('R4') && !liveTriggeredRisks.has('HTTP_5XX_SPIKE')) {
        return false;
      }
      if (agId === 'k8s_event' && /không bất thường|pod ổn định|normal/.test(k8sSubLower) && !liveTriggeredRules.has('R5')) {
        return false;
      }
      return true;
    });

    return {
      isFlowActive: true,
      isSimulated: false,
      activeCauseObj: causeObj,
      activeActionObj: actionObj,
      secondaryActionObj: secondaryObj,
      activeMetrics: liveWarnMetrics.size > 0 ? liveWarnMetrics : new Set(causeObj.triggerMetrics || []),
      activeRules: liveTriggeredRules.size > 0 ? liveTriggeredRules : new Set(causeObj.triggerRules || []),
      activeRisks: liveTriggeredRisks.size > 0 ? liveTriggeredRisks : new Set(causeObj.triggerRisks || []),
      activeAgents: new Set(liveActiveAgentsList.length > 0 ? liveActiveAgentsList : ['metrics']),
      policyBranch: liveBranch,
      policyReasonVi: resolvedLiveReasonVi,
      liveModeLabel: `Live: ${causeObj.shortLabelVi} → ${actionObj.code}`,
    };
  }, [
    simulatedCauseCode,
    isAgentConnected,
    liveMetrics,
    ruleEngineChecks,
    riskProbabilities,
    openServiceIncidentsCount,
    isRcaActive,
    isBenignDbCacheState,
    latestIncident,
    latestHitlApproval,
    latestAutoAction,
    latestRecommendation,
    isHitlActive,
    isAutoActionActive,
    isAuditActive,
    isCircuitBreakerTripped,
    pipelineContext?.rcaAgentsSummary?.logSub,
    pipelineContext?.rcaAgentsSummary?.k8sEventSub,
  ]);

  const latestLiveStep = actionTimeline.length > 0 ? actionTimeline[actionTimeline.length - 1] : null;
  const isUnrecoveredLoop = Boolean(
    baseFlow.isFlowActive &&
      (verifyOutcomeMode === 'unrecovered' ||
        (verifyOutcomeMode === 'auto' && Boolean(latestLiveStep?.isFailedOrUnrecovered)))
  );

  const escalatedActionObj = isUnrecoveredLoop
    ? baseFlow.secondaryActionObj || BRANCHED_ACTIONS[9]
    : null;
  const effectiveDisplayActionObj = isUnrecoveredLoop ? escalatedActionObj : baseFlow.activeActionObj;
  const effectivePolicyBranch = isUnrecoveredLoop
    ? escalatedActionObj?.defaultBranch || 'AUDIT'
    : baseFlow.policyBranch;

  const flowState = {
    ...baseFlow,
    isUnrecoveredLoop,
    escalatedActionObj,
    effectiveDisplayActionObj,
    effectivePolicyBranch,
  };

  // ==========================================
  // 2. BỐ CỤC TOÀN LUỒNG CÓ 00 SERVICE ĐẦU TIÊN (4090PX) + RULE HÀNG NGANG
  // ==========================================
  const BANNER_Y = topOffset;

  // Rule Engine xếp thành 1 hàng ngang 6 thẻ phía trên 02 AI Hub & 03 7 Đầu Rủi Ro
  const RULE_ROW_X = 695;
  const RULE_CARD_W = 148;
  const RULE_CARD_GAP = 10; // 6 * 148 + 5 * 10 = 938px (695 .. 1633)
  const RULE_ROW_TOTAL_W = 6 * RULE_CARD_W + 5 * RULE_CARD_GAP;
  const RULE_ROW_H = 66;
  const RULE_ROW_Y = topOffset + 210;
  const RULE_COMPACT_X = 814;
  const RULE_COMPACT_W = 700;
  const RULE_COMPACT_H = 56;
  const RULE_COMPACT_Y = topOffset + 214;

  const HUB_X = 760;
  const HUB_W = 420;
  const HUB_H = 430;
  const HUB_Y = topOffset + 436;

  const R_X = 1290;
  const R_W = 276;
  const R_H = 54;
  const R_GAP = 11;
  const R_TOTAL_H = Math.max(riskNodes.length, 1) * R_H + Math.max(riskNodes.length - 1, 0) * R_GAP; // 444px
  const R_START_Y = HUB_Y + HUB_H / 2 - R_TOTAL_H / 2;
  const R_COMPACT_H = 212;
  const R_COMPACT_Y = HUB_Y + HUB_H / 2 - R_COMPACT_H / 2;

  // Trục giữa chung cho các cột chính (00, 01, 02, 03, 04A..07)
  const D2_MID_Y = Math.round(HUB_Y + HUB_H / 2);

  // 00: Target Service / Workload (nối ra 3 luồng thu thập: Metrics -> 01, Logs -> Log Agent, K8s Events -> K8s Event Agent)
  const SV_X = 20;
  const SV_W = 236;
  const SV_H = 266;
  const SV_Y = Math.round(D2_MID_Y - SV_H / 2);

  // 01: Viễn trắc (8 Metric Inputs xếp dọc)
  const M_X = 350;
  const M_W = 224;
  const M_H = 52;
  const M_GAP = 9;
  const M_TOTAL_H = Math.max(metricConfigs.length, 1) * M_H + Math.max(metricConfigs.length - 1, 0) * M_GAP; // 479px
  const M_START_Y = Math.round(D2_MID_Y - M_TOTAL_H / 2);
  const M_COMPACT_H = 212;
  const M_COMPACT_Y = Math.round(D2_MID_Y - M_COMPACT_H / 2);

  // 04A: 4 Agent Độc Lập xếp dọc (chừa 319px sau Cột 03 cho làn Rule + 2 luồng Log/Event từ 00 Service)
  const AG_X = 1885;
  const AG_W = 262;
  const AG_H = 114;
  const AG_GAP = 22;
  const AG_TOTAL_H = 4 * AG_H + 3 * AG_GAP; // 522px
  const AG_START_Y = Math.round(D2_MID_Y - AG_TOTAL_H / 2);

  // 04B: RootCauseAgent (16 Nguyên nhân gốc xếp dọc)
  const RC_X = 2245;
  const RC_W = 356;
  const RC_ITEM_H = 42;
  const RC_ITEM_GAP = 9;
  const RC_TOTAL_H = BRANCHED_ROOT_CAUSES.length * RC_ITEM_H + (BRANCHED_ROOT_CAUSES.length - 1) * RC_ITEM_GAP; // 807px
  const RC_START_Y = Math.round(D2_MID_Y - RC_TOTAL_H / 2);
  const RC_COMPACT_H = 300;
  const RC_COMPACT_Y = Math.round(D2_MID_Y - RC_COMPACT_H / 2);

  // 05: RecommendationAgent & Policy Engine
  const PL_X = 2695;
  const PL_W = 260;
  const PL_H = 320;
  const PL_Y = Math.round(D2_MID_Y - PL_H / 2);

  // 06A: 10 Action xếp dọc
  const AC_X = 3050;
  const AC_W = 340;
  const AC_ITEM_H = 54;
  const AC_ITEM_GAP = 12;
  const AC_TOTAL_H = BRANCHED_ACTIONS.length * AC_ITEM_H + (BRANCHED_ACTIONS.length - 1) * AC_ITEM_GAP; // 648px
  const AC_START_Y = Math.round(D2_MID_Y - AC_TOTAL_H / 2);
  const AC_COMPACT_H = 300;
  const AC_COMPACT_Y = Math.round(D2_MID_Y - AC_COMPACT_H / 2);

  // 06B: Cổng Điều Phối K8s
  const GT_X = 3480;
  const GT_W = 234;
  const GT_H = 132;
  const GT_GAP = 24;
  const GT_TOTAL_H = 3 * GT_H + 2 * GT_GAP; // 444px
  const GT_START_Y = Math.round(D2_MID_Y - GT_TOTAL_H / 2);

  // 07: Hậu Kiểm 60s
  const VF_X = 3805;
  const VF_W = 260;
  const VF_H = 386;
  const VF_Y = Math.round(D2_MID_Y - VF_H / 2);

  // Rãnh đáy 2 đường thu thập LogsCollector / EventsCollector (nằm dưới 01/02/03/04A, phía trên 2 vòng lặp đáy)
  const LOG_COLLECT_BUS_Y = AG_START_Y + AG_TOTAL_H + 34;
  const EVENT_COLLECT_BUS_Y = AG_START_Y + AG_TOTAL_H + 58;

  // Kênh vòng lặp đáy
  const LOWEST_D2_Y = Math.max(R_START_Y + R_TOTAL_H, RC_START_Y + RC_TOTAL_H, EVENT_COLLECT_BUS_Y + 18);
  const FEEDBACK_RESOLVE_Y = LOWEST_D2_Y + 46;
  const FEEDBACK_ESCALATE_Y = LOWEST_D2_Y + 84;

  // ==========================================
  // 3. HELPER BIỂU ĐỒ & TÍN HIỆU
  // ==========================================
  const miniChartW = 396;
  const miniChartH = 195;
  const chartPad = { top: 26, right: 12, bottom: 22, left: 28 };
  const innerW = miniChartW - chartPad.left - chartPad.right;
  const innerH = miniChartH - chartPad.top - chartPad.bottom;
  const getMiniX = (index) => {
    const total = Math.max(effectiveTimesteps.length - 1, 1);
    return chartPad.left + (index / total) * innerW;
  };
  const getMiniY = (value) => {
    const clamped = Math.max(0, Math.min(value, chartMaxY));
    return chartPad.top + innerH - (clamped / chartMaxY) * innerH;
  };
  const sweepTargetX = getMiniX(activeSweepIdx);

  const liveCpuVal = parseFloat(liveMetrics.cpu?.latest) || 0;
  const liveRamVal = parseFloat(liveMetrics.ram?.latest) || 0;
  const liveLatVal = parseFloat(liveMetrics.latency?.latest) || 0;
  const liveReqVal = parseFloat(liveMetrics.request_rate?.latest) || 0;
  const live5xxVal = parseFloat(liveMetrics.http_5xx_rate?.latest) || 0;

  const effectiveMetricState = (cfg) => {
    const live = liveMetrics[cfg.key] || { latest: '0.00', avg: '0.00', isWarning: false };
    const isSimTriggered = isSimulating && flowState.activeMetrics.has(cfg.key);
    const isWarn = isSimulating ? isSimTriggered : live.isWarning;
    return { ...live, isWarning: isWarn, isSimTriggered };
  };

  const effectiveRuleChecks = ruleEngineChecks.map((rule) => {
    const isTriggered = isSimulating ? flowState.activeRules.has(rule.id) : rule.triggered;
    return { ...rule, effectiveTriggered: isTriggered };
  });
  const effectiveRuleTriggerCount = effectiveRuleChecks.filter((r) => r.effectiveTriggered).length;
  const isRuleActiveAny = effectiveRuleTriggerCount > 0;

  const effectiveRiskItems = riskNodes.map((node) => {
    const baseInfo = riskProbabilities[node.riskKey] || {
      prob: 0,
      isTriggered: false,
      thresholdPercent: Math.round(node.threshold * 100),
      probPercent: '0%',
    };
    const isTriggered = isSimulating ? flowState.activeRisks.has(node.riskKey) : baseInfo.isTriggered;
    const displayPercent = isSimulating && isTriggered ? `${Math.max(baseInfo.thresholdPercent + 8, 85)}%` : baseInfo.probPercent;
    return { ...node, ...baseInfo, effectiveTriggered: isTriggered, displayPercent };
  });
  const triggeredRiskItemsCount = effectiveRiskItems.filter((r) => r.effectiveTriggered).length;
  const warningMetricItemsCount = metricConfigs.filter((c) => effectiveMetricState(c).isWarning).length;

  // ==========================================
  // 4. TÍNH ĐƯỜNG DÂY SVG NỐI THẲNG MỖI THẺ → ĐÚNG THẺ ĐÍCH
  // ==========================================
  // 4.1: 01 Viễn trắc → 02 AI Hub
  const edgesMetricsToHub = isTelemetryExpanded
    ? metricConfigs.map((cfg, idx) => {
        const sy = M_START_Y + idx * (M_H + M_GAP) + M_H / 2;
        const sx = M_X + M_W;
        const ey = Math.round(HUB_Y + 42 + idx * ((HUB_H - 84) / Math.max(metricConfigs.length - 1, 1)));
        const mx = sx + (HUB_X - sx) * 0.5;
        const mState = effectiveMetricState(cfg);
        return {
          id: `d2-m-${cfg.key}`,
          pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${HUB_X} ${ey}`,
          active: mState.isWarning,
          animating: isAgentConnected || isSimulating,
          color: mState.isWarning ? '#EF4444' : cfg.color,
        };
      })
    : [
        {
          id: 'd2-m-compact',
          pathD: `M ${M_X + M_W} ${D2_MID_Y} C ${M_X + M_W + 35} ${D2_MID_Y}, ${HUB_X - 35} ${HUB_Y + HUB_H / 2}, ${HUB_X} ${HUB_Y + HUB_H / 2}`,
          active: warningMetricItemsCount > 0,
          animating: isAgentConnected || isSimulating,
          color: warningMetricItemsCount > 0 ? '#F59E0B' : '#10B981',
        },
      ];

  // Helper vẽ đường thẳng gãy khúc bo góc tròn (PCB parallel lanes, mỗi dây 1 làn riêng)
  const buildRoundedPolyline = (pts, radius = 10) => {
    if (!pts || pts.length < 2) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      const [nx, ny] = pts[i + 1];
      const dx1 = cx - px;
      const dy1 = cy - py;
      const dx2 = nx - cx;
      const dy2 = ny - cy;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      if (len1 < 0.5 || len2 < 0.5) {
        d += ` L ${cx} ${cy}`;
        continue;
      }
      const r = Math.min(radius, len1 / 2, len2 / 2);
      const bx = cx - (dx1 / len1) * r;
      const by = cy - (dy1 / len1) * r;
      const ax = cx + (dx2 / len2) * r;
      const ay = cy + (dy2 / len2) * r;
      d += ` L ${bx.toFixed(1)} ${by.toFixed(1)} Q ${cx} ${cy}, ${ax.toFixed(1)} ${ay.toFixed(1)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last[0]} ${last[1]}`;
    return d;
  };

  // 4.0A: 00 Target Service → 01 Viễn trắc (Luồng thu thập Metrics Server / Prometheus / Probe)
  const edgesServiceToTelemetry = isTelemetryExpanded
    ? metricConfigs.map((cfg, idx) => {
        const sx = SV_X + SV_W;
        const sy = SV_Y + 46 + idx * 14;
        const ey = M_START_Y + idx * (M_H + M_GAP) + M_H / 2;
        const mx = sx + (M_X - sx) * 0.5;
        const mState = effectiveMetricState(cfg);
        return {
          id: `d2-sv-to-m-${cfg.key}`,
          pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${M_X} ${ey}`,
          active: mState.isWarning,
          animating: isAgentConnected || isSimulating,
          color: mState.isWarning ? '#EF4444' : cfg.color,
        };
      })
    : [
        {
          id: 'd2-sv-to-m-compact',
          pathD: buildRoundedPolyline(
            [
              [SV_X + SV_W, SV_Y + 96],
              [Math.round(SV_X + SV_W + (M_X - (SV_X + SV_W)) * 0.5), SV_Y + 96],
              [Math.round(SV_X + SV_W + (M_X - (SV_X + SV_W)) * 0.5), D2_MID_Y],
              [M_X, D2_MID_Y],
            ],
            12
          ),
          active: warningMetricItemsCount > 0 || flowState.isFlowActive,
          animating: isAgentConnected || isSimulating,
          color: warningMetricItemsCount > 0 ? '#F59E0B' : '#10B981',
        },
      ];

  // 4.0B: Cách A — 00 Target Service → Log Agent & K8s Event Agent (tách rãnh đáy không vắt ngang 02 & 03)
  const isLogCollectorActive = Boolean(flowState.isFlowActive && flowState.activeAgents.has('log'));
  const isK8sCollectorActive = Boolean(flowState.isFlowActive && flowState.activeAgents.has('k8s_event'));
  const svLogOutY = SV_Y + 206;
  const svEvOutY = SV_Y + 238;
  const logDropX = SV_X + SV_W + 46;
  const evDropX = SV_X + SV_W + 24;
  const logRiseX = AG_X - 48;
  const evRiseX = AG_X - 28;
  const agLogEntryY = AG_START_Y + 1 * (AG_H + AG_GAP) + 84;
  const agEvEntryY = AG_START_Y + 2 * (AG_H + AG_GAP) + 84;

  const edgesServiceToAgents = [
    {
      id: 'd2-sv-to-log-agent',
      pathD: buildRoundedPolyline(
        [
          [SV_X + SV_W, svLogOutY],
          [logDropX, svLogOutY],
          [logDropX, LOG_COLLECT_BUS_Y],
          [logRiseX, LOG_COLLECT_BUS_Y],
          [logRiseX, agLogEntryY],
          [AG_X, agLogEntryY],
        ],
        12
      ),
      active: isLogCollectorActive,
      animating: isAgentConnected || isSimulating,
      color: isLogCollectorActive ? '#D97706' : '#F59E0B',
      hasCollectorArrow: isLogCollectorActive,
    },
    {
      id: 'd2-sv-to-k8s-agent',
      pathD: buildRoundedPolyline(
        [
          [SV_X + SV_W, svEvOutY],
          [evDropX, svEvOutY],
          [evDropX, EVENT_COLLECT_BUS_Y],
          [evRiseX, EVENT_COLLECT_BUS_Y],
          [evRiseX, agEvEntryY],
          [AG_X, agEvEntryY],
        ],
        12
      ),
      active: isK8sCollectorActive,
      animating: isAgentConnected || isSimulating,
      color: isK8sCollectorActive ? '#059669' : '#10B981',
      hasCollectorArrow: isK8sCollectorActive,
    },
  ];

  // 4.2: 01 Viễn trắc → Rule Engine Hàng Ngang (đường thẳng bo góc tròn, mỗi dây tách 1 làn riêng biệt)
  const edgesMetricsToRules = [];
  if (isRuleExpanded) {
    let metricRuleLaneIdx = 0;
    effectiveRuleChecks.forEach((rule) => {
      const rIdx = effectiveRuleChecks.indexOf(rule);
      const ruleLeft = RULE_ROW_X + rIdx * (RULE_CARD_W + RULE_CARD_GAP);
      const ryIn = RULE_ROW_Y + RULE_ROW_H;
      const spec = RULE_AGENT_MAP[rule.id] || { sourceMetrics: [] };
      const isRuleTrig = rule.effectiveTriggered;

      if (isTelemetryExpanded) {
        const srcList = spec.sourceMetrics || [];
        srcList.forEach((mKey, sIdx) => {
          const mIdx = metricConfigs.findIndex((m) => m.key === mKey);
          if (mIdx < 0) return;
          const lane = metricRuleLaneIdx++;
          const mY = M_START_Y + mIdx * (M_H + M_GAP) + M_H / 2;
          const mState = effectiveMetricState(metricConfigs[mIdx]);
          const activeLink = Boolean(isRuleTrig || mState.isWarning);
          const sx = M_X + M_W;
          const rxIn = Math.round(ruleLeft + RULE_CARD_W * 0.5 + (sIdx - (srcList.length - 1) / 2) * 32);
          const busX = M_X + M_W + 24 + lane * 12;
          const busY = ryIn + 18 + lane * 10;
          edgesMetricsToRules.push({
            id: `d2-m-${mKey}-to-${rule.id}`,
            pathD: buildRoundedPolyline(
              [
                [sx, mY],
                [busX, mY],
                [busX, busY],
                [rxIn, busY],
                [rxIn, ryIn],
              ],
              10
            ),
            active: activeLink,
            color: activeLink ? '#EA580C' : '#CBD5E1',
          });
        });
      } else {
        const lane = metricRuleLaneIdx++;
        const sx = M_X + M_W;
        const rxIn = Math.round(ruleLeft + RULE_CARD_W * 0.5);
        const busX = M_X + M_W + 32 + lane * 14;
        const busY = ryIn + 20 + lane * 12;
        edgesMetricsToRules.push({
          id: `d2-compact-to-${rule.id}`,
          pathD: buildRoundedPolyline(
            [
              [sx, D2_MID_Y],
              [busX, D2_MID_Y],
              [busX, busY],
              [rxIn, busY],
              [rxIn, ryIn],
            ],
            11
          ),
          active: isRuleTrig,
          color: isRuleTrig ? '#EA580C' : '#CBD5E1',
        });
      }
    });
  } else {
    const targetY = RULE_COMPACT_Y + RULE_COMPACT_H / 2;
    const sx = M_X + M_W;
    if (isTelemetryExpanded) {
      metricConfigs.forEach((cfg, mIdx) => {
        const mY = M_START_Y + mIdx * (M_H + M_GAP) + M_H / 2;
        const mState = effectiveMetricState(cfg);
        const busX = M_X + M_W + 30 + mIdx * 12;
        const yIn = targetY + (mIdx - (metricConfigs.length - 1) / 2) * 4;
        edgesMetricsToRules.push({
          id: `d2-m-${cfg.key}-to-rule-compact`,
          pathD: buildRoundedPolyline(
            [
              [sx, mY],
              [busX, mY],
              [busX, yIn],
              [RULE_COMPACT_X, yIn],
            ],
            10
          ),
          active: Boolean(mState.isWarning && isRuleActiveAny),
          color: mState.isWarning && isRuleActiveAny ? '#EA580C' : '#CBD5E1',
        });
      });
    } else {
      const busX = Math.round((sx + RULE_COMPACT_X) / 2);
      edgesMetricsToRules.push({
        id: 'd2-m-to-rule-compact',
        pathD: buildRoundedPolyline(
          [
            [sx, D2_MID_Y],
            [busX, D2_MID_Y],
            [busX, targetY],
            [RULE_COMPACT_X, targetY],
          ],
          14
        ),
        active: isRuleActiveAny,
        animating: isAgentConnected || isSimulating,
        color: isRuleActiveAny ? '#EA580C' : '#F59E0B',
      });
    }
  }

  // 4.3: 02 AI Hub → 03 7 Đầu Rủi Ro
  const hubOutPort = { x: HUB_X + HUB_W, y: HUB_Y + HUB_H / 2 };
  const edgesHubToRisks = isRisksExpanded
    ? effectiveRiskItems.map((node, idx) => {
        const ey = R_START_Y + idx * (R_H + R_GAP) + R_H / 2;
        const mx = hubOutPort.x + (R_X - hubOutPort.x) * 0.5;
        const isOpt = node.riskKey === 'SCALE_DOWN_CANDIDATE';
        return {
          id: `d2-r-${node.id}`,
          pathD: `M ${hubOutPort.x} ${hubOutPort.y} C ${mx} ${hubOutPort.y}, ${mx} ${ey}, ${R_X} ${ey}`,
          active: node.effectiveTriggered,
          color: node.effectiveTriggered ? (isOpt ? '#0284C7' : '#EF4444') : '#CBD5E1',
        };
      })
    : [
        {
          id: 'd2-r-compact',
          pathD: `M ${hubOutPort.x} ${hubOutPort.y} L ${R_X} ${R_COMPACT_Y + R_COMPACT_H / 2}`,
          active: triggeredRiskItemsCount > 0,
          color: triggeredRiskItemsCount > 0 ? '#EF4444' : '#CBD5E1',
        },
      ];

  // 4.4: Rule Engine Hàng Ngang (R1..R6) → ĐÚNG các Agent liên quan (mỗi dây 1 làn bo góc tách riêng, không chập đường)
  const edgesRulesToAgents = [];
  if (isRuleExpanded) {
    let ruleAgentRank = 0;
    effectiveRuleChecks.forEach((rule, rIdx) => {
      const ruleLeft = RULE_ROW_X + rIdx * (RULE_CARD_W + RULE_CARD_GAP);
      const ryOut = RULE_ROW_Y;
      const spec = RULE_AGENT_MAP[rule.id] || { agents: ['metrics', 'k8s_event'] };
      const isTrig = rule.effectiveTriggered;
      const sortedTargets = [...(spec.agents || [])]
        .map((agId) => ({
          agId,
          agIdx: BRANCHED_CONTEXT_AGENTS.findIndex((a) => a.id === agId),
        }))
        .filter((item) => item.agIdx >= 0)
        .sort((a, b) => a.agIdx - b.agIdx);

      sortedTargets.forEach(({ agId, agIdx }, sIdx) => {
        const rank = ruleAgentRank++;
        const agY = Math.round(AG_START_Y + agIdx * (AG_H + AG_GAP) + AG_H / 2 + (rIdx - 2.5) * 3);
        const rxOut = Math.round(ruleLeft + RULE_CARD_W * 0.5 + (sIdx - (sortedTargets.length - 1) / 2) * 26);
        const laneY = Math.round(topOffset + 108 + rank * 5.8);
        const dropX = Math.round(AG_X - 75 - rank * 9.5);
        edgesRulesToAgents.push({
          id: `d2-rule-${rule.id}-ag-${agId}`,
          pathD: buildRoundedPolyline(
            [
              [rxOut, ryOut],
              [rxOut, laneY],
              [dropX, laneY],
              [dropX, agY],
              [AG_X, agY],
            ],
            10
          ),
          active: isTrig,
          color: isTrig ? '#EA580C' : '#CBD5E1',
          hasArrow: isTrig,
        });
      });
    });
  } else {
    const activeRuleTargets = new Set(
      effectiveRuleChecks
        .filter((r) => r.effectiveTriggered)
        .flatMap((r) => RULE_AGENT_MAP[r.id]?.agents || [])
    );
    const sx = RULE_COMPACT_X + RULE_COMPACT_W;
    const sy = RULE_COMPACT_Y + RULE_COMPACT_H / 2;
    BRANCHED_CONTEXT_AGENTS.forEach((ag, agIdx) => {
      const agY = AG_START_Y + agIdx * (AG_H + AG_GAP) + AG_H / 2;
      const isRuleTarget = activeRuleTargets.has(ag.id);
      const exitY = Math.round(sy + (agIdx - 1.5) * 9);
      const dropX = AG_X - 75 - agIdx * 20;
      edgesRulesToAgents.push({
        id: `d2-rule-compact-ag-${ag.id}`,
        pathD: buildRoundedPolyline(
          [
            [sx, exitY],
            [dropX, exitY],
            [dropX, agY],
            [AG_X, agY],
          ],
          12
        ),
        active: isRuleTarget,
        color: isRuleTarget ? '#EA580C' : '#CBD5E1',
        hasArrow: isRuleTarget,
      });
    });
  }

  // 4.5: Cột 03 (7 Đầu Rủi Ro) → ĐÚNG các Agent liên quan (theo RISK_AGENT_MAP)
  const edgesSignalsToAgents = [];
  if (isRisksExpanded) {
    effectiveRiskItems.forEach((node, rIdx) => {
      const sy = R_START_Y + rIdx * (R_H + R_GAP) + R_H / 2;
      const sx = R_X + R_W;
      const targetAgIds = RISK_AGENT_MAP[node.riskKey] || ['metrics', 'k8s_event'];
      targetAgIds.forEach((agId) => {
        const agIdx = BRANCHED_CONTEXT_AGENTS.findIndex((a) => a.id === agId);
        if (agIdx < 0) return;
        const ag = BRANCHED_CONTEXT_AGENTS[agIdx];
        const agY = AG_START_Y + agIdx * (AG_H + AG_GAP) + AG_H / 2;
        const isAgActive = flowState.isFlowActive && flowState.activeAgents.has(ag.id);
        const mx = sx + (AG_X - sx) * 0.52;
        edgesSignalsToAgents.push({
          id: `d2-sig-${node.id}-ag-${ag.id}`,
          pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${agY}, ${AG_X} ${agY}`,
          active: Boolean(node.effectiveTriggered && isAgActive),
          color: node.effectiveTriggered && isAgActive ? ag.color : '#CBD5E1',
        });
      });
    });
  } else {
    BRANCHED_CONTEXT_AGENTS.forEach((ag, agIdx) => {
      const agY = AG_START_Y + agIdx * (AG_H + AG_GAP) + AG_H / 2;
      const isAgActive = flowState.isFlowActive && flowState.activeAgents.has(ag.id);
      const sx = R_X + R_W;
      const sy = R_COMPACT_Y + R_COMPACT_H / 2;
      const mx = sx + (AG_X - sx) * 0.5;
      edgesSignalsToAgents.push({
        id: `d2-sig-compact-ag-${ag.id}`,
        pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${agY}, ${AG_X} ${agY}`,
        active: Boolean(isAgActive && (triggeredRiskItemsCount > 0 || flowState.isFlowActive)),
        color: ag.color,
      });
    });
  }

  // 4.6: 04A 4 Agent → 04B 16 Nguyên Nhân Gốc
  const targetCauseIndex = flowState.activeCauseObj
    ? BRANCHED_ROOT_CAUSES.findIndex((c) => c.code === flowState.activeCauseObj.code)
    : -1;
  const activeCausePortY = isCausesExpanded
    ? targetCauseIndex >= 0
      ? RC_START_Y + targetCauseIndex * (RC_ITEM_H + RC_ITEM_GAP) + RC_ITEM_H / 2
      : D2_MID_Y
    : D2_MID_Y;

  const edgesAgentsToCauses = [];
  if (isCausesExpanded) {
    BRANCHED_CONTEXT_AGENTS.forEach((ag, agIdx) => {
      const sy = AG_START_Y + agIdx * (AG_H + AG_GAP) + AG_H / 2;
      const sx = AG_X + AG_W;
      const isAgActive = flowState.isFlowActive && flowState.activeAgents.has(ag.id);

      [agIdx * 4, agIdx * 4 + 1, agIdx * 4 + 2, Math.min(agIdx * 4 + 3, 15)].forEach((cIdx) => {
        if (cIdx === targetCauseIndex) return;
        const ey = RC_START_Y + cIdx * (RC_ITEM_H + RC_ITEM_GAP) + RC_ITEM_H / 2;
        const mx = sx + (RC_X - sx) * 0.5;
        edgesAgentsToCauses.push({
          id: `d2-ag-${ag.id}-bg-${cIdx}`,
          pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${RC_X} ${ey}`,
          active: false,
          color: '#CBD5E1',
        });
      });

      if (targetCauseIndex >= 0) {
        const mx = sx + (RC_X - sx) * 0.5;
        edgesAgentsToCauses.push({
          id: `d2-ag-${ag.id}-active-${targetCauseIndex}`,
          pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${activeCausePortY}, ${RC_X} ${activeCausePortY}`,
          active: isAgActive,
          color: isAgActive ? ag.color : '#CBD5E1',
        });
      }
    });
  } else {
    BRANCHED_CONTEXT_AGENTS.forEach((ag, agIdx) => {
      const sy = AG_START_Y + agIdx * (AG_H + AG_GAP) + AG_H / 2;
      const sx = AG_X + AG_W;
      const ey = RC_COMPACT_Y + 52 + agIdx * 62;
      const mx = sx + (RC_X - sx) * 0.5;
      const isAgActive = flowState.isFlowActive && flowState.activeAgents.has(ag.id);
      edgesAgentsToCauses.push({
        id: `d2-ag-${ag.id}-compact`,
        pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${RC_X} ${ey}`,
        active: isAgActive,
        color: ag.color,
      });
    });
  }

  // 4.7: 04B 16 Nguyên Nhân → 05 Policy
  const edgesCausesToPolicy = isCausesExpanded
    ? BRANCHED_ROOT_CAUSES.map((cause, idx) => {
        const sy = RC_START_Y + idx * (RC_ITEM_H + RC_ITEM_GAP) + RC_ITEM_H / 2;
        const sx = RC_X + RC_W;
        const isTarget = flowState.isFlowActive && flowState.activeCauseObj?.code === cause.code;
        const mx = sx + (PL_X - sx) * 0.5;
        return {
          id: `d2-cause-${cause.code}-policy`,
          pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${D2_MID_Y}, ${PL_X} ${D2_MID_Y}`,
          active: isTarget,
          color: isTarget ? cause.color : '#CBD5E1',
        };
      })
    : [
        {
          id: 'd2-cause-compact-policy',
          pathD: `M ${RC_X + RC_W} ${D2_MID_Y} L ${PL_X} ${D2_MID_Y}`,
          active: flowState.isFlowActive,
          color: flowState.activeCauseObj?.color || '#7C3AED',
        },
      ];

  // 4.8: 05 Policy → 06A 10 Action
  const edgesPolicyToActions = isActionsExpanded
    ? BRANCHED_ACTIONS.map((act, idx) => {
        const ey = AC_START_Y + idx * (AC_ITEM_H + AC_ITEM_GAP) + AC_ITEM_H / 2;
        const sx = PL_X + PL_W;
        const isCurrentTarget = flowState.isFlowActive && flowState.effectiveDisplayActionObj?.code === act.code;
        const isInitialAttempted =
          flowState.isFlowActive &&
          flowState.isUnrecoveredLoop &&
          flowState.activeActionObj?.code === act.code &&
          flowState.effectiveDisplayActionObj?.code !== act.code;
        const mx = sx + (AC_X - sx) * 0.5;
        return {
          id: `d2-policy-act-${act.code}`,
          pathD: `M ${sx} ${D2_MID_Y} C ${mx} ${D2_MID_Y}, ${mx} ${ey}, ${AC_X} ${ey}`,
          active: isCurrentTarget,
          secondary: isInitialAttempted,
          color: isCurrentTarget ? (flowState.isUnrecoveredLoop ? '#EA580C' : act.color) : isInitialAttempted ? '#94A3B8' : '#CBD5E1',
        };
      })
    : [
        {
          id: 'd2-policy-act-compact',
          pathD: `M ${PL_X + PL_W} ${D2_MID_Y} L ${AC_X} ${D2_MID_Y}`,
          active: flowState.isFlowActive,
          color: flowState.isUnrecoveredLoop ? '#EA580C' : flowState.effectiveDisplayActionObj?.color || '#D97706',
        },
      ];

  // 4.9: 06A 10 Action → 06B 3 Cổng → 07 Hậu Kiểm 60s
  const policyGateCards = [
    { ...POLICY_BRANCH_META.AUTO, y: GT_START_Y },
    { ...POLICY_BRANCH_META.HITL, y: GT_START_Y + GT_H + GT_GAP },
    { ...POLICY_BRANCH_META.AUDIT, y: GT_START_Y + 2 * (GT_H + GT_GAP) },
  ];
  const activeActIdx = flowState.effectiveDisplayActionObj
    ? BRANCHED_ACTIONS.findIndex((a) => a.code === flowState.effectiveDisplayActionObj.code)
    : -1;
  const activeActionPortY =
    isActionsExpanded && activeActIdx >= 0
      ? AC_START_Y + activeActIdx * (AC_ITEM_H + AC_ITEM_GAP) + AC_ITEM_H / 2
      : D2_MID_Y;

  const edgesActionsToGates = policyGateCards.map((gate) => {
    const isActiveGate = flowState.isFlowActive && flowState.effectivePolicyBranch === gate.code;
    const sx = AC_X + AC_W;
    const sy = isActiveGate ? activeActionPortY : D2_MID_Y;
    const ey = gate.y + GT_H / 2;
    const mx = sx + (GT_X - sx) * 0.5;
    return {
      id: `d2-act-gate-${gate.code}`,
      pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${GT_X} ${ey}`,
      active: isActiveGate,
      color: gate.color,
    };
  });

  const edgesGatesToVerify = policyGateCards.map((gate) => {
    const isActiveGate = flowState.isFlowActive && flowState.effectivePolicyBranch === gate.code;
    const sx = GT_X + GT_W;
    const sy = gate.y + GT_H / 2;
    const ey = D2_MID_Y;
    const mx = sx + (VF_X - sx) * 0.5;
    return {
      id: `d2-gate-verify-${gate.code}`,
      pathD: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${VF_X} ${ey}`,
      active: isActiveGate,
      color: gate.color,
    };
  });

  // 4.10: HAI ĐƯỜNG VÒNG LẶP KHÉP KÍN TỪ 07 HẬU KIỂM 60S
  const verifyBottomResolveX = VF_X + VF_W * 0.34;
  const verifyBottomEscalateX = VF_X + VF_W * 0.68;
  const verifyBottomY = VF_Y + VF_H;
  const serviceBottomX = SV_X + SV_W / 2;
  const serviceBottomY = SV_Y + SV_H;
  const rcaBottomX = RC_X + RC_W / 2;
  const rcaBottomY = isCausesExpanded ? RC_START_Y + RC_TOTAL_H : RC_COMPACT_Y + RC_COMPACT_H;

  const d2FeedbackResolvePath = `M ${verifyBottomResolveX} ${verifyBottomY} L ${verifyBottomResolveX} ${FEEDBACK_RESOLVE_Y - 16} Q ${verifyBottomResolveX} ${FEEDBACK_RESOLVE_Y} ${verifyBottomResolveX - 16} ${FEEDBACK_RESOLVE_Y} L ${serviceBottomX + 16} ${FEEDBACK_RESOLVE_Y} Q ${serviceBottomX} ${FEEDBACK_RESOLVE_Y} ${serviceBottomX} ${FEEDBACK_RESOLVE_Y - 16} L ${serviceBottomX} ${serviceBottomY + 8}`;
  const d2FeedbackEscalatePath = `M ${verifyBottomEscalateX} ${verifyBottomY} L ${verifyBottomEscalateX} ${FEEDBACK_ESCALATE_Y - 16} Q ${verifyBottomEscalateX} ${FEEDBACK_ESCALATE_Y} ${verifyBottomEscalateX - 16} ${FEEDBACK_ESCALATE_Y} L ${rcaBottomX + 16} ${FEEDBACK_ESCALATE_Y} Q ${rcaBottomX} ${FEEDBACK_ESCALATE_Y} ${rcaBottomX} ${FEEDBACK_ESCALATE_Y - 16} L ${rcaBottomX} ${rcaBottomY + 8}`;

  const causeTriggers = flowState.activeMetrics;
  const liveRestartsNum = Number(liveMetrics.pod_restart_count?.latest || 0);
  const verificationChecks = isSimulating
    ? [
        {
          label: 'CPU / RAM',
          ok: !(flowState.isUnrecoveredLoop && (causeTriggers.has('cpu') || causeTriggers.has('ram'))),
          failText: 'Còn vượt ngưỡng',
          okText: 'An toàn',
        },
        {
          label: 'Độ trễ (Latency)',
          ok: !(flowState.isUnrecoveredLoop && (causeTriggers.has('latency') || causeTriggers.has('request_rate') || causeTriggers.size === 0)),
          failText: '> 600ms (Chưa giảm)',
          okText: '< 600ms (Đạt)',
        },
        {
          label: 'Lỗi HTTP 5xx',
          ok: !(flowState.isUnrecoveredLoop && causeTriggers.has('http_5xx_rate')),
          failText: 'Còn lỗi 5xx',
          okText: '0% lỗi',
        },
        {
          label: 'Pod & Restart Δ',
          ok: !(flowState.isUnrecoveredLoop && (causeTriggers.has('pod_restart_count') || causeTriggers.has('replica_count') || causeTriggers.has('disk'))),
          failText: 'Chưa ổn định',
          okText: 'Ready (Δ=0)',
        },
      ]
    : [
        {
          label: 'CPU / RAM',
          ok: verifyOutcomeMode !== 'unrecovered' && liveCpuVal <= 80 && liveRamVal <= 85,
          failText: `${liveCpuVal.toFixed(0)}% / ${liveRamVal.toFixed(0)}%`,
          okText: `${liveCpuVal.toFixed(0)}% / ${liveRamVal.toFixed(0)}% ✓`,
        },
        {
          label: 'Độ trễ (Latency)',
          ok: verifyOutcomeMode !== 'unrecovered' && liveLatVal <= 600,
          failText: `${liveLatVal.toFixed(0)}ms (>600)`,
          okText: `${liveLatVal.toFixed(0)}ms ✓`,
        },
        {
          label: 'Lỗi HTTP 5xx',
          ok: verifyOutcomeMode !== 'unrecovered' && live5xxVal <= 5,
          failText: `${live5xxVal.toFixed(1)}% (>5%)`,
          okText: `${live5xxVal.toFixed(1)}% ✓`,
        },
        {
          label: 'Pod & Restart Δ',
          ok: verifyOutcomeMode !== 'unrecovered' && liveRestartsNum === 0,
          failText: `${liveRestartsNum} restarts`,
          okText: `Ready (${podCount}p)`,
        },
      ];

  const renderAnimatedEdge = (edge, widthActive = 2.6, widthIdle = 1.4, dur = '1.75s') => {
    let resolvedMarker = undefined;
    if (edge.hasArrow && edge.active) resolvedMarker = 'url(#d2-arrow-rule)';
    else if (edge.id === 'd2-sv-to-log-agent') resolvedMarker = edge.active ? 'url(#d2-arrow-log)' : 'url(#d2-arrow-idle)';
    else if (edge.id === 'd2-sv-to-k8s-agent') resolvedMarker = edge.active ? 'url(#d2-arrow-k8s)' : 'url(#d2-arrow-idle)';
    return (
      <g key={edge.id}>
        <path
          d={edge.pathD}
          fill="none"
          stroke={edge.active ? edge.color : edge.secondary ? '#94A3B8' : '#CBD5E1'}
          strokeWidth={edge.active ? widthActive : edge.secondary ? 1.8 : widthIdle}
          strokeLinecap="round"
          strokeDasharray={edge.active ? 'none' : edge.secondary ? '5 3' : '4 3'}
          opacity={edge.active ? 1 : edge.secondary ? 0.85 : flowState.isFlowActive ? 0.65 : 0.82}
          markerEnd={resolvedMarker}
        />
        {(edge.active || edge.animating) && (
          <circle r={edge.active ? '4' : '3.2'} fill={edge.color}>
            <animateMotion path={edge.pathD} dur={edge.active ? dur : '2.7s'} repeatCount="indefinite" rotate="auto" />
          </circle>
        )}
      </g>
    );
  };

  // Vẽ dây xám nền trước, dây màu luồng chính đang hoạt động đè lên trên để không bị cắt nét
  const renderEdgeLayer = (edges, widthActive, widthIdle, dur) => (
    <>
      {edges.filter((e) => !e.active).map((e) => renderAnimatedEdge(e, widthActive, widthIdle, dur))}
      {edges.filter((e) => e.active).map((e) => renderAnimatedEdge(e, widthActive, widthIdle, dur))}
    </>
  );

  // Stage Pills bám gọn đúng ngay trên đầu từng cột thẻ!
  const stagePills = [
    {
      step: '00',
      label: 'TARGET SERVICE',
      x: SV_X,
      w: SV_W,
      top: SV_Y - 36,
      color: '#0F172A',
      bg: '#F1F5F9',
      border: '#CBD5E1',
      testId: 'd2-pill-00',
    },
    {
      step: '01',
      label: 'VIỄN TRẮC (8)',
      x: M_X,
      w: M_W,
      top: (isTelemetryExpanded ? M_START_Y : M_COMPACT_Y) - 36,
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      isOpen: isTelemetryExpanded,
      onToggle: onToggleTelemetry,
    },
    {
      step: '02',
      label: 'DỰ BÁO CHUỖI THỜI GIAN (AI)',
      x: HUB_X,
      w: HUB_W,
      top: HUB_Y - 36,
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#BFDBFE',
    },
    {
      step: 'RULE',
      label: 'RULE ENGINE (6 LUẬT HÀNG NGANG)',
      x: isRuleExpanded ? RULE_ROW_X : RULE_COMPACT_X,
      w: isRuleExpanded ? RULE_ROW_TOTAL_W : RULE_COMPACT_W,
      top: isRuleExpanded ? RULE_ROW_Y - 134 : RULE_COMPACT_Y - 36,
      color: '#EA580C',
      bg: '#FFF7ED',
      border: '#FED7AA',
      isOpen: isRuleExpanded,
      onToggle: onToggleRule,
    },
    {
      step: '03',
      label: '7 ĐẦU RỦI RO AI',
      x: R_X,
      w: R_W,
      top: (isRisksExpanded ? R_START_Y : R_COMPACT_Y) - 36,
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA',
      isOpen: isRisksExpanded,
      onToggle: onToggleRisks,
    },
    {
      step: '04A',
      label: '4 AGENT ĐỘC LẬP',
      x: AG_X,
      w: AG_W,
      top: AG_START_Y - 36,
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#BFDBFE',
    },
    {
      step: '04B',
      label: '16 NGUYÊN NHÂN GỐC',
      x: RC_X,
      w: RC_W,
      top: (isCausesExpanded ? RC_START_Y : RC_COMPACT_Y) - 36,
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE',
      isOpen: isCausesExpanded,
      onToggle: onToggleCauses,
    },
    {
      step: '05',
      label: 'RECOMMENDATION & POLICY',
      x: PL_X,
      w: PL_W,
      top: PL_Y - 36,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
    },
    {
      step: '06A',
      label: '10 HÀNH ĐỘNG (ACTION)',
      x: AC_X,
      w: AC_W,
      top: (isActionsExpanded ? AC_START_Y : AC_COMPACT_Y) - 36,
      color: '#0F766E',
      bg: '#F0FDFA',
      border: '#99F6E4',
      isOpen: isActionsExpanded,
      onToggle: onToggleActions,
    },
    {
      step: '06B',
      label: 'CỔNG ĐIỀU PHỐI K8S',
      x: GT_X,
      w: GT_W,
      top: GT_START_Y - 36,
      color: '#B45309',
      bg: '#FFF7ED',
      border: '#FED7AA',
    },
    {
      step: '07',
      label: 'HẬU KIỂM 60S',
      x: VF_X,
      w: VF_W,
      top: VF_Y - 36,
      color: '#0284C7',
      bg: '#F0F9FF',
      border: '#BAE6FD',
    },
  ];

  const allBranchesExpanded =
    isTelemetryExpanded && isRuleExpanded && isRisksExpanded && isCausesExpanded && isActionsExpanded;

  return (
    <div data-testid="branched-pipeline-section">
      {/* ============================================================ */}
      {/* BANNER ĐIỀU KHIỂN SƠ ĐỒ 2                                    */}
      {/* ============================================================ */}
      <div
        style={{
          position: 'absolute',
          left: '16px',
          top: `${BANNER_Y}px`,
          width: `${canvasWidth - 36}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '10px 18px',
          borderRadius: '14px',
          backgroundColor: isSimulating ? '#FAF5FF' : '#F8FAFC',
          border: `1.5px solid ${isSimulating ? '#C4B5FD' : '#CBD5E1'}`,
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
          boxSizing: 'border-box',
          zIndex: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', backgroundColor: isSimulating ? '#EDE9FE' : '#E0F2FE', color: isSimulating ? '#7C3AED' : '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GitBranch size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
              Sơ Đồ 2 • Kiến Trúc Toàn Luồng (00 Service → 8 Metric • 6 Rule • 7 Risk • 4 Agent • 16 Nguyên Nhân • 10 Action • 07)
            </div>
            <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
              Khối 00 Service thu thập qua 3 luồng (Metrics/Probe → 01, LogsCollector → Log Agent, EventsCollector → K8s Event Agent); bấm từng nguyên nhân để mô phỏng luồng sáng.
            </div>
          </div>
        </div>

        <div onMouseDown={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span
            data-testid="d2-mode-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '0.74rem',
              fontWeight: 800,
              backgroundColor: isSimulating ? (isUnrecoveredLoop ? '#FEE2E2' : '#EDE9FE') : flowState.isFlowActive ? '#FEF2F2' : '#ECFDF5',
              color: isSimulating ? (isUnrecoveredLoop ? '#DC2626' : '#6D28D9') : flowState.isFlowActive ? '#DC2626' : '#059669',
              border: `1px solid ${isSimulating ? (isUnrecoveredLoop ? '#FCA5A5' : '#C4B5FD') : flowState.isFlowActive ? '#FCA5A5' : '#A7F3D0'}`,
            }}
          >
            {isSimulating ? <Play size={12} /> : <Activity size={12} />}
            <span>
              {flowState.isUnrecoveredLoop && flowState.activeCauseObj
                ? `${flowState.liveModeLabel} (Chưa hồi phục → Leo thang ${flowState.effectiveDisplayActionObj?.code})`
                : flowState.liveModeLabel}
            </span>
          </span>

          {isSimulating && (
            <button type="button" data-testid="d2-back-to-live-btn" onClick={(e) => { e.stopPropagation(); onClearSimulation(); }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #7C3AED', backgroundColor: '#7C3AED', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              Về dữ liệu thực (Live)
            </button>
          )}

          <button type="button" data-testid="d2-toggle-all-btn" onClick={() => onToggleAllBranches(!allBranchesExpanded)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #93C5FD', backgroundColor: allBranchesExpanded ? '#2563EB' : '#EFF6FF', color: allBranchesExpanded ? '#FFFFFF' : '#1D4ED8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
            {allBranchesExpanded ? '− Thu gọn tất cả' : '+ Mở rộng tất cả'}
          </button>

          <button type="button" data-testid="d2-toggle-causes-btn" onClick={onToggleCauses} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #C4B5FD', backgroundColor: isCausesExpanded ? '#7C3AED' : '#FFFFFF', color: isCausesExpanded ? '#FFFFFF' : '#6D28D9', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
            {isCausesExpanded ? '− Thu gọn 16 RCA' : '+ Mở 16 Nguyên nhân'}
          </button>

          <button type="button" data-testid="d2-toggle-actions-btn" onClick={onToggleActions} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #99F6E4', backgroundColor: isActionsExpanded ? '#0F766E' : '#FFFFFF', color: isActionsExpanded ? '#FFFFFF' : '#0F766E', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
            {isActionsExpanded ? '− Thu gọn 10 Action' : '+ Mở 10 Action'}
          </button>
        </div>
      </div>

      {/* Stage Header Pills bám ngay trên đầu từng cột */}
      {stagePills.map((col) => (
        <div key={col.step} style={{ position: 'absolute', left: `${col.x}px`, top: `${col.top}px`, width: `${col.w}px`, display: 'flex', justifyContent: 'center', zIndex: 14, pointerEvents: col.onToggle ? 'auto' : 'none' }}>
          <span
            data-testid={col.testId || (col.onToggle ? `d2-pill-${col.step}` : undefined)}
            onMouseDown={col.onToggle ? (e) => e.stopPropagation() : undefined}
            onClick={col.onToggle}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '999px', backgroundColor: col.bg, border: `1px solid ${col.border}`, color: col.color, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.03em', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)', cursor: col.onToggle ? 'pointer' : 'default' }}
          >
            <span style={{ opacity: 0.7 }}>{col.step}</span>
            <span>{col.label}</span>
            {col.onToggle && (
              <span style={{ marginLeft: '2px', padding: '0 5px', borderRadius: '999px', backgroundColor: '#FFFFFF', border: `1px solid ${col.border}`, fontSize: '0.6rem', fontWeight: 800 }}>
                {col.isOpen ? '− Gọn' : '+ Mở'}
              </span>
            )}
          </span>
        </div>
      ))}

      {/* ============================================================ */}
      {/* SVG ĐƯỜNG NỐI TOÀN LUỒNG SƠ ĐỒ 2                             */}
      {/* ============================================================ */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: `${canvasWidth}px`, height: `${FEEDBACK_ESCALATE_Y + 45}px`, pointerEvents: 'none', zIndex: 1 }}>
        <defs>
          <marker id="d2-arrow-feedback" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284C7" />
          </marker>
          <marker id="d2-arrow-escalate" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#DC2626" />
          </marker>
          <marker id="d2-arrow-rule" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill={isRuleActiveAny ? '#EA580C' : '#94A3B8'} />
          </marker>
          <marker id="d2-arrow-log" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#D97706" />
          </marker>
          <marker id="d2-arrow-k8s" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#059669" />
          </marker>
          <marker id="d2-arrow-idle" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#CBD5E1" />
          </marker>
        </defs>

        {renderEdgeLayer(edgesServiceToTelemetry, 2.5, 1.7, '2.2s')}
        {renderEdgeLayer(edgesServiceToAgents, 2.5, 1.55, '2.6s')}
        {renderEdgeLayer(edgesMetricsToHub, 2.5, 1.8, '2.5s')}
        {renderEdgeLayer(edgesMetricsToRules, 2.4, 1.4, '2.1s')}
        {renderEdgeLayer(edgesHubToRisks, 2.6, 1.7, '1.8s')}
        {renderEdgeLayer(edgesRulesToAgents, 2.7, 1.4, '1.65s')}
        {renderEdgeLayer(edgesSignalsToAgents, 2.6, 1.4, '1.7s')}
        {renderEdgeLayer(edgesAgentsToCauses, 2.8, 1.4, '1.6s')}
        {renderEdgeLayer(edgesCausesToPolicy, 3.0, 1.4, '1.5s')}
        {renderEdgeLayer(edgesPolicyToActions, 3.0, 1.4, '1.5s')}
        {renderEdgeLayer(edgesActionsToGates, 2.8, 1.45, '1.6s')}
        {renderEdgeLayer(edgesGatesToVerify, 2.8, 1.45, '1.6s')}

        {/* Nhánh Vòng lặp 1 (Xanh): Đã phục hồi -> Cột 00 Service */}
        <path d={d2FeedbackResolvePath} fill="none" stroke={flowState.isFlowActive && !isUnrecoveredLoop ? '#0284C7' : '#38BDF8'} strokeWidth={flowState.isFlowActive && !isUnrecoveredLoop ? 2.6 : 1.7} strokeDasharray={flowState.isFlowActive && !isUnrecoveredLoop ? 'none' : '6 4'} strokeLinecap="round" markerEnd="url(#d2-arrow-feedback)" opacity={isUnrecoveredLoop ? 0.42 : 0.9} />
        {flowState.isFlowActive && !isUnrecoveredLoop && (
          <circle r="4.2" fill="#0284C7">
            <animateMotion path={d2FeedbackResolvePath} dur="4.4s" repeatCount="indefinite" rotate="auto" />
          </circle>
        )}

        {/* Nhánh Vòng lặp 2 (Đỏ): Chưa phục hồi -> Cột 04B Re-RCA */}
        <path d={d2FeedbackEscalatePath} fill="none" stroke={isUnrecoveredLoop ? '#DC2626' : '#FCA5A5'} strokeWidth={isUnrecoveredLoop ? 2.8 : 1.5} strokeDasharray={isUnrecoveredLoop ? 'none' : '6 4'} strokeLinecap="round" markerEnd="url(#d2-arrow-escalate)" opacity={isUnrecoveredLoop ? 1 : 0.55} />
        {isUnrecoveredLoop && (
          <circle r="4.5" fill="#DC2626">
            <animateMotion path={d2FeedbackEscalatePath} dur="3.4s" repeatCount="indefinite" rotate="auto" />
          </circle>
        )}
      </svg>

      {/* Nhãn chú thích 2 rãnh thu thập Log & K8s Event từ 00 Service (Cách A) */}
      <div data-testid="d2-collector-log-rail" style={{ position: 'absolute', left: `${Math.round(HUB_X + HUB_W / 2)}px`, top: `${LOG_COLLECT_BUS_Y - 10}px`, transform: 'translateX(-50%)', zIndex: 8, pointerEvents: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '999px', backgroundColor: isLogCollectorActive ? '#FFFBEB' : 'rgba(255, 255, 255, 0.96)', border: `1px solid ${isLogCollectorActive ? '#F59E0B' : '#FDE68A'}`, color: isLogCollectorActive ? '#B45309' : '#D97706', fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 5px rgba(15, 23, 42, 0.04)' }}>
          LogsCollector → Log Agent (Container Logs)
        </span>
      </div>

      <div data-testid="d2-collector-k8s-rail" style={{ position: 'absolute', left: `${Math.round(HUB_X + HUB_W / 2)}px`, top: `${EVENT_COLLECT_BUS_Y - 10}px`, transform: 'translateX(-50%)', zIndex: 8, pointerEvents: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '999px', backgroundColor: isK8sCollectorActive ? '#ECFDF5' : 'rgba(255, 255, 255, 0.96)', border: `1px solid ${isK8sCollectorActive ? '#10B981' : '#A7F3D0'}`, color: isK8sCollectorActive ? '#047857' : '#059669', fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 5px rgba(15, 23, 42, 0.04)' }}>
          EventsCollector &amp; Pods → K8s Event Agent
        </span>
      </div>

      {/* ============================================================ */}
      {/* CỘT 00: TARGET SERVICE / WORKLOAD MỤC TIÊU                   */}
      {/* ============================================================ */}
      <div
        data-testid="d2-service-node"
        style={{
          position: 'absolute',
          left: `${SV_X}px`,
          top: `${SV_Y}px`,
          width: `${SV_W}px`,
          height: `${SV_H}px`,
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: `1.5px solid ${flowState.isFlowActive ? '#F87171' : isAgentConnected ? '#94A3B8' : '#CBD5E1'}`,
          borderTop: `3px solid ${flowState.isFlowActive ? '#EF4444' : isAgentConnected ? '#0F172A' : '#94A3B8'}`,
          boxShadow: flowState.isFlowActive ? '0 8px 22px rgba(239, 68, 68, 0.14)' : '0 4px 14px rgba(15, 23, 42, 0.06)',
          padding: '12px 13px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 13,
        }}
      >
        {/* 3 cổng xuất tương ứng 3 luồng thu thập + 1 cổng đáy nhận vòng lặp hồi tiếp */}
        <div style={{ position: 'absolute', right: '-6px', top: '96px', transform: 'translateY(-50%)', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid #FFFFFF' }} />
        <div style={{ position: 'absolute', right: '-6px', top: '206px', transform: 'translateY(-50%)', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: isLogCollectorActive ? '#D97706' : '#F59E0B', border: '2px solid #FFFFFF' }} />
        <div style={{ position: 'absolute', right: '-6px', top: '238px', transform: 'translateY(-50%)', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#059669', border: '2px solid #FFFFFF' }} />
        <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#0284C7', border: '2px solid #FFFFFF' }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '5px' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} /> K8S WORKLOAD
            </span>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, padding: '1px 7px', borderRadius: '999px', backgroundColor: !isAgentConnected ? '#F1F5F9' : flowState.isFlowActive ? '#FEE2E2' : '#ECFDF5', color: !isAgentConnected ? '#64748B' : flowState.isFlowActive ? '#DC2626' : '#059669' }}>
              {isSimulating ? 'Mô phỏng lỗi' : isAgentConnected ? `${podCount} Pod • Online` : 'Offline'}
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedService}>
            {selectedService}
          </div>
          <div style={{ fontSize: '0.63rem', color: '#64748B', marginTop: '2px' }}>
            Nguồn thu thập 3 luồng trực tiếp:
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.65rem' }}>
          <div style={{ padding: '5px 8px', borderRadius: '8px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#065F46' }}>1. Metrics &amp; Probe</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>→ 01</span>
          </div>
          <div style={{ padding: '5px 8px', borderRadius: '8px', backgroundColor: isLogCollectorActive ? '#FEF3C7' : '#FFFBEB', border: `1px solid ${isLogCollectorActive ? '#F59E0B' : '#FDE68A'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#92400E' }}>2. Pod Logs</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#D97706', fontWeight: 700 }}>→ Log</span>
          </div>
          <div style={{ padding: '5px 8px', borderRadius: '8px', backgroundColor: isK8sCollectorActive ? '#D1FAE5' : '#F0FDF4', border: `1px solid ${isK8sCollectorActive ? '#10B981' : '#BBF7D0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#065F46' }}>3. K8s Events</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>→ K8s</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #F1F5F9', fontSize: '0.62rem', fontWeight: 700, color: '#0284C7' }}>
          <span>Hậu kiểm quay về giám sát</span>
          <span>↻ 07</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CỘT 01: 8 METRIC INPUT CARDS (XẾP DỌC)                       */}
      {/* ============================================================ */}
      {isTelemetryExpanded ? (
        metricConfigs.map((cfg, idx) => {
          const mState = effectiveMetricState(cfg);
          const IconComp = cfg.icon;
          const nodeY = M_START_Y + idx * (M_H + M_GAP);

          return (
            <div key={cfg.key} data-testid={`d2-metric-${cfg.key}`} style={{ position: 'absolute', left: `${M_X}px`, top: `${nodeY}px`, width: `${M_W}px`, height: `${M_H}px`, backgroundColor: mState.isSimTriggered ? '#FEF2F2' : '#FFFFFF', borderRadius: '9px', border: `1.5px solid ${mState.isWarning ? '#EF4444' : '#E2E8F0'}`, boxShadow: mState.isWarning ? '0 4px 12px rgba(239, 68, 68, 0.16)' : '0 2px 8px rgba(15, 23, 42, 0.04)', display: 'flex', alignItems: 'center', padding: '0 9px', gap: '8px', zIndex: 10 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: cfg.bgColor, border: `1px solid ${cfg.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cfg.color }}>
                <IconComp size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Metric Input</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.label}</div>
                <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: mState.isWarning ? '#DC2626' : '#64748B' }}>
                  {mState.isSimTriggered ? 'Kích hoạt mô phỏng' : `${mState.latest} ${cfg.unit} • TB: ${mState.avg}`}
                </div>
              </div>
              <div style={{ position: 'absolute', right: '-7px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: `2px solid ${mState.isWarning ? '#EF4444' : '#94A3B8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#64748B' }}>+</div>
            </div>
          );
        })
      ) : (
        <div data-testid="d2-telemetry-compact" onMouseDown={(e) => e.stopPropagation()} onClick={onToggleTelemetry} style={{ position: 'absolute', left: `${M_X}px`, top: `${M_COMPACT_Y}px`, width: `${M_W}px`, height: `${M_COMPACT_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${warningMetricItemsCount > 0 ? '#FCA5A5' : '#CBD5E1'}`, borderTop: `3px solid ${warningMetricItemsCount > 0 ? '#F59E0B' : '#10B981'}`, boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)', padding: '12px 13px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', zIndex: 12 }}>
          <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid #FFFFFF' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669' }}>METRIC INPUT</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', backgroundColor: warningMetricItemsCount > 0 ? '#FEF3C7' : '#ECFDF5', color: warningMetricItemsCount > 0 ? '#B45309' : '#059669' }}>
                {warningMetricItemsCount > 0 ? `${warningMetricItemsCount} cảnh báo` : `${metricConfigs.length}/${metricConfigs.length} ổn định`}
              </span>
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0F172A' }}>8 Chỉ số Viễn trắc</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>CPU / RAM</span><span style={{ fontWeight: 700, color: '#0F172A' }}>{liveCpuVal.toFixed(1)}% / {liveRamVal.toFixed(1)}%</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Latency</span><span style={{ fontWeight: 700, color: liveLatVal > 200 ? '#DC2626' : '#7C3AED' }}>{liveLatVal.toFixed(0)} ms</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Req/s • 5xx</span><span style={{ fontWeight: 700, color: live5xxVal > 5 ? '#DC2626' : '#0891B2' }}>{liveReqVal.toFixed(1)} • {live5xxVal.toFixed(1)}%</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748B' }}>Restarts • Pods</span><span style={{ fontWeight: 700, color: '#6366F1' }}>{liveMetrics.pod_restart_count?.latest ?? 0} lần • {liveMetrics.replica_count?.latest ?? podCount ?? 1} Pod</span></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '7px', borderTop: '1px solid #F1F5F9', fontSize: '0.68rem', fontWeight: 800, color: '#059669' }}>
            <span>Nhấn mở 8 nhánh</span>
            <span style={{ padding: '1px 7px', borderRadius: '999px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>+8</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CỘT 02 (LÀN DƯỚI): AI ANALYSIS & HEALTH ASSESSMENT           */}
      {/* ============================================================ */}
      <div style={{ position: 'absolute', left: `${HUB_X}px`, top: `${HUB_Y}px`, width: `${HUB_W}px`, height: `${HUB_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: isRiskDetected || isSimulating ? '1.5px solid #F87171' : '1.5px solid #CBD5E1', boxShadow: isRiskDetected || isSimulating ? '0 10px 25px -5px rgba(239, 68, 68, 0.18)' : '0 8px 20px -4px rgba(15, 23, 42, 0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 15 }}>
        <div style={{ padding: '9px 12px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}><Sparkles size={13} /></div>
            <span style={{ fontSize: '0.78125rem', fontWeight: 700, color: '#1E293B' }}>AI Analysis & Health Assessment</span>
          </div>
          <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '4px', backgroundColor: isSimulating ? '#EDE9FE' : !isAgentConnected ? '#F1F5F9' : currentActiveStep < totalSteps ? '#FEF3C7' : '#DCFCE7', color: isSimulating ? '#6D28D9' : !isAgentConnected ? '#64748B' : currentActiveStep < totalSteps ? '#D97706' : '#15803D', fontWeight: 700 }}>
            {isSimulating ? 'Mô phỏng' : isAgentConnected ? `${currentActiveStep}/${totalSteps} Bước` : `0/${totalSteps} Bước`}
          </span>
        </div>

        <div style={{ position: 'relative', width: `${miniChartW}px`, height: `${miniChartH}px`, margin: '6px auto 0 auto', backgroundColor: '#FFFFFF', borderRadius: '8px' }}>
          <svg viewBox={`0 0 ${miniChartW} ${miniChartH}`} style={{ width: '100%', height: '100%', display: 'block' }}>
            <defs>
              {metricConfigs.map((cfg) => (
                <linearGradient key={`d2-grad-${cfg.key}`} id={`d2-mini-grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={cfg.color} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {yTicks.map((val) => {
              const y = getMiniY(val);
              return (
                <g key={`d2-y-${val}`}>
                  <line x1={chartPad.left} y1={y} x2={chartPad.left + innerW} y2={y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={chartPad.left - 5} y={y + 3} fill="#94A3B8" fontSize="8" fontFamily="var(--font-mono)" textAnchor="end">{val}</text>
                </g>
              );
            })}

            {chartMaxY >= 80 && (
              <g>
                <line x1={chartPad.left} y1={getMiniY(80)} x2={chartPad.left + innerW} y2={getMiniY(80)} stroke="#EF4444" strokeWidth="1.2" strokeDasharray="4 3" />
                <text x={chartPad.left + innerW + 4} y={getMiniY(80) + 3} fill="#EF4444" fontSize="7.5" fontWeight="700" fontFamily="var(--font-mono)">80%</text>
              </g>
            )}

            {effectiveTimesteps.length > 0 && metricConfigs.map((cfg) => {
              const points = effectiveTimesteps.map((t, i) => {
                const val = Number(t[cfg.key] ?? (cfg.key === 'http_5xx_rate' ? t.error_5xx : undefined) ?? (cfg.key === 'pod_restart_count' ? t.restarts : undefined) ?? (cfg.key === 'replica_count' ? (t.replicas ?? podCount ?? 1) : undefined) ?? 0);
                return { x: getMiniX(i), y: getMiniY(val) };
              });
              if (points.length < 2) return null;
              const lineD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
              const areaD = `${lineD} L ${points[points.length - 1].x} ${getMiniY(0)} L ${points[0].x} ${getMiniY(0)} Z`;
              return (
                <g key={`d2-series-${cfg.key}`}>
                  <path d={areaD} fill={`url(#d2-mini-grad-${cfg.key})`} />
                  <path d={lineD} fill="none" stroke={cfg.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((p, pIdx) => (
                    <circle key={`d2-pt-${cfg.key}-${pIdx}`} cx={p.x} cy={p.y} r="2.5" fill="#FFFFFF" stroke={cfg.color} strokeWidth="1.2" />
                  ))}
                </g>
              );
            })}

            {isAgentConnected && effectiveTimesteps.length > 0 && (
              <g>
                <line x1={sweepTargetX} y1={chartPad.top} x2={sweepTargetX} y2={chartPad.top + innerH} stroke="#2563EB" strokeWidth="1.5" strokeDasharray="3 2" />
                <circle cx={sweepTargetX} cy={getMiniY(Number(effectiveTimesteps[activeSweepIdx]?.latency || effectiveTimesteps[activeSweepIdx]?.ram || 50))} r="4.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <text x={sweepTargetX} y={chartPad.top - 8} fill="#2563EB" fontSize="8.5" fontWeight="800" fontFamily="var(--font-mono)" textAnchor={activeSweepIdx >= 10 ? 'end' : activeSweepIdx <= 1 ? 'start' : 'middle'}>
                  {currentStepLabel} ({activeSweepIdx === 0 ? 'Đủ 12 bước -> AI' : 'Đầu gom mới'})
                </text>
              </g>
            )}

            {effectiveTimesteps.map((t, i) => (
              <text key={`d2-step-${i}`} x={getMiniX(i)} y={chartPad.top + innerH + 15} fill={i === activeSweepIdx ? '#2563EB' : '#64748B'} fontSize={i === activeSweepIdx ? '9' : '8'} fontWeight={i === activeSweepIdx ? '800' : '500'} fontFamily="var(--font-mono)" textAnchor="middle">
                {t.stepLabel || `T${i + 1}`}
              </text>
            ))}
          </svg>
        </div>

        <div style={{ padding: '10px 14px', textAlign: 'center', borderTop: '1px solid #F1F5F9', marginTop: 'auto', backgroundColor: '#FAFAFA' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>AI to Analyze {selectedService} & Assess Health</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '16px', backgroundColor: isSimulating || isRiskDetected ? '#FEE2E2' : '#E0F2FE', color: isSimulating || isRiskDetected ? '#991B1B' : '#0369A1', fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            <span>{isScaleDownOptimization ? 'Chỉ số tối ưu:' : 'Điểm rủi ro tổng:'}</span>
            <strong>{isSimulating ? 'DEMO_TRIGGERED' : `${rawRiskScore.toFixed(4)} (${isScaleDownOptimization ? 'SCALE_DOWN_OPT' : isPredictionHealthy ? 'HEALTHY' : prediction?.status || 'HEALTHY'})`}</strong>
          </div>
        </div>
        <div style={{ position: 'absolute', right: '-9px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#3B82F6', border: '2px solid #FFFFFF', zIndex: 20 }} />
      </div>

      {/* ============================================================ */}
      {/* HÀNG NGANG RULE ENGINE (6 THẺ R1..R6 NẰM NGANG PHÍA TRÊN)   */}
      {/* ============================================================ */}
      {isRuleExpanded ? (
        effectiveRuleChecks.map((rule, idx) => {
          const ruleX = RULE_ROW_X + idx * (RULE_CARD_W + RULE_CARD_GAP);
          const isTrig = rule.effectiveTriggered;
          const spec = RULE_AGENT_MAP[rule.id] || { sourceMetrics: [], agents: ['metrics', 'k8s_event'] };
          const inCount = isTelemetryExpanded ? Math.max((spec.sourceMetrics || []).length, 1) : 1;
          const outCount = Math.max((spec.agents || []).length, 1);
          return (
            <div
              key={rule.id}
              data-testid={`d2-rule-${rule.id}`}
              style={{
                position: 'absolute',
                left: `${ruleX}px`,
                top: `${RULE_ROW_Y}px`,
                width: `${RULE_CARD_W}px`,
                height: `${RULE_ROW_H}px`,
                backgroundColor: isTrig ? '#FEF2F2' : '#FFFFFF',
                borderRadius: '11px',
                border: `1.5px solid ${isTrig ? '#EF4444' : '#FED7AA'}`,
                boxShadow: isTrig ? '0 6px 14px rgba(239, 68, 68, 0.16)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '9px 10px',
                zIndex: 12,
                boxSizing: 'border-box',
              }}
            >
              {/* Cổng ra trên (khớp chính xác từng sợi tới Agents) & cổng vào dưới (từ Metrics) */}
              {Array.from({ length: outCount }).map((_, pIdx) => (
                <div
                  key={`out-${pIdx}`}
                  style={{
                    position: 'absolute',
                    left: `${Math.round(RULE_CARD_W * 0.5 + (pIdx - (outCount - 1) / 2) * 26)}px`,
                    top: '-4.5px',
                    transform: 'translateX(-50%)',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isTrig ? '#EA580C' : '#FFFFFF',
                    border: `2px solid ${isTrig ? '#EA580C' : '#FB923C'}`,
                  }}
                />
              ))}
              {Array.from({ length: inCount }).map((_, pIdx) => (
                <div
                  key={`in-${pIdx}`}
                  style={{
                    position: 'absolute',
                    left: `${Math.round(RULE_CARD_W * 0.5 + (pIdx - (inCount - 1) / 2) * 32)}px`,
                    bottom: '-4.5px',
                    transform: 'translateX(-50%)',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isTrig ? '#EA580C' : '#FFFFFF',
                    border: `2px solid ${isTrig ? '#EA580C' : '#FB923C'}`,
                  }}
                />
              ))}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.67rem', fontWeight: 800, color: isTrig ? '#B91C1C' : '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  <Zap size={11} style={{ color: isTrig ? '#DC2626' : '#EA580C', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.name}</span>
                </span>
                <span style={{ fontSize: '0.56rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isTrig ? '#DC2626' : '#059669', flexShrink: 0 }}>
                  {isTrig && isSimulating ? 'VI PHẠM' : rule.value}
                </span>
              </div>

              <div style={{ fontSize: '0.57rem', fontFamily: 'var(--font-mono)', color: isTrig ? '#9A3412' : '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingTop: '4px', borderTop: '1px solid #F8FAFC' }}>
                {rule.cond}
              </div>
            </div>
          );
        })
      ) : (
        <div
          data-testid="d2-rule-compact"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onToggleRule}
          style={{
            position: 'absolute',
            left: `${RULE_COMPACT_X}px`,
            top: `${RULE_COMPACT_Y}px`,
            width: `${RULE_COMPACT_W}px`,
            height: `${RULE_COMPACT_H}px`,
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: `1.5px solid ${isRuleActiveAny ? '#EA580C' : '#FED7AA'}`,
            borderLeft: `4px solid ${isRuleActiveAny ? '#EA580C' : '#F59E0B'}`,
            boxShadow: isRuleActiveAny ? '0 8px 20px rgba(234, 88, 12, 0.16)' : '0 4px 14px rgba(15, 23, 42, 0.06)',
            padding: '0 16px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            cursor: 'pointer',
            zIndex: 12,
          }}
        >
          <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#EA580C', border: '2px solid #FFFFFF' }} />
          <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isRuleActiveAny ? '#EA580C' : '#F59E0B', border: '2px solid #FFFFFF' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: isRuleActiveAny ? '#FEE2E2' : '#FFF7ED', border: `1px solid ${isRuleActiveAny ? '#FCA5A5' : '#FED7AA'}`, color: isRuleActiveAny ? '#DC2626' : '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>
                Rule Engine — 6 Luật Ngưỡng Tĩnh (Hàng Ngang)
              </div>
              <div style={{ fontSize: '0.68rem', color: isRuleActiveAny ? '#DC2626' : '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isRuleActiveAny
                  ? effectiveRuleChecks.filter((r) => r.effectiveTriggered).map((r) => r.id).join(', ') + ' đang kích hoạt → Rẽ thẳng tới Agent'
                  : 'CPU, Traffic Surge, RAM/OOM, HTTP 5xx, Pod Instability, Disk Saturation'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', backgroundColor: isRuleActiveAny ? '#FEE2E2' : '#ECFDF5', color: isRuleActiveAny ? '#DC2626' : '#059669' }}>
              {isRuleActiveAny ? `${effectiveRuleTriggerCount}/6 Vi phạm` : '0/6 An toàn'}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '999px', backgroundColor: '#FFF7ED', border: '1px solid #FDBA74', fontSize: '0.68rem', fontWeight: 800, color: '#EA580C' }}>
              + Mở 6 luật (+6)
            </span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CỘT 03 (LÀN DƯỚI): 7 ĐẦU RỦI RO AI (XẾP DỌC)                 */}
      {/* ============================================================ */}
      {isRisksExpanded ? (
        effectiveRiskItems.map((node, idx) => {
          const nodeY = R_START_Y + idx * (R_H + R_GAP);
          const isOpt = node.riskKey === 'SCALE_DOWN_CANDIDATE';
          const trigBorder = isOpt ? '#7DD3FC' : '#FCA5A5';
          const trigAccent = isOpt ? '#0284C7' : '#EF4444';
          return (
            <div key={node.id} data-testid={`d2-risk-${node.id}`} style={{ position: 'absolute', left: `${R_X}px`, top: `${nodeY}px`, width: `${R_W}px`, height: `${R_H}px`, backgroundColor: node.effectiveTriggered ? (isOpt ? '#F0F9FF' : '#FEF2F2') : '#FFFFFF', borderRadius: '9px', border: `1.5px solid ${node.effectiveTriggered ? trigBorder : '#E2E8F0'}`, boxShadow: node.effectiveTriggered ? '0 4px 12px rgba(239, 68, 68, 0.14)' : '0 2px 6px rgba(15, 23, 42, 0.04)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px', zIndex: 10 }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: node.effectiveTriggered ? (isOpt ? '#E0F2FE' : '#FEE2E2') : '#F0FDF4', border: `1px solid ${node.effectiveTriggered ? trigBorder : '#BBF7D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: node.effectiveTriggered ? trigAccent : '#10B981', flexShrink: 0 }}>
                {node.effectiveTriggered ? (isOpt ? <Sparkles size={14} /> : <AlertTriangle size={14} />) : <CheckCircle2 size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: node.effectiveTriggered ? trigAccent : '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  <span style={{ color: node.effectiveTriggered ? trigAccent : '#64748B' }}>Ngưỡng: {node.thresholdPercent}%</span>
                  <strong style={{ color: node.effectiveTriggered ? trigAccent : '#10B981' }}>{node.displayPercent}</strong>
                </div>
              </div>
              <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: node.effectiveTriggered ? trigAccent : '#FFFFFF', border: `2px solid ${node.effectiveTriggered ? trigAccent : '#94A3B8'}` }} />
            </div>
          );
        })
      ) : (
        <div data-testid="d2-risks-compact" onMouseDown={(e) => e.stopPropagation()} onClick={onToggleRisks} style={{ position: 'absolute', left: `${R_X}px`, top: `${R_COMPACT_Y}px`, width: `${R_W}px`, height: `${R_COMPACT_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${triggeredRiskItemsCount > 0 ? '#FCA5A5' : '#CBD5E1'}`, borderTop: `3px solid ${triggeredRiskItemsCount > 0 ? '#EF4444' : '#10B981'}`, boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)', padding: '12px 14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', zIndex: 12 }}>
          <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: triggeredRiskItemsCount > 0 ? '#EF4444' : '#10B981', border: '2px solid #FFFFFF' }} />
          <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: triggeredRiskItemsCount > 0 ? '#EF4444' : '#94A3B8', border: '2px solid #FFFFFF' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: triggeredRiskItemsCount > 0 ? '#DC2626' : '#059669' }}>HỒ SƠ RỦI RO</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', backgroundColor: triggeredRiskItemsCount > 0 ? '#FEE2E2' : '#ECFDF5', color: triggeredRiskItemsCount > 0 ? '#DC2626' : '#059669' }}>
                {triggeredRiskItemsCount > 0 ? `${triggeredRiskItemsCount}/7 cảnh báo` : 'An toàn'}
              </span>
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0F172A' }}>7 Đầu Rủi Ro AI</div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: '10px', backgroundColor: triggeredRiskItemsCount > 0 ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${triggeredRiskItemsCount > 0 ? '#FECACA' : '#E2E8F0'}` }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748B' }}>CAO NHẤT HIỆN TẠI</div>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isSimulating && flowState.activeRisks.size > 0 ? Array.from(flowState.activeRisks).join(', ') : isAgentConnected ? topRiskEval?.title || 'Ổn định' : 'Chưa kết nối'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '7px', borderTop: '1px solid #F1F5F9', fontSize: '0.68rem', fontWeight: 800, color: '#DC2626' }}>
            <span>Nhấn mở 7 nhánh</span>
            <span style={{ padding: '1px 7px', borderRadius: '999px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>+7</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CỘT 04A: 4 AGENT GOM NGỮ CẢNH ĐỘC LẬP                        */}
      {/* ============================================================ */}
      {BRANCHED_CONTEXT_AGENTS.map((ag, idx) => {
        const AgIcon = ag.icon;
        const y = AG_START_Y + idx * (AG_H + AG_GAP);
        const isAgActive = flowState.isFlowActive && flowState.activeAgents.has(ag.id);
        const isAgCleanScanned = flowState.isFlowActive && !isSimulating && !isAgActive && isAgentConnected;
        const agCleanBadgeText = ag.id === 'log' || ag.id === 'k8s_event' ? 'Đã quét (0 lỗi)' : 'Đã đối chiếu';
        const agCleanFooterText =
          ag.id === 'log' || ag.id === 'k8s_event'
            ? 'Đã đối chiếu — Không có bất thường'
            : `Đã đối chiếu — ${ag.role}`;

        let subInfo = ag.detail;
        if (ag.id === 'metrics' && isAgentConnected && !isSimulating) subInfo = pipelineContext?.rcaAgentsSummary?.metricsSub || ag.role;
        else if (ag.id === 'log' && isAgentConnected && !isSimulating) subInfo = pipelineContext?.rcaAgentsSummary?.logSub || ag.role;
        else if (ag.id === 'k8s_event' && isAgentConnected && !isSimulating) subInfo = pipelineContext?.rcaAgentsSummary?.k8sEventSub || ag.role;
        else if (ag.id === 'history' && isAgentConnected && !isSimulating) subInfo = pipelineContext?.rcaAgentsSummary?.historySub || `${pipelineContext?.totalServiceIncidentsCount ?? 0} lịch sử sự cố`;

        return (
          <div key={ag.id} data-testid={`d2-agent-${ag.id}`} style={{ position: 'absolute', left: `${AG_X}px`, top: `${y}px`, width: `${AG_W}px`, height: `${AG_H}px`, backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1.5px solid ${isAgActive ? ag.color : '#CBD5E1'}`, boxShadow: isAgActive ? `0 8px 20px ${ag.color}2E` : '0 3px 10px rgba(15, 23, 42, 0.05)', padding: '11px 13px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: flowState.isFlowActive && !isAgActive ? (isAgCleanScanned ? 0.8 : 0.56) : 1, zIndex: 12, transition: 'all 0.2s ease' }}>
            <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isAgActive ? ag.color : '#94A3B8', border: '2px solid #FFFFFF' }} />
            {(ag.id === 'log' || ag.id === 'k8s_event') && (
              <div style={{ position: 'absolute', left: '-5px', top: '84px', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isAgActive ? ag.color : '#FFFFFF', border: `2px solid ${ag.color}` }} />
            )}
            <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isAgActive ? ag.color : '#94A3B8', border: '2px solid #FFFFFF' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: ag.bg, border: `1px solid ${ag.border}`, color: ag.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AgIcon size={15} /></div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>{ag.name}</span>
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', backgroundColor: isAgActive ? ag.bg : isAgCleanScanned ? '#F8FAFC' : '#F1F5F9', border: isAgCleanScanned ? '1px solid #E2E8F0' : 'none', color: isAgActive ? ag.color : '#64748B' }}>
                {isAgActive ? 'Có bằng chứng' : isAgCleanScanned ? agCleanBadgeText : 'Chờ tín hiệu'}
              </span>
            </div>

            <div style={{ fontSize: '0.69rem', color: '#475569', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subInfo}</div>
            <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isAgActive ? ag.color : '#94A3B8' }}>
              {isAgActive ? 'Bằng chứng hợp lệ → RootCauseAgent' : isAgCleanScanned ? agCleanFooterText : ag.role}
            </div>
          </div>
        );
      })}

      {/* ============================================================ */}
      {/* CỘT 04B: 16 NGUYÊN NHÂN GỐC                                  */}
      {/* ============================================================ */}
      {isCausesExpanded ? (
        BRANCHED_ROOT_CAUSES.map((cause, idx) => {
          const y = RC_START_Y + idx * (RC_ITEM_H + RC_ITEM_GAP);
          const isSelectedOrActive = flowState.isFlowActive && flowState.activeCauseObj?.code === cause.code;
          const isSimTarget = simulatedCauseCode === cause.code;

          return (
            <div key={cause.code} data-testid={`d2-cause-${cause.code}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onSelectSimulatedCause(cause.code); }} title={`${cause.labelVi} (${cause.code}) — Click để chạy thử luồng`} style={{ position: 'absolute', left: `${RC_X}px`, top: `${y}px`, width: `${RC_W}px`, height: `${RC_ITEM_H}px`, backgroundColor: isSelectedOrActive ? cause.bg : '#FFFFFF', borderRadius: '9px', border: `1.5px solid ${isSelectedOrActive ? cause.color : '#E2E8F0'}`, boxShadow: isSelectedOrActive ? `0 5px 14px ${cause.color}2B` : '0 1px 5px rgba(15, 23, 42, 0.04)', padding: '0 12px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', zIndex: isSelectedOrActive ? 15 : 11, opacity: flowState.isFlowActive && !isSelectedOrActive ? 0.65 : 1, transition: 'all 0.16s ease' }}>
              <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isSelectedOrActive ? cause.color : '#CBD5E1', border: '1.5px solid #FFFFFF' }} />
              <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isSelectedOrActive ? cause.color : '#CBD5E1', border: '1.5px solid #FFFFFF' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isSelectedOrActive ? '#FFFFFF' : '#475569', backgroundColor: isSelectedOrActive ? cause.color : '#F1F5F9', borderRadius: '5px', padding: '2px 6px', flexShrink: 0 }}>
                  #{String(cause.index).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.76rem', fontWeight: isSelectedOrActive ? 800 : 600, color: isSelectedOrActive ? '#0F172A' : '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cause.shortLabelVi}
                </span>
              </div>

              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', backgroundColor: isSelectedOrActive ? '#FFFFFF' : '#F8FAFC', border: `1px solid ${isSelectedOrActive ? cause.color : '#E2E8F0'}`, color: isSelectedOrActive ? cause.color : '#64748B', flexShrink: 0 }}>
                {isSimTarget ? (isUnrecoveredLoop ? 'RE-RCA' : 'MÔ PHỎNG') : isSelectedOrActive ? 'ĐANG CHẠY' : cause.policyBranch}
              </span>
            </div>
          );
        })
      ) : (
        <div data-testid="d2-causes-compact" onMouseDown={(e) => e.stopPropagation()} onClick={onToggleCauses} style={{ position: 'absolute', left: `${RC_X}px`, top: `${RC_COMPACT_Y}px`, width: `${RC_W}px`, height: `${RC_COMPACT_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${flowState.isFlowActive ? (flowState.activeCauseObj?.color || '#7C3AED') : '#CBD5E1'}`, borderTop: `4px solid ${flowState.activeCauseObj?.color || '#7C3AED'}`, boxShadow: flowState.isFlowActive ? '0 10px 26px rgba(124, 58, 237, 0.16)' : '0 4px 14px rgba(15, 23, 42, 0.06)', padding: '15px 17px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', zIndex: 13 }}>
          <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: flowState.activeCauseObj?.color || '#7C3AED', border: '2px solid #FFFFFF' }} />
          <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: flowState.activeCauseObj?.color || '#7C3AED', border: '2px solid #FFFFFF' }} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7C3AED', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Sparkles size={13} /> ROOTCAUSE AGENT</span>
              <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', backgroundColor: '#F5F3FF', color: '#6D28D9' }}>16 Nguyên nhân</span>
            </div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A' }}>Chẩn Đoán Nguyên Nhân Gốc</div>
            <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>Hội tụ bằng chứng từ 4 Agent độc lập để xác định đúng 1/16 nguyên nhân gốc.</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: flowState.activeCauseObj ? flowState.activeCauseObj.bg : '#F0FDF4', border: `1px solid ${flowState.activeCauseObj ? `${flowState.activeCauseObj.color}55` : '#BBF7D0'}` }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              {isUnrecoveredLoop ? 'Re-RCA sau Action #1' : flowState.isSimulated ? 'Nguyên nhân đang mô phỏng' : flowState.isFlowActive ? 'Nguyên nhân thực tế' : 'Trạng thái hiện tại'}
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: flowState.activeCauseObj?.color || '#15803D', marginTop: '3px' }}>
              {flowState.activeCauseObj ? flowState.activeCauseObj.labelVi : 'Dịch vụ ổn định (0 lỗi)'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '0.74rem', fontWeight: 800, color: '#7C3AED' }}>
            <span>Nhấn mở đủ 16 nguyên nhân</span>
            <span style={{ padding: '2px 9px', borderRadius: '999px', backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE' }}>+16</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CỘT 05: RECOMMENDATION & POLICY ENGINE                       */}
      {/* ============================================================ */}
      <div style={{ position: 'absolute', left: `${PL_X}px`, top: `${PL_Y}px`, width: `${PL_W}px`, height: `${PL_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${isUnrecoveredLoop ? '#DC2626' : flowState.isFlowActive ? '#F59E0B' : '#CBD5E1'}`, boxShadow: isUnrecoveredLoop ? '0 10px 24px rgba(220, 38, 38, 0.2)' : flowState.isFlowActive ? '0 10px 24px rgba(245, 158, 11, 0.18)' : '0 4px 14px rgba(15, 23, 42, 0.06)', display: 'flex', flexDirection: 'column', zIndex: 13 }}>
        <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: flowState.isFlowActive ? '#7C3AED' : '#94A3B8', border: '2px solid #FFFFFF' }} />
        <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isUnrecoveredLoop ? '#DC2626' : flowState.isFlowActive ? '#D97706' : '#94A3B8', border: '2px solid #FFFFFF' }} />

        <div style={{ padding: '11px 13px', backgroundColor: isUnrecoveredLoop ? '#FEF2F2' : '#FFFBEB', borderBottom: `1px solid ${isUnrecoveredLoop ? '#FECACA' : '#FDE68A'}`, borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <ShieldCheck size={15} color={isUnrecoveredLoop ? '#DC2626' : '#D97706'} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isUnrecoveredLoop ? '#991B1B' : '#92400E' }}>Recommendation & Policy</span>
          </div>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', backgroundColor: isUnrecoveredLoop ? '#FEE2E2' : '#FEF3C7', color: isUnrecoveredLoop ? '#DC2626' : '#B45309' }}>
            {flowState.effectivePolicyBranch || 'CHỜ'}
          </span>
        </div>

        <div style={{ padding: '12px 13px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: isUnrecoveredLoop ? '#FFF7ED' : '#F8FAFC', border: `1px solid ${isUnrecoveredLoop ? '#FED7AA' : '#E2E8F0'}` }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isUnrecoveredLoop ? '#C2410C' : '#64748B', textTransform: 'uppercase' }}>
              {isUnrecoveredLoop ? 'Leo thang Bậc 2 (Do Action #1 chưa ổn)' : 'Ánh xạ Nguyên nhân → Action'}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
              {flowState.effectiveDisplayActionObj ? `${flowState.effectiveDisplayActionObj.labelVi} (${flowState.effectiveDisplayActionObj.code})` : 'Duy trì giám sát bình thường'}
            </div>
            {isUnrecoveredLoop && flowState.activeActionObj && (
              <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: '3px' }}>Trước đó đã thử: {flowState.activeActionObj.code} (Chưa đạt SLA)</div>
            )}
            {!isUnrecoveredLoop && flowState.secondaryActionObj && (
              <div style={{ fontSize: '0.64rem', color: '#7C3AED', marginTop: '3px', fontWeight: 700 }}>Leo thang / Dự phòng: {flowState.secondaryActionObj.code}</div>
            )}
          </div>

          <div style={{ fontSize: '0.69rem', color: '#334155', lineHeight: 1.45, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
            {isUnrecoveredLoop
              ? `Hậu kiểm 60s ghi nhận còn lỗi → Re-RCA nâng bậc xử lý lên ${flowState.effectiveDisplayActionObj?.code || 'NO_ACTION'} để dứt điểm sự cố (hoặc ngắt mạch an toàn).`
              : flowState.policyReasonVi}
          </div>

          <div style={{ fontSize: '0.64rem', color: '#B45309', fontWeight: 700, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '7px' }}>
            <span>Cooldown {pipelineContext?.policyMeta?.cooldownSec || 60}s</span>
            <span>Rẽ nhánh Action →</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CỘT 06A: 10 HÀNH ĐỘNG (ACTION)                               */}
      {/* ============================================================ */}
      {isActionsExpanded ? (
        BRANCHED_ACTIONS.map((act, idx) => {
          const ActIcon = act.icon;
          const y = AC_START_Y + idx * (AC_ITEM_H + AC_ITEM_GAP);
          const isCurrentTarget = flowState.isFlowActive && flowState.effectiveDisplayActionObj?.code === act.code;
          const isInitialTriedFailed =
            flowState.isFlowActive &&
            isUnrecoveredLoop &&
            flowState.activeActionObj?.code === act.code &&
            flowState.effectiveDisplayActionObj?.code !== act.code;
          const isBackupPreview = !isUnrecoveredLoop && flowState.isFlowActive && flowState.secondaryActionObj?.code === act.code;

          return (
            <div key={act.code} data-testid={`d2-action-${act.code}`} title={`${act.labelVi} (${act.code}) — ${act.desc}`} style={{ position: 'absolute', left: `${AC_X}px`, top: `${y}px`, width: `${AC_W}px`, height: `${AC_ITEM_H}px`, backgroundColor: isCurrentTarget ? (isUnrecoveredLoop ? '#FFF7ED' : '#F0FDFA') : isInitialTriedFailed ? '#FEF2F2' : '#FFFFFF', borderRadius: '10px', border: `1.5px solid ${isCurrentTarget ? (isUnrecoveredLoop ? '#EA580C' : act.color) : isInitialTriedFailed ? '#FCA5A5' : isBackupPreview ? '#94A3B8' : '#E2E8F0'}`, boxShadow: isCurrentTarget ? `0 6px 14px ${(isUnrecoveredLoop ? '#EA580C' : act.color)}2E` : '0 1px 5px rgba(15, 23, 42, 0.04)', padding: '6px 12px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', opacity: flowState.isFlowActive && !isCurrentTarget && !isInitialTriedFailed && !isBackupPreview ? 0.6 : 1, zIndex: isCurrentTarget ? 15 : 11, transition: 'all 0.16s ease' }}>
              <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isCurrentTarget ? (isUnrecoveredLoop ? '#EA580C' : act.color) : '#CBD5E1', border: '1.5px solid #FFFFFF' }} />
              <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isCurrentTarget ? (isUnrecoveredLoop ? '#EA580C' : act.color) : '#CBD5E1', border: '1.5px solid #FFFFFF' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: isCurrentTarget ? (isUnrecoveredLoop ? '#EA580C' : act.color) : '#F1F5F9', color: isCurrentTarget ? '#FFFFFF' : act.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ActIcon size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: isCurrentTarget ? 800 : 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.index}. {act.labelVi}</div>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.code} {!act.aiSupported ? '• Catalog/Manual' : `• ${act.defaultBranch}`}</div>
                </div>
              </div>

              <span style={{ fontSize: '0.56rem', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', backgroundColor: isCurrentTarget ? (isUnrecoveredLoop ? '#EA580C' : act.color) : isInitialTriedFailed ? '#FEE2E2' : isBackupPreview ? '#E2E8F0' : '#F8FAFC', color: isCurrentTarget ? '#FFFFFF' : isInitialTriedFailed ? '#DC2626' : isBackupPreview ? '#334155' : '#64748B', flexShrink: 0 }}>
                {isCurrentTarget ? (isUnrecoveredLoop ? (act.code === 'NO_ACTION' ? 'NGẮT MẠCH' : 'LEO THANG CẤP 2') : 'ĐANG CHỌN') : isInitialTriedFailed ? 'CẤP 1 (CHƯA ĐẠT)' : isBackupPreview ? 'DỰ PHÒNG' : act.riskLevel}
              </span>
            </div>
          );
        })
      ) : (
        <div data-testid="d2-actions-compact" onMouseDown={(e) => e.stopPropagation()} onClick={onToggleActions} style={{ position: 'absolute', left: `${AC_X}px`, top: `${AC_COMPACT_Y}px`, width: `${AC_W}px`, height: `${AC_COMPACT_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${flowState.isFlowActive ? (isUnrecoveredLoop ? '#EA580C' : flowState.effectiveDisplayActionObj?.color || '#0F766E') : '#CBD5E1'}`, borderTop: `4px solid ${isUnrecoveredLoop ? '#EA580C' : flowState.effectiveDisplayActionObj?.color || '#0F766E'}`, boxShadow: flowState.isFlowActive ? '0 10px 26px rgba(15, 118, 110, 0.16)' : '0 4px 14px rgba(15, 23, 42, 0.06)', padding: '15px 17px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', zIndex: 13 }}>
          <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: flowState.effectiveDisplayActionObj?.color || '#0F766E', border: '2px solid #FFFFFF' }} />
          <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: flowState.effectiveDisplayActionObj?.color || '#0F766E', border: '2px solid #FFFFFF' }} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0F766E', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Zap size={13} /> ACTION EXECUTOR</span>
              <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', backgroundColor: '#F0FDFA', color: '#0F766E' }}>10 Hành động</span>
            </div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A' }}>Chọn Hành Động Khắc Phục</div>
            <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>Định tuyến chính xác tới 1/10 hành động Kubernetes (hoặc leo thang Cấp 2 khi hậu kiểm chưa đạt).</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: isUnrecoveredLoop ? '#FFF7ED' : flowState.effectiveDisplayActionObj ? '#F0FDFA' : '#F8FAFC', border: `1px solid ${isUnrecoveredLoop ? '#FED7AA' : flowState.effectiveDisplayActionObj ? '#99F6E4' : '#E2E8F0'}` }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{isUnrecoveredLoop ? 'Hành động leo thang Cấp 2' : 'Hành động đang đi qua'}</div>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isUnrecoveredLoop ? '#EA580C' : flowState.effectiveDisplayActionObj?.color || '#0F172A', marginTop: '3px' }}>
              {flowState.effectiveDisplayActionObj ? flowState.effectiveDisplayActionObj.labelVi : 'Chưa kích hoạt can thiệp'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '0.74rem', fontWeight: 800, color: '#0F766E' }}>
            <span>Nhấn mở đủ 10 hành động</span>
            <span style={{ padding: '2px 9px', borderRadius: '999px', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4' }}>+10</span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CỘT 06B: CỔNG ĐIỀU PHỐI AUTO / HITL / CIRCUIT BREAKER       */}
      {/* ============================================================ */}
      {policyGateCards.map((gate) => {
        const GateIcon = gate.icon;
        const isActiveGate = flowState.isFlowActive && flowState.effectivePolicyBranch === gate.code;
        return (
          <div key={gate.code} data-testid={`d2-gate-${gate.code}`} style={{ position: 'absolute', left: `${GT_X}px`, top: `${gate.y}px`, width: `${GT_W}px`, height: `${GT_H}px`, backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1.5px solid ${isActiveGate ? gate.color : '#CBD5E1'}`, boxShadow: isActiveGate ? `0 8px 20px ${gate.color}2B` : '0 3px 10px rgba(15, 23, 42, 0.05)', padding: '11px 13px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: flowState.isFlowActive && !isActiveGate ? 0.54 : 1, zIndex: 12 }}>
            <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isActiveGate ? gate.color : '#94A3B8', border: '2px solid #FFFFFF' }} />
            <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isActiveGate ? gate.color : '#94A3B8', border: '2px solid #FFFFFF' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><GateIcon size={15} color={gate.color} />{gate.labelVi}</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#475569', lineHeight: 1.35 }}>
              {isActiveGate ? `Đang điều phối: ${flowState.effectiveDisplayActionObj?.labelVi || gate.shortVi}` : gate.code === 'AUTO' ? 'Gửi lệnh WebSocket trực tiếp xuống K8s Agent.' : gate.code === 'HITL' ? 'Giữ lệnh rủi ro cao chờ kỹ sư duyệt.' : 'Dừng can thiệp cụm K8s & ghi Audit Log.'}
            </div>
            <div style={{ fontSize: '0.63rem', fontWeight: 800, color: isActiveGate ? gate.color : '#64748B' }}>
              {isActiveGate ? '● LUỒNG ĐANG CHẠY QUA ĐÂY' : 'Trạng thái chờ'}
            </div>
          </div>
        );
      })}

      {/* ============================================================ */}
      {/* CỘT 07: HẬU KIỂM 60S                                         */}
      {/* ============================================================ */}
      {(() => {
        const allSlaHealthyLive = verificationChecks.every((chk) => chk.ok);
        const isAuditHaltedLive =
          !isSimulating &&
          (isAuditActive ||
            isCircuitBreakerTripped ||
            (flowState.isFlowActive && flowState.effectiveDisplayActionObj?.code === 'NO_ACTION'));
        const verifyAccentColor = isUnrecoveredLoop
          ? '#DC2626'
          : isAuditHaltedLive
            ? '#E11D48'
            : flowState.isFlowActive
              ? '#0284C7'
              : '#94A3B8';
        const verifyBorderColor = isUnrecoveredLoop
          ? '#DC2626'
          : isAuditHaltedLive
            ? '#E11D48'
            : flowState.isFlowActive
              ? '#0284C7'
              : '#CBD5E1';
        const verifyHeaderBg = isUnrecoveredLoop
          ? '#FEF2F2'
          : isAuditHaltedLive
            ? '#FFF1F2'
            : '#F0F9FF';
        const verifyHeaderBorder = isUnrecoveredLoop
          ? '#FECACA'
          : isAuditHaltedLive
            ? '#FECDD3'
            : '#BAE6FD';
        const verifyHeaderBadgeText = isUnrecoveredLoop
          ? 'CHƯA HỒI PHỤC'
          : isAuditHaltedLive
            ? `${recoveryStats?.totalActions ?? 0} THỬ • NGẮT MẠCH`
            : isSimulating
              ? flowState.isFlowActive
                ? 'ĐÃ HỒI PHỤC'
                : `${recoveryStats?.totalActions ?? 0} ĐÃ THỬ`
              : isVerifyingInProgress
                ? 'ĐANG HẬU KIỂM'
                : `${recoveryStats?.totalActions ?? 0} ĐÃ THỬ (24h)`;
        const verifyFooterText = isUnrecoveredLoop
          ? `↻ Quay về 04B Re-RCA → Leo thang ${flowState.effectiveDisplayActionObj?.code || 'NO_ACTION'}`
          : isAuditHaltedLive
            ? '⛔ Ngắt mạch AUDIT — Chỉ giám sát SLA & ghi nhận lịch sử'
            : !isSimulating && flowState.isFlowActive && !allSlaHealthyLive
              ? '⏳ Chưa đạt đủ 4 tiêu chí SLA — Tiếp tục theo dõi'
              : lastResolvedIncident && !flowState.isFlowActive
                ? '✓ Gần nhất: Tự đóng & về 00 Service'
                : '✓ Đạt SLA → Tự đóng → Về 00 Service';

        return (
          <div data-testid="d2-verify-card" style={{ position: 'absolute', left: `${VF_X}px`, top: `${VF_Y}px`, width: `${VF_W}px`, height: `${VF_H}px`, backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${verifyBorderColor}`, boxShadow: isUnrecoveredLoop ? '0 10px 24px rgba(220, 38, 38, 0.22)' : isAuditHaltedLive ? '0 10px 24px rgba(225, 29, 72, 0.16)' : flowState.isFlowActive ? '0 10px 24px rgba(2, 132, 199, 0.18)' : '0 4px 14px rgba(15, 23, 42, 0.06)', display: 'flex', flexDirection: 'column', zIndex: 13 }}>
            <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: verifyAccentColor, border: '2px solid #FFFFFF' }} />
            <div style={{ position: 'absolute', bottom: '-6px', left: '34%', transform: 'translateX(-50%)', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#0284C7', border: '2px solid #FFFFFF' }} />
            <div style={{ position: 'absolute', bottom: '-6px', left: '68%', transform: 'translateX(-50%)', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#DC2626', border: '2px solid #FFFFFF' }} />

            <div style={{ padding: '10px 13px', backgroundColor: verifyHeaderBg, borderBottom: `1px solid ${verifyHeaderBorder}`, borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isUnrecoveredLoop ? '#DC2626' : isAuditHaltedLive ? '#BE123C' : '#0369A1', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className={isVerifyingInProgress && !isSimulating ? 'animate-spin' : ''} /> Hậu Kiểm 60s
              </span>
              <span data-testid="d2-verify-status-badge" style={{ fontSize: '0.58rem', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', backgroundColor: isUnrecoveredLoop ? '#FEE2E2' : isAuditHaltedLive ? '#FFE4E6' : '#E0F2FE', color: isUnrecoveredLoop ? '#DC2626' : isAuditHaltedLive ? '#BE123C' : '#0369A1', whiteSpace: 'nowrap' }}>
                {verifyHeaderBadgeText}
              </span>
            </div>

            <div style={{ padding: '9px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
              <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#475569' }}>Đo lại 12 mẫu (60s) trên 4 tiêu chí SLA:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {verificationChecks.map((chk) => (
                  <div key={chk.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '7px', backgroundColor: !chk.ok ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${!chk.ok ? '#FCA5A5' : '#E2E8F0'}`, fontSize: '0.62rem' }}>
                    <span style={{ fontWeight: 700, color: '#1E293B' }}>{chk.label}</span>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: !chk.ok ? '#DC2626' : '#059669' }}>{!chk.ok ? `✕ ${chk.failText}` : `✓ ${chk.okText}`}</span>
                  </div>
                ))}
              </div>

              <div data-testid="d2-verify-live-stats" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '7px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.6rem' }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>
                  24h ({recoveryStats?.totalActions ?? 0} thử): {recoveryStats?.succeededCount ?? 0} phục hồi • {recoveryStats?.failedCount ?? 0} chưa
                </span>
                <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: recoveryStats?.successRate != null && recoveryStats.successRate < 50 ? '#DC2626' : '#059669' }}>
                  {recoveryStats?.successRate != null ? `${recoveryStats.successRate}%` : '—'}
                </span>
              </div>

              <div onMouseDown={(e) => e.stopPropagation()} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', paddingTop: '2px' }}>
                <button type="button" data-testid="d2-verify-recovered-btn" onClick={() => onChangeVerifyOutcome('recovered')} style={{ padding: '5px 6px', borderRadius: '7px', border: `1px solid ${!isUnrecoveredLoop ? '#059669' : '#CBD5E1'}`, backgroundColor: !isUnrecoveredLoop ? '#ECFDF5' : '#FFFFFF', color: !isUnrecoveredLoop ? '#047857' : '#64748B', fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer' }}>
                  ✓ Đã phục hồi
                </button>
                <button type="button" data-testid="d2-verify-unrecovered-btn" onClick={() => onChangeVerifyOutcome('unrecovered')} style={{ padding: '5px 6px', borderRadius: '7px', border: `1px solid ${isUnrecoveredLoop ? '#DC2626' : '#CBD5E1'}`, backgroundColor: isUnrecoveredLoop ? '#FEF2F2' : '#FFFFFF', color: isUnrecoveredLoop ? '#DC2626' : '#64748B', fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer' }}>
                  ↻ Chưa phục hồi
                </button>
              </div>

              <div style={{ fontSize: '0.6rem', color: isUnrecoveredLoop ? '#DC2626' : isAuditHaltedLive ? '#BE123C' : '#0284C7', fontWeight: 700, borderTop: '1px solid #F1F5F9', paddingTop: '5px' }}>
                {verifyFooterText}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Nhãn chú thích 2 đường Vòng lặp Khép kín */}
      <div style={{ position: 'absolute', left: `${(serviceBottomX + verifyBottomResolveX) / 2 - 220}px`, top: `${FEEDBACK_RESOLVE_Y - 12}px`, transform: 'translateX(-50%)', zIndex: 8, pointerEvents: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 13px', borderRadius: '999px', backgroundColor: 'rgba(255, 255, 255, 0.96)', border: '1px solid #BAE6FD', color: '#0369A1', fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)' }}>
          <RefreshCw size={12} />
          Vòng lặp 1 (Đã phục hồi): Tự đóng sự cố → Giám sát 24/7 trên 00 Service &amp; Cột 01
        </span>
      </div>

      <div style={{ position: 'absolute', left: `${(rcaBottomX + verifyBottomEscalateX) / 2}px`, top: `${FEEDBACK_ESCALATE_Y - 12}px`, transform: 'translateX(-50%)', zIndex: 8, pointerEvents: 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 13px', borderRadius: '999px', backgroundColor: isUnrecoveredLoop ? '#FEF2F2' : 'rgba(255, 255, 255, 0.96)', border: `1px solid ${isUnrecoveredLoop ? '#FCA5A5' : '#FECACA'}`, color: '#DC2626', fontSize: '0.66rem', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)' }}>
          <RefreshCw size={12} />
          {isUnrecoveredLoop ? `Vòng lặp 2 (Chưa phục hồi): Hồi tiếp Re-RCA (04B) → Leo thang ${flowState.effectiveDisplayActionObj?.code || 'NO_ACTION'}` : 'Vòng lặp 2 (Nếu Chưa phục hồi): Quay về 04B Re-RCA → Leo thang Action Cấp 2 / Circuit Breaker'}
        </span>
      </div>
    </div>
  );
};

export default BranchedPipelineSection;
