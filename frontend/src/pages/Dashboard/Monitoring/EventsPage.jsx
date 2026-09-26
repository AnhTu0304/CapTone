import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
} from 'lucide-react';

// Sample real Kubernetes Cluster Events
const K8S_EVENTS = [
  {
    id: 1,
    type: 'Warning',
      reason: 'FailedScheduling',
      object: 'Pod/order-processor-batch-88q1',
      ns: 'production',
      message: '0/8 nodes are available: 3 node(s) had untolerated taint {node.kubernetes.io/unreachable}, 5 Insufficient cpu.',
      age: '2 phút trước',
      count: 4,
    },
    {
      id: 2,
      type: 'Normal',
      reason: 'ScalingReplicaSet',
      object: 'Deployment/payment-service',
      ns: 'production',
      message: 'Scaled up replica set payment-service-7f8d to 3 from 2 by MAPE-K Autoscaler.',
      age: '5 phút trước',
      count: 1,
    },
    {
      id: 3,
      type: 'Normal',
      reason: 'Pulled',
      object: 'Pod/payment-service-7f8d-x9b2q',
      ns: 'production',
      message: 'Container image "registry.selfheal.io/payment:v2.4.1" already present on machine.',
      age: '6 phút trước',
      count: 1,
    },
    {
      id: 4,
      type: 'Normal',
      reason: 'Created',
      object: 'Pod/payment-service-7f8d-x9b2q',
      ns: 'production',
      message: 'Created container payment-service.',
      age: '6 phút trước',
      count: 1,
    },
    {
      id: 5,
      type: 'Normal',
      reason: 'Started',
      object: 'Pod/payment-service-7f8d-x9b2q',
      ns: 'production',
      message: 'Started container payment-service.',
      age: '6 phút trước',
      count: 1,
    },
    {
      id: 6,
      type: 'Warning',
      reason: 'Unhealthy',
      object: 'Pod/order-processor-66bf-aa18x',
      ns: 'production',
      message: 'Liveness probe failed: HTTP probe failed with statuscode: 500 (connection pool exhausted).',
      age: '12 phút trước',
      count: 3,
    },
    {
      id: 7,
      type: 'Normal',
      reason: 'Killing',
      object: 'Pod/order-processor-66bf-aa18x',
      ns: 'production',
      message: 'Container order-processor failed liveness probe, will be restarted.',
      age: '11 phút trước',
      count: 1,
    },
    {
      id: 8,
      type: 'Normal',
      reason: 'NodeReady',
      object: 'Node/worker-04',
      ns: 'default',
      message: 'Node worker-04 status is now: NodeReady.',
      age: '24 phút trước',
      count: 1,
    },
    {
      id: 9,
      type: 'Normal',
      reason: 'LeaderElection',
      object: 'ConfigMap/selfheal-system/agent-leader',
      ns: 'selfheal-system',
      message: 'selfheal-agent-daemon-tk98 became leader.',
      age: '35 phút trước',
      count: 1,
    },
  ];

export const EventsPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = useMemo(() => {
    return K8S_EVENTS.filter((ev) => {
      const matchType = selectedType === 'all' || ev.type === selectedType;
      const matchQuery =
        !searchQuery ||
        ev.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.object.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.ns.toLowerCase().includes(searchQuery.toLowerCase());

      return matchType && matchQuery;
    });
  }, [selectedType, searchQuery]);

  return (
    <div className="dashboard-events-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Dòng Sự Kiện Cụm Máy Chủ (Cluster Events Stream)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Giám sát toàn diện các sự kiện Kube-apiserver và bộ điều khiển
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới sự kiện</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Type Filter Buttons */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(61, 59, 79, 0.05)', padding: '2px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-sm)' }}>
            {[
              { id: 'all', label: 'Tất cả Sự kiện' },
              { id: 'Warning', label: 'Cảnh báo (Warning)' },
              { id: 'Normal', label: 'Thông thường (Normal)' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: selectedType === t.id ? '#FFFFFF' : 'transparent',
                  color: selectedType === t.id ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-xs)',
                  boxShadow: selectedType === t.id ? 'var(--dash-shadow-xs)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Query Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm sự kiện, đối tượng, lý do..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '32px',
                width: '280px',
                padding: '0 10px 0 28px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                outline: 'none',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
          Hiển thị <strong>{filteredEvents.length}</strong> sự kiện gần nhất
        </div>
      </div>

      {/* Events List / Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '110px' }}>LOẠI</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '150px' }}>LÝ DO</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '220px' }}>ĐỐI TƯỢNG (OBJECT)</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THÔNG ĐIỆP CHI TIẾT</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '110px' }}>THỜI ĐIỂM</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                  Không có sự kiện nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredEvents.map((ev) => {
                const isWarning = ev.type === 'Warning';

                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '2px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: isWarning ? '#FFF1F2' : 'rgba(5, 150, 105, 0.1)',
                          color: isWarning ? '#E11D48' : '#059669',
                          border: isWarning ? '1px solid #FDA4AF' : '1px solid #34D399',
                        }}
                      >
                        {isWarning ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                        <span>{ev.type}</span>
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                      {ev.reason}
                    </td>

                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-primary)' }}>
                      <div>{ev.object}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>ns: {ev.ns}</div>
                    </td>

                    <td style={{ padding: '12px 16px', color: isWarning ? '#991B1B' : 'var(--dash-text-primary)', lineHeight: 1.45 }}>
                      <div>{ev.message}</div>
                      {ev.count > 1 && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          (Lặp lại {ev.count} lần)
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)', whiteSpace: 'nowrap' }}>
                      {ev.age}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EventsPage;
