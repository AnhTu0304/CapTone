import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Cpu, Box, Layers, AlertTriangle, ShieldAlert } from 'lucide-react';
import K8sFreshnessBadge from './K8sFreshnessBadge';

/**
 * Modal hiển thị chi tiết tài nguyên K8s: Node, Pod, hoặc Deployment
 */
export const K8sResourceDetailModal = ({ resource, type, onClose }) => {
  const { t } = useTranslation('dashMonitoring');

  if (!resource) return null;

  const typeTitle =
    type === 'NODE'
      ? t('k8sComponents.resourceModal.titleNode')
      : type === 'POD'
        ? t('k8sComponents.resourceModal.titlePod')
        : t('k8sComponents.resourceModal.titleDeployment');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {type === 'NODE' && <Cpu size={20} color="#2563EB" />}
            {type === 'POD' && <Box size={20} color="#7C3AED" />}
            {type === 'DEPLOYMENT' && <Layers size={20} color="#059669" />}
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                {t('k8sComponents.resourceModal.titlePrefix')} {typeTitle}: {resource.name}
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                UID: {resource.kubernetes_uid || resource.id || 'N/A'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Freshness Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
              {t('k8sComponents.resourceModal.freshnessLabel')}
            </span>
            <K8sFreshnessBadge freshness={resource.freshness} showDetails />
          </div>

          {resource.freshness?.warning && (
            <div style={{ padding: '10px 14px', backgroundColor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '8px', color: '#92400E', fontSize: '0.8125rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{resource.freshness.warning}</span>
            </div>
          )}

          {/* Node Details */}
          {type === 'NODE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.nodeStatusLabel')}</span>
                  <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.9375rem', color: resource.ready ? '#059669' : '#DC2626' }}>
                    {resource.status} ({resource.effective_status})
                  </div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.kubeletVersion')}</span>
                  <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}>
                    {resource.kubelet_version || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                  {t('k8sComponents.resourceModal.nodeConditions')}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {Object.entries(resource.conditions || {}).map(([cond, statusVal]) => {
                    const isOk = cond === 'Ready' ? statusVal === 'True' : statusVal === 'False';
                    return (
                      <div
                        key={cond}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${isOk ? '#A7F3D0' : '#FECACA'}`,
                          backgroundColor: isOk ? '#ECFDF5' : '#FEF2F2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{cond}</span>
                        <span style={{ fontWeight: 700, color: isOk ? '#059669' : '#DC2626' }}>
                          {String(statusVal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Pressures */}
              {Array.isArray(resource.active_pressures) && resource.active_pressures.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '0.8125rem', marginBottom: '6px' }}>
                    <ShieldAlert size={16} /> {t('k8sComponents.resourceModal.activePressures')}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {resource.active_pressures.map((p) => (
                      <span key={p} style={{ backgroundColor: '#DC2626', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Capacity vs Allocatable */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>{t('k8sComponents.resourceModal.colResource')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('k8sComponents.resourceModal.colCapacity')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('k8sComponents.resourceModal.colAllocatable')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>CPU</td>
                      <td style={{ padding: '8px 12px' }}>{resource.capacity?.cpu_millicores ? `${resource.capacity.cpu_millicores / 1000} vCPU` : 'N/A'}</td>
                      <td style={{ padding: '8px 12px' }}>{resource.allocatable?.cpu_millicores ? `${resource.allocatable.cpu_millicores / 1000} vCPU` : 'N/A'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t('k8sComponents.resourceModal.ramLabel')}</td>
                      <td style={{ padding: '8px 12px' }}>{resource.capacity?.memory_bytes ? `${(resource.capacity.memory_bytes / 1024 ** 3).toFixed(1)} GB` : 'N/A'}</td>
                      <td style={{ padding: '8px 12px' }}>{resource.allocatable?.memory_bytes ? `${(resource.allocatable.memory_bytes / 1024 ** 3).toFixed(1)} GB` : 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t('k8sComponents.resourceModal.podsLimitLabel')}</td>
                      <td style={{ padding: '8px 12px' }}>{resource.capacity?.pods ?? 110}</td>
                      <td style={{ padding: '8px 12px' }}>{resource.allocatable?.pods_allocatable ?? resource.allocatable?.pods_capacity ?? 110}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pod Details */}
          {type === 'POD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.podPhaseStatus')}</span>
                  <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.9375rem', color: resource.is_healthy ? '#059669' : '#DC2626' }}>
                    {resource.phase} &bull; {resource.status}
                  </div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.podNode')}</span>
                  <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}>
                    {resource.node_name || 'unassigned'}
                  </div>
                </div>
              </div>

              {/* CrashLoopBackOff Banner */}
              {Array.isArray(resource.crash_loop_containers) && resource.crash_loop_containers.length > 0 && (
                <div style={{ padding: '14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px' }}>
                    <AlertTriangle size={18} /> {t('k8sComponents.resourceModal.crashLoopTitle')}
                  </div>
                  {resource.crash_loop_containers.map((c, i) => (
                    <div key={i} style={{ fontSize: '0.8125rem', color: '#7F1D1D', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>Container: <strong>{c.name}</strong> {t('k8sComponents.resourceModal.crashLoopRestarts', { count: c.restart_count })}</div>
                      {c.last_terminated_reason && <div>{t('k8sComponents.resourceModal.crashLoopLastReason')} <strong>{c.last_terminated_reason}</strong> (Exit Code: {c.last_exit_code})</div>}
                      {c.waiting_message && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', backgroundColor: '#FEE2E2', padding: '6px 10px', borderRadius: '4px' }}>{c.waiting_message}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Containers List */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                  {t('k8sComponents.resourceModal.containersListTitle', { count: resource.containers?.length || 0 })}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(resource.containers || []).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div>
                        <strong>{c.name}</strong> <span style={{ color: '#64748B', fontSize: '0.75rem' }}>({c.image || t('k8sComponents.resourceModal.noImage')})</span>
                        {c.is_init && <span style={{ marginLeft: '6px', fontSize: '0.6875rem', backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '1px 5px', borderRadius: '3px' }}>INIT</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: c.ready ? '#059669' : '#DC2626', fontWeight: 600 }}>
                          {c.ready ? 'Ready' : 'NotReady'}
                        </span>
                        <span style={{ color: '#64748B' }}>Restarts: {c.restart_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Deployment Details */}
          {type === 'DEPLOYMENT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.rolloutStatus')}</span>
                  <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.9375rem', color: resource.is_healthy ? '#059669' : '#DC2626' }}>
                    {resource.status} ({resource.effective_status})
                  </div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.generationLabel')}</span>
                  <div style={{ fontWeight: 700, marginTop: '4px', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}>
                    Gen {resource.observed_generation ?? '—'} / {resource.generation ?? '—'}
                  </div>
                </div>
              </div>

              {/* Replica Breakdown Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.desired')}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '2px' }}>{resource.desired_replicas ?? resource.replicas?.desired ?? '—'}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.ready')}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>{resource.ready_replicas ?? resource.replicas?.ready ?? '—'}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.available')}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#2563EB', marginTop: '2px' }}>{resource.available_replicas ?? resource.replicas?.available ?? '—'}</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('k8sComponents.resourceModal.updated')}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#7C3AED', marginTop: '2px' }}>{resource.updated_replicas ?? resource.replicas?.updated ?? '—'}</div>
                </div>
              </div>

              {/* Degraded Alert */}
              {resource.replicas?.missing_ready > 0 && (
                <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.8125rem' }}>
                  <strong>{t('k8sComponents.resourceModal.missingPodsTitle')}</strong> {t('k8sComponents.resourceModal.missingPodsDesc', { missingReady: resource.replicas.missing_ready, missingAvail: resource.replicas.missing_available || 0 })}
                </div>
              )}

              {/* Conditions List */}
              {Array.isArray(resource.conditions) && resource.conditions.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8125rem', fontWeight: 700, color: '#475569' }}>
                    {t('k8sComponents.resourceModal.rolloutConditionsTitle')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {resource.conditions.map((cond, idx) => (
                      <div key={idx} style={{ padding: '6px 10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                        <span><strong>{cond.type}</strong>: {cond.status} {cond.reason ? `(${cond.reason})` : ''}</span>
                        {cond.message && <span style={{ color: '#64748B' }}>{cond.message}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#F8FAFC' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#334155',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default K8sResourceDetailModal;
