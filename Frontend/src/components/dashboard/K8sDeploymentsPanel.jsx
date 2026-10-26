import React, { useState, useMemo } from 'react';
import { Layers, Search, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import K8sFreshnessBadge from './K8sFreshnessBadge';

/**
 * Panel hiển thị danh sách Deployments & Replicas K8s
 * Phản ánh đúng schema Task 5.2 Backend:
 * - status: 'Healthy' | 'ScaledToZero' | 'Progressing' | 'Degraded' | 'ProgressDeadlineExceeded' | 'ReplicaFailure' | 'InsufficientData' | 'Unverified'
 * - replicas: { desired, ready, available, updated, unavailable, missing_ready, missing_available, outdated_replicas, is_satisfied }
 */
export const K8sDeploymentsPanel = ({
  deployments = [],
  namespaces = [],
  isLoading = false,
  onSelectDeployment,
}) => {
  const [search, setSearch] = useState('');
  const [selectedNs, setSelectedNs] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const filteredDeployments = useMemo(() => {
    return deployments.filter((dep) => {
      const matchesSearch =
        (dep.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (dep.namespace || '').toLowerCase().includes(search.toLowerCase());
      const matchesNs = selectedNs === 'ALL' || dep.namespace === selectedNs;
      const statusValue = dep.status || dep.rollout_status || 'Unknown';
      const effectiveStatus = dep.effective_status || statusValue;
      const matchesStatus =
        selectedStatus === 'ALL' ||
        statusValue.toLowerCase() === selectedStatus.toLowerCase() ||
        effectiveStatus.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesNs && matchesStatus;
    });
  }, [deployments, search, selectedNs, selectedStatus]);

  const getStatusBadge = (dep) => {
    const status = dep.status || dep.rollout_status || 'Unknown';
    const effective = dep.effective_status || status;

    if (effective === 'Unverified') {
      return (
        <span
          title="Dữ liệu quan sát đã cũ hoặc Agent mất kết nối, chưa thể xác minh trạng thái hiện tại"
          style={{
            fontSize: '0.6875rem',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: 700,
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AlertTriangle size={12} /> Chưa xác minh
        </span>
      );
    }

    switch (status) {
      case 'Healthy':
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#ECFDF5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={12} /> Khỏe mạnh
          </span>
        );
      case 'ScaledToZero':
        return (
          <span
            title="Deployment chủ động scale về 0 replicas (không phải lỗi)"
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#F1F5F9',
              color: '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={12} /> Scaled To Zero (0/0)
          </span>
        );
      case 'Progressing':
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} className="spin-slow" /> Đang Rollout
          </span>
        );
      case 'Degraded':
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={12} /> Thiếu Replica (Degraded)
          </span>
        );
      case 'ProgressDeadlineExceeded':
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#FEF2F2',
              color: '#B91C1C',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={12} /> Quá hạn Rollout (Timeout)
          </span>
        );
      case 'ReplicaFailure':
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={12} /> Lỗi tạo Replica
          </span>
        );
      case 'InsufficientData':
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#F8FAFC',
              color: '#64748B',
              border: '1px solid #CBD5E1',
            }}
          >
            Thiếu dữ liệu
          </span>
        );
      default:
        return (
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: '#F1F5F9',
              color: '#64748B',
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div className="dash-card" style={{ padding: '0px', overflow: 'hidden', border: '1px solid var(--dash-border)', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
      {/* Header & Controls */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', backgroundColor: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers size={18} color="var(--dash-primary)" />
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>
            Danh Sách Deployments & Quản Lý Replicas ({filteredDeployments.length}/{deployments.length} Deployments)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Tìm Deployment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '7px 12px 7px 30px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem', width: '200px' }}
            />
          </div>

          <select
            value={selectedNs}
            onChange={(e) => setSelectedNs(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
          >
            <option value="ALL">Tất cả Namespace ({namespaces.length})</option>
            {namespaces.map((ns) => {
              const nsName = ns.name || ns;
              return (
                <option key={nsName} value={nsName}>
                  Namespace: {nsName}
                </option>
              );
            })}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid var(--dash-border)', borderRadius: '6px', fontSize: '0.8125rem' }}
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="Healthy">Khỏe mạnh (Healthy)</option>
            <option value="Progressing">Đang Rollout</option>
            <option value="Degraded">Thiếu Replica (Degraded)</option>
            <option value="ScaledToZero">Scaled to Zero</option>
            <option value="ProgressDeadlineExceeded">Quá hạn Rollout</option>
            <option value="Unverified">Chưa xác minh</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {deployments.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Layers size={24} />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>Chưa có Deployment nào</h4>
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>
            Khi các Deployments được khởi chạy trên cụm K8s, Agent sẽ quét và đồng bộ trạng thái Replica về bảng này.
          </p>
        </div>
      ) : filteredDeployments.length === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
          Không tìm thấy Deployment nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--dash-border)', backgroundColor: '#FAFAFA', color: 'var(--dash-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 18px' }}>Tên Deployment</th>
                <th style={{ padding: '12px 18px' }}>Namespace</th>
                <th style={{ padding: '12px 18px' }}>Trạng Thái Rollout</th>
                <th style={{ padding: '12px 18px' }}>Replicas (Sẵn Sàng / Mong Muốn)</th>
                <th style={{ padding: '12px 18px' }}>Replicas Khả Dụng / Cập Nhật</th>
                <th style={{ padding: '12px 18px' }}>Generation (Obs / Des)</th>
                <th style={{ padding: '12px 18px' }}>Độ Tươi (Freshness)</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeployments.map((dep, idx) => {
                const desired = dep.desired_replicas ?? dep.replicas?.desired ?? null;
                const ready = dep.ready_replicas ?? dep.replicas?.ready ?? null;
                const available = dep.available_replicas ?? dep.replicas?.available ?? null;
                const updated = dep.updated_replicas ?? dep.replicas?.updated ?? null;

                const isDegraded =
                  desired !== null && desired > 0 && ((ready !== null && ready < desired) || (available !== null && available < desired));

                return (
                  <tr key={dep.id || dep.name || idx} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--dash-text-primary)' }}>
                      {dep.name}
                      {dep.rollout_in_progress && (
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.625rem',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            backgroundColor: '#DBEAFE',
                            color: '#1E40AF',
                            fontWeight: 700,
                          }}
                        >
                          UPDATING
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                        {dep.namespace || 'default'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>{getStatusBadge(dep)}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isDegraded ? '#DC2626' : (desired === 0 ? '#64748B' : '#059669'),
                        }}
                      >
                        {ready !== null ? ready : '—'} / {desired !== null ? desired : '—'}
                      </span>
                      {isDegraded && (
                        <span style={{ fontSize: '0.6875rem', color: '#DC2626', marginLeft: '6px' }}>
                          (Thiếu {desired - (ready ?? 0)})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ color: '#475569' }}>
                        Khả dụng: <strong>{available !== null ? available : '—'}</strong> &bull; Đã cập nhật:{' '}
                        <strong>{updated !== null ? updated : '—'}</strong>
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748B' }}>
                      {dep.observed_generation ?? '—'} / {dep.generation ?? '—'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <K8sFreshnessBadge freshness={dep.freshness} compact />
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onSelectDeployment && onSelectDeployment(dep)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Chi Tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default K8sDeploymentsPanel;
