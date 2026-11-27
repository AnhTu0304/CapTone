import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertTriangle, WifiOff, CheckCircle2 } from 'lucide-react';
import { getIntlLocale } from '../../i18n';

/**
 * Component hiển thị huy hiệu độ tươi dữ liệu (Freshness Badge)
 * theo chuẩn Task 5.2 & 5.3 Backend metadata:
 * - state: 'FRESH' | 'STALE' | 'NEVER_SYNCED'
 * - age_seconds: number | null
 * - agent_connected: boolean
 * - warning: string | null
 */
export const K8sFreshnessBadge = ({ freshness, compact = false, showDetails = false }) => {
  const { t, i18n } = useTranslation('dashMonitoring');
  const intlLocale = getIntlLocale(i18n.language);

  if (!freshness) return null;

  const { state, age_seconds, agent_connected, warning, observed_at } = freshness;

  let label = t('k8sComponents.freshness.syncing');
  let badgeColor = '#059669';
  let badgeBg = '#ECFDF5';
  let borderColor = '#A7F3D0';
  let Icon = CheckCircle2;

  const isAgentOffline = agent_connected === false;
  const isNeverSynced = state === 'NEVER_SYNCED' || (!observed_at && age_seconds == null);
  const isStale = state === 'STALE' || (typeof age_seconds === 'number' && age_seconds > 90);

  if (isNeverSynced) {
    label = t('k8sComponents.freshness.neverSynced');
    badgeColor = '#64748B';
    badgeBg = '#F1F5F9';
    borderColor = '#CBD5E1';
    Icon = Clock;
  } else if (isAgentOffline) {
    label = t('k8sComponents.freshness.agentOffline');
    badgeColor = '#DC2626';
    badgeBg = '#FEF2F2';
    borderColor = '#FECACA';
    Icon = WifiOff;
  } else if (isStale) {
    label = t('k8sComponents.freshness.stale', { seconds: age_seconds ?? '>90' });
    badgeColor = '#D97706';
    badgeBg = '#FFFBEB';
    borderColor = '#FDE68A';
    Icon = AlertTriangle;
  } else {
    label = age_seconds !== null && age_seconds !== undefined
      ? (age_seconds < 5 ? t('k8sComponents.freshness.justObserved') : t('k8sComponents.freshness.secondsAgo', { seconds: age_seconds }))
      : t('k8sComponents.freshness.realtime');
    badgeColor = '#059669';
    badgeBg = '#ECFDF5';
    borderColor = '#A7F3D0';
    Icon = CheckCircle2;
  }

  return (
    <div
      title={warning || (observed_at ? t('k8sComponents.freshness.observedAt', { time: new Date(observed_at).toLocaleString(intlLocale) }) : undefined)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: compact ? '2px 6px' : '3px 8px',
        borderRadius: '9999px',
        fontSize: compact ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        backgroundColor: badgeBg,
        color: badgeColor,
        border: `1px solid ${borderColor}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={compact ? 12 : 13} />
      <span>{label}</span>
      {showDetails && observed_at && (
        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400, marginLeft: '4px' }}>
          ({new Date(observed_at).toLocaleTimeString(intlLocale)})
        </span>
      )}
    </div>
  );
};

export default K8sFreshnessBadge;
