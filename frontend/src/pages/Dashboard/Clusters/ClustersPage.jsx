import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Server,
  Plus,
  RefreshCw,
  X
} from 'lucide-react';

const INITIAL_CLUSTERS = [
  {
    id: 'CLS-01',
    name: 'k8s-prod-cluster-01',
    environment: 'production',
    region: 'us-east-1 (N. Virginia)',
    version: 'v1.30.2',
    nodes: 3,
    pods: 84,
    agentStatus: 'Online (1.2ms)',
    controlPlaneHealth: 'Healthy (100%)',
    apiEndpoint: 'https://api.k8s-prod.acmecorp.vn:6443',
    status: 'ACTIVE',
  },
  {
    id: 'CLS-02',
    name: 'k8s-staging-cluster-01',
    environment: 'staging',
    region: 'ap-southeast-1 (Singapore)',
    version: 'v1.30.1',
    nodes: 2,
    pods: 38,
    agentStatus: 'Online (4.8ms)',
    controlPlaneHealth: 'Healthy (100%)',
    apiEndpoint: 'https://api.k8s-staging.acmecorp.vn:6443',
    status: 'ACTIVE',
  },
  {
    id: 'CLS-03',
    name: 'k8s-dev-cluster-01',
    environment: 'development',
    region: 'ap-southeast-1 (Singapore)',
    version: 'v1.29.4',
    nodes: 1,
    pods: 16,
    agentStatus: 'Standby',
    controlPlaneHealth: 'Healthy (99.8%)',
    apiEndpoint: 'https://api.k8s-dev.acmecorp.vn:6443',
    status: 'ACTIVE',
  },
];

export const ClustersPage = () => {
  const { currentOrg, isRefreshing, triggerRefresh } = useDashboard();
  const [clusters, setClusters] = useState(INITIAL_CLUSTERS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterEnv, setNewClusterEnv] = useState('staging');
  const [newClusterRegion, setNewClusterRegion] = useState('ap-southeast-1');

  const handleAddCluster = (e) => {
    e.preventDefault();
    if (!newClusterName) return;

    const newCls = {
      id: `CLS-0${clusters.length + 1}`,
      name: newClusterName,
      environment: newClusterEnv,
      region: newClusterRegion,
      version: 'v1.30.2',
      nodes: 2,
      pods: 0,
      agentStatus: 'Pending Setup',
      controlPlaneHealth: 'Healthy',
      apiEndpoint: `https://api.${newClusterName}.acmecorp.vn:6443`,
      status: 'ACTIVE',
    };

    setClusters([...clusters, newCls]);
    setShowAddModal(false);
    setNewClusterName('');
  };

  return (
    <div className="dashboard-clusters-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Quản Lý Cụm Kubernetes Đa Môi Trường
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                border: '1px solid #A7F3D0',
              }}
            >
              {clusters.length} Cụm Đang Kết Nối
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; Giám sát tình trạng Control Plane, API Endpoints và phân bổ tác tử eBPF trên đa đám mây
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
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Đồng bộ cụm</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--dash-primary)',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            <span>Đăng Ký Cụm Mới</span>
          </button>
        </div>
      </div>

      {/* Clusters List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {clusters.map((cls) => (
          <div key={cls.id} className="dash-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--dash-radius-md)',
                    backgroundColor: 'var(--dash-mint-100)',
                    color: 'var(--dash-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Server size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                    {cls.name}
                  </h3>
                  <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-muted)' }}>
                    {cls.id} &bull; {cls.region}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: cls.environment === 'production' ? '#ECFDF5' : '#EFF6FF',
                  color: cls.environment === 'production' ? '#059669' : '#2563EB',
                  border: `1px solid ${cls.environment === 'production' ? '#A7F3D0' : '#BFDBFE'}`,
                }}
              >
                {cls.environment.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', backgroundColor: 'var(--dash-bg-canvas)', padding: '12px', borderRadius: 'var(--dash-radius-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Phiên bản Kubernetes:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{cls.version}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Máy chủ & Pods:</span>
                <strong>{cls.nodes} Nodes &bull; {cls.pods} Pods</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Tác tử eBPF Agent:</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>● {cls.agentStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--dash-text-secondary)' }}>Control Plane:</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>{cls.controlPlaneHealth}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Endpoint: {cls.apiEndpoint}
            </div>
          </div>
        ))}
      </div>

      {/* Add Cluster Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  Đăng Ký Cụm Kubernetes Mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--dash-text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCluster} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Tên Cụm Máy Chủ
                </label>
                <input
                  type="text"
                  required
                  placeholder="k8s-dr-cluster-01"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Môi Trường Vận Hành
                </label>
                <select
                  value={newClusterEnv}
                  onChange={(e) => setNewClusterEnv(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                >
                  <option value="production">Production (Sản xuất)</option>
                  <option value="staging">Staging (Kiểm thử)</option>
                  <option value="development">Development (Phát triển)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Vùng Địa Lý (Region)
                </label>
                <select
                  value={newClusterRegion}
                  onChange={(e) => setNewClusterRegion(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                >
                  <option value="ap-southeast-1 (Singapore)">ap-southeast-1 (Singapore)</option>
                  <option value="us-east-1 (N. Virginia)">us-east-1 (N. Virginia)</option>
                  <option value="eu-central-1 (Frankfurt)">eu-central-1 (Frankfurt)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-md)',
                    color: 'var(--dash-text-secondary)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--dash-primary)',
                    border: 'none',
                    borderRadius: 'var(--dash-radius-md)',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Đăng Ký Cụm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClustersPage;
