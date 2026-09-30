import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Layers,
  Server,
  Bot,
  AlertCircle,
  History,
  LayoutGrid,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  getOrganization,
  getOrganizationMembers,
  getOrganizationEnvironments,
  getOrganizationClusters,
  getOrganizationAgents,
  getOrganizationIncidents,
  getOrganizationAuditActivity,
} from '../../../services/adminOrganizationsService';
import OrganizationDetails from '../../../components/admin/organizations/OrganizationDetails';
import OrganizationMembers from '../../../components/admin/organizations/OrganizationMembers';
import OrganizationEnvironments from '../../../components/admin/organizations/OrganizationEnvironments';
import OrganizationClusters from '../../../components/admin/organizations/OrganizationClusters';
import OrganizationAgents from '../../../components/admin/organizations/OrganizationAgents';
import OrganizationIncidents from '../../../components/admin/organizations/OrganizationIncidents';
import OrganizationAuditActivity from '../../../components/admin/organizations/OrganizationAuditActivity';

export const OrganizationDetailsPage = ({ orgId, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'members' | 'environments' | 'clusters' | 'agents' | 'incidents' | 'audit'
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [agents, setAgents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTenantData = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    try {
      const org = await getOrganization(orgId);
      if (!org) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setOrganization(org);

      const [m, e, c, a, inc, aud] = await Promise.all([
        getOrganizationMembers(orgId),
        getOrganizationEnvironments(orgId),
        getOrganizationClusters(orgId),
        getOrganizationAgents(orgId),
        getOrganizationIncidents(orgId),
        getOrganizationAuditActivity(orgId),
      ]);

      setMembers(m);
      setEnvironments(e);
      setClusters(c);
      setAgents(a);
      setIncidents(inc);
      setAuditLogs(aud);
    } catch (err) {
      console.error('Lỗi khi tải chi tiết tổ chức:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('/admin/organizations');
    }
  };

  const handleToggleStatus = () => {
    if (!organization) return;
    const newStatus = organization.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setOrganization((prev) => ({ ...prev, status: newStatus }));
  };

  if (notFound) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
        }}
      >
        <AlertTriangle size={48} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
          Không Tìm Thấy Tổ Chức
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', maxWidth: '400px', margin: '8px auto 24px' }}>
          Tổ chức với mã định danh "{orgId}" không tồn tại hoặc đã bị xóa khỏi hệ thống.
        </p>
        <button
          type="button"
          onClick={handleBack}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.8125rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Quay lại danh sách tổ chức
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'all', label: 'Tổng Quan Toàn Diện', icon: LayoutGrid, count: null },
    { id: 'members', label: 'Nhân Sự SME', icon: Users, count: members.length },
    { id: 'environments', label: 'Môi Trường', icon: Layers, count: environments.length },
    { id: 'clusters', label: 'Cụm K8s', icon: Server, count: clusters.length },
    { id: 'agents', label: 'Tác Tử eBPF', icon: Bot, count: agents.length },
    { id: 'incidents', label: 'Sự Cố & MTTR', icon: AlertCircle, count: incidents.length },
    { id: 'audit', label: 'Nhật Ký Kiểm Toán', icon: History, count: auditLogs.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Organization Header Card */}
      <OrganizationDetails
        organization={organization}
        onBack={handleBack}
        onToggleStatus={handleToggleStatus}
      />

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--dash-border)',
          paddingBottom: '8px',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                backgroundColor: isActive ? '#059669' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : 'var(--dash-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 4px rgba(5, 150, 105, 0.2)' : 'none',
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : '#F1F5F9',
                    color: isActive ? '#FFFFFF' : 'var(--dash-text-primary)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={fetchTenantData}
          disabled={isLoading}
          aria-label="Làm mới dữ liệu tổ chức"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={12} className={isLoading ? 'spin-icon' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <OrganizationMembers members={members} isLoading={isLoading} />
          <OrganizationEnvironments environments={environments} isLoading={isLoading} />
          <OrganizationClusters clusters={clusters} isLoading={isLoading} />
          <OrganizationAgents agents={agents} isLoading={isLoading} />
          <OrganizationIncidents incidents={incidents} isLoading={isLoading} />
          <OrganizationAuditActivity auditLogs={auditLogs} isLoading={isLoading} />
        </div>
      )}

      {activeTab === 'members' && (
        <OrganizationMembers members={members} isLoading={isLoading} />
      )}

      {activeTab === 'environments' && (
        <OrganizationEnvironments environments={environments} isLoading={isLoading} />
      )}

      {activeTab === 'clusters' && (
        <OrganizationClusters clusters={clusters} isLoading={isLoading} />
      )}

      {activeTab === 'agents' && (
        <OrganizationAgents agents={agents} isLoading={isLoading} />
      )}

      {activeTab === 'incidents' && (
        <OrganizationIncidents incidents={incidents} isLoading={isLoading} />
      )}

      {activeTab === 'audit' && (
        <OrganizationAuditActivity auditLogs={auditLogs} isLoading={isLoading} />
      )}
    </div>
  );
};

export default OrganizationDetailsPage;
