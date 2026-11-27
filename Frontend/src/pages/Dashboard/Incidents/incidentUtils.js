import i18n from '../../../i18n';

// Helper chuyển ngữ tiêu đề sự cố và mức độ đồng bộ toàn hệ thống
export const translateIncidentTitle = (rawTitle) => {
  if (!rawTitle) return '';
  let title = String(rawTitle);

  title = title.replace(/\[(Cảnh báo AI|AI Alert|Alert|Cảnh báo)\]\s*/gi, '').trim();

  const causeTranslations = [
    { en: /\bUNKNOWN\b/gi, key: 'dashHealing:incidentUtils.causes.unknown' },
    { en: /Unstable application pod/gi, key: 'dashHealing:incidentUtils.causes.unstablePod' },
    { en: /Container memory exhausted/gi, key: 'dashHealing:incidentUtils.causes.oom' },
    { en: /Storage capacity exhausted/gi, key: 'dashHealing:incidentUtils.causes.diskFull' },
    { en: /CPU saturation/gi, key: 'dashHealing:incidentUtils.causes.cpuSaturation' },
    { en: /Traffic overload/gi, key: 'dashHealing:incidentUtils.causes.trafficOverload' },
    { en: /Deployment failure/gi, key: 'dashHealing:incidentUtils.causes.deploymentFailure' },
    { en: /Upstream dependency failure/gi, key: 'dashHealing:incidentUtils.causes.upstreamFailure' },
    { en: /Application errors/gi, key: 'dashHealing:incidentUtils.causes.appErrors' },
    { en: /Service performance degradation/gi, key: 'dashHealing:incidentUtils.causes.perfDegradation' },
    { en: /Insufficient available replicas/gi, key: 'dashHealing:incidentUtils.causes.insufficientReplicas' },
    { en: /Kubernetes scheduling failure/gi, key: 'dashHealing:incidentUtils.causes.schedulingFailure' },
    { en: /Workload underutilized \(scale down opportunity\)/gi, key: 'dashHealing:incidentUtils.causes.underutilizedScaleDown' },
    { en: /Workload underutilized/gi, key: 'dashHealing:incidentUtils.causes.underutilized' },
    { en: /High latency detected/gi, key: 'dashHealing:incidentUtils.causes.highLatencyDetected' },
    { en: /High latency/gi, key: 'dashHealing:incidentUtils.causes.highLatency' },
    { en: /Memory leak detected/gi, key: 'dashHealing:incidentUtils.causes.memoryLeak' },
    { en: /Pod crash loop back-off/gi, key: 'dashHealing:incidentUtils.causes.crashLoop' },
    { en: /OOMKilled/gi, key: 'dashHealing:incidentUtils.causes.oomKilled' },
    { en: /OOM_WIREDTIGER_CACHE_PRESSURE_DUE_TO_UNINDEXED_QUERY/gi, key: 'dashHealing:incidentUtils.causes.wiredTigerOom' },
  ];

  for (const { en, key } of causeTranslations) {
    title = title.replace(en, () => i18n.t(key));
  }

  title = title.replace(/\s+(?:on|trên)\s+/gi, i18n.t('dashHealing:incidentUtils.onConnector'));
  return title;
};

export const translateSeverity = (sev) => {
  if (!sev) return i18n.t('dashHealing:incidentUtils.severity.MEDIUM');
  const s = String(sev).toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH' || s === 'MEDIUM' || s === 'LOW') {
    return i18n.t(`dashHealing:incidentUtils.severity.${s}`);
  }
  return s;
};

// Bộ từ điển tên hành động tự phục hồi (dynamic getters theo ngôn ngữ hiện tại)
const ACTION_DISPLAY_KEYS = [
  'SCALE_REPLICAS',
  'SCALE_UP',
  'SCALE_DOWN',
  'RESTART_POD',
  'REPLACE_POD',
  'DRAIN_NODE',
  'RESTART_DEPLOYMENT',
  'ROLLBACK_DEPLOYMENT',
  'CLEANUP_STORAGE',
  'CLEANUP_TEMP_FILES',
  'TEMPORARY_IP_BLOCK',
  'BLOCK_IP_TEMP',
  'BLOCK_IP',
  'IP_BLOCK',
  'NO_ACTION',
];

export const ACTION_DISPLAY_NAMES_VI = ACTION_DISPLAY_KEYS.reduce((acc, code) => {
  Object.defineProperty(acc, code, {
    enumerable: true,
    configurable: true,
    get: () => i18n.t(`dashHealing:incidentUtils.actions.${code}`),
  });
  return acc;
}, {});

// Chuyển ngữ thông điệp thực thi từ K8s Agent / Database theo ngôn ngữ hiện tại
export const translateActionMessageToVi = (rawMsg, targetName = '', actionFriendlyName, resolvedNs = 'default') => {
  const friendlyAction = actionFriendlyName || i18n.t('dashHealing:incidentUtils.actions.DEFAULT');
  if (!rawMsg) {
    return i18n.t('dashHealing:incidentUtils.actionMsg.default', {
      action: friendlyAction,
      target: targetName,
    });
  }

  let text = String(rawMsg).trim();

  // 0. Safety Guard Blocked namespace
  if (text.includes('Safety Guard Blocked') || text.includes('protected Kubernetes system namespace')) {
    const nsMatch = text.match(/Namespace '([^']+)'/i);
    const ns = nsMatch ? nsMatch[1] : resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.safetyGuard', {
      action: friendlyAction,
      target: targetName,
      ns,
    });
  }

  // 1. RBAC 403 Forbidden
  const rbacMatch = text.match(
    /User\??\s*"([^"\\]+)\??"\s+cannot\s+(\w+)\s+resource\s+\??"([^"\\]+)\??"(?:\s+in API group\s+\??"([^"\\]*)\??")?(?:\s+in the namespace\s+\??"([^"\\]+)\??")?/i
  ) || text.match(
    /User\s+"([^"]+)"\s+cannot\s+(\w+)\s+resource\s+"([^"]+)"(?:\s+in API group\s+"([^"]*)")?(?:\s+in the namespace\s+"([^"]+)")?/i
  );
  if (rbacMatch || text.includes('(403)') || text.includes('Forbidden')) {
    const saUser = rbacMatch ? rbacMatch[1].replace('system:serviceaccount:', '') : 'selfheal-system:selfheal-agent-sa';
    const verb = rbacMatch ? rbacMatch[2] : 'patch';
    const resource = rbacMatch ? rbacMatch[3] : 'deployments/scale';
    const targetNs = rbacMatch && rbacMatch[5] ? rbacMatch[5] : resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.rbac403', {
      action: friendlyAction,
      target: targetName,
      saUser,
      verb,
      resource,
      ns: targetNs,
    });
  }

  // 2. HTTP response headers dump
  if (text.includes('HTTPHeaderDict') || text.includes('HTTP response headers:')) {
    text = text.split('HTTP response headers:')[0].trim();
  }

  // 3. Scaling: "deployment/sme-order-service scaled (scale_up) successfully from 5 to 5 replicas in 'default'"
  const scaleMatch = text.match(
    /(?:[a-z0-9_-]+\/)?([a-z0-9_-]+)\s+scaled\s+\((scale_up|scale_down)\)\s+successfully\s+from\s+(\w+)\s+to\s+(\d+)\s+replicas(?:\s+in\s+'([^']+)')?/i
  );
  if (scaleMatch) {
    const sTarget = scaleMatch[1] || targetName;
    const isUp = scaleMatch[2].toLowerCase() === 'scale_up';
    const sDir = i18n.t(isUp ? 'dashHealing:incidentUtils.actionMsg.dirUp' : 'dashHealing:incidentUtils.actionMsg.dirDown');
    const sPrep = i18n.t(isUp ? 'dashHealing:incidentUtils.actionMsg.prepUp' : 'dashHealing:incidentUtils.actionMsg.prepDown');
    const sFrom = scaleMatch[3];
    const sTo = scaleMatch[4];
    const sNs = scaleMatch[5] || resolvedNs;
    const fromText = sFrom === 'unknown' ? i18n.t('dashHealing:incidentUtils.actionMsg.currentCount') : sFrom;
    return i18n.t('dashHealing:incidentUtils.actionMsg.scaleSuccess', {
      dir: sDir,
      target: sTarget,
      from: fromText,
      prep: sPrep,
      to: sTo,
      ns: sNs,
    });
  }

  // 4. Scale skipped at minimum
  const scaleMinMatch = text.match(
    /Workload\s+(?:[a-z0-9_-]+\/)?([a-z0-9_-]+)\s+currently at minimum\s+(\d+)\s+replica(?:\s+in\s+'([^']+)')?,\s+scale down skipped safely/i
  );
  if (scaleMinMatch) {
    const sTarget = scaleMinMatch[1] || targetName;
    const sNs = scaleMinMatch[3] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.scaleMin', {
      target: sTarget,
      ns: sNs,
    });
  }

  // 5. Rolling restart
  const restartMatch = text.match(
    /Zero-downtime rolling restart patched successfully on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (restartMatch) {
    const rTarget = restartMatch[1] || targetName;
    const rNs = restartMatch[2] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.rollingRestart', {
      target: rTarget,
      ns: rNs,
    });
  }

  // 6. Terminate & replace pod
  const replacePodMatch = text.match(
    /Specific unhealthy pod '([^']+)' terminated and successfully replaced by ReplicaSet(?:\s+in\s+'([^']+)')?/i
  );
  if (replacePodMatch) {
    const pName = replacePodMatch[1];
    const pNs = replacePodMatch[2] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.replacePod', {
      pod: pName,
      ns: pNs,
    });
  }

  // 7. Replaced pod via rolling restart
  const replaceRollingMatch = text.match(
    /Replaced pod via rolling restart on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (replaceRollingMatch) {
    const rTarget = replaceRollingMatch[1] || targetName;
    const rNs = replaceRollingMatch[2] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.replaceRolling', {
      target: rTarget,
      ns: rNs,
    });
  }

  // 8. Rollback
  const rollbackMatch = text.match(
    /True Rollback executed:\s*Restored Deployment '([^']+)' from Revision (\d+) back to Revision (\d+)(?:[^\n\r]*)(?:\s+in\s+'([^']+)')?/i
  );
  if (rollbackMatch) {
    const rbTarget = rollbackMatch[1] || targetName;
    const fromRev = rollbackMatch[2];
    const toRev = rollbackMatch[3];
    const rbNs = rollbackMatch[4] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.rollback', {
      target: rbTarget,
      fromRev,
      toRev,
      ns: rbNs,
    });
  }

  // 9. Storage cleanup
  const storageMatch = text.match(
    /Ephemeral disk cleanup and emptyDir reclamation executed successfully on ([^' ]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (storageMatch) {
    const sTarget = storageMatch[1] || targetName;
    const sNs = storageMatch[2] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.storageCleanup', {
      target: sTarget,
      ns: sNs,
    });
  }

  // 10. Limits adjusted
  const limitsMatch = text.match(
    /Adjusted CPU\/RAM resource limits and applied rolling update on (?:[a-z0-9_-]+\/)?([a-z0-9_-]+)(?:\s+in\s+'([^']+)')?/i
  );
  if (limitsMatch) {
    const lTarget = limitsMatch[1] || targetName;
    const lNs = limitsMatch[2] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.limitsAdjusted', {
      target: lTarget,
      ns: lNs,
    });
  }

  // 11. Node cordon
  const cordonMatch = text.match(
    /Cordoned degraded node '([^']+)' and rescheduled pods(?:[^\n\r]*)to healthy node '([^']+)'/i
  );
  if (cordonMatch) {
    const cNode = cordonMatch[1];
    const hNode = cordonMatch[2];
    return i18n.t('dashHealing:incidentUtils.actionMsg.nodeCordon', {
      cNode,
      hNode,
    });
  }

  // 12. Single-node guard
  if (text.includes('Single-node cluster guard')) {
    return i18n.t('dashHealing:incidentUtils.actionMsg.singleNodeGuard', {
      target: targetName,
    });
  }

  // 13. NetworkPolicy block IP
  const netBlockMatch = text.match(
    /NetworkPolicy '([^']+)' (?:deployed|updated) successfully:\s*IP '([^']+)' blocked from accessing ([^' ]+)(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (netBlockMatch) {
    const npPolicy = netBlockMatch[1];
    const npIp = netBlockMatch[2];
    const npTarget = netBlockMatch[3] || targetName;
    const npNs = netBlockMatch[4] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.netBlock', {
      policy: npPolicy,
      ip: npIp,
      target: npTarget,
      ns: npNs,
    });
  }

  // 14. NetworkPolicy unblock
  const netUnblockMatch = text.match(
    /NetworkPolicy '([^']+)' removed:\s*IP '([^']+)' unblocked successfully(?:\s+in namespace\s+'([^']+)')?/i
  );
  if (netUnblockMatch) {
    const npIp = netUnblockMatch[2];
    const npNs = netUnblockMatch[3] || resolvedNs;
    return i18n.t('dashHealing:incidentUtils.actionMsg.netUnblock', {
      ip: npIp,
      ns: npNs,
    });
  }

  // 15. NO_ACTION telemetry verified
  if (text.includes('Zero-downtime preserved') || text.includes('NO_ACTION applied')) {
    return i18n.t('dashHealing:incidentUtils.actionMsg.noActionVerified', {
      target: targetName,
    });
  }

  // 16. Self-healing mitigate action
  if (text.includes('Self-healing mitigate action')) {
    return i18n.t('dashHealing:incidentUtils.actionMsg.mitigateSuccess', {
      action: friendlyAction,
      target: targetName,
    });
  }

  // Clean English verification tag if present
  text = text.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':');
  text = text.replace(/Post-Action Verification Failed:?\s*/gi, '');

  return text;
};
