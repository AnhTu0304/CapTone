import React, { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, Clock, Cpu, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getIncidentById,
  getIncidentTimeline,
  getIncidentRCA,
  getIncidentHealingActions,
} from '../../../services/adminIncidentsService';
import IncidentDetail from '../../../components/admin/incidents/IncidentDetail';
import IncidentTimeline from '../../../components/admin/incidents/IncidentTimeline';
import IncidentRCA from '../../../components/admin/incidents/IncidentRCA';
import IncidentHealingActions from '../../../components/admin/incidents/IncidentHealingActions';

export const IncidentDetailPage = ({ incidentId, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'timeline' | 'rca' | 'actions'
  const [incident, setIncident] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [rca, setRca] = useState(null);
  const [healingActions, setHealingActions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchIncidentDetails = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    try {
      const inc = await getIncidentById(incidentId);
      if (!inc) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      const [tl, r, actions] = await Promise.all([
        getIncidentTimeline(incidentId),
        getIncidentRCA(incidentId),
        getIncidentHealingActions(incidentId),
      ]);

      setIncident(inc);
      setTimeline(tl);
      setRca(r);
      setHealingActions(actions);
    } catch (err) {
      console.error('Lỗi khi tải chi tiết sự cố:', err);
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncidentDetails();
  }, [fetchIncidentDetails]);

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('/admin/incidents');
    }
  };

  const handleNavigateToApprovals = () => {
    if (onNavigate) {
      onNavigate('/admin/approvals');
    }
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
          Không Tìm Thấy Sự Cố
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', maxWidth: '400px', margin: '8px auto 24px' }}>
          Sự cố với mã định danh "{incidentId}" không tồn tại hoặc đã được lưu trữ bảo mật.
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
          Quay lại danh sách sự cố
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'all', label: 'Toàn Cảnh Sự Cố', icon: LayoutGrid },
    { id: 'timeline', label: 'Chu Trình 8 Giai Đoạn', icon: Clock },
    { id: 'rca', label: 'Chẩn Đoán Nguyên Nhân Gốc (RCA)', icon: Cpu },
    { id: 'actions', label: 'Kế Hoạch Tự Phục Hồi', icon: Zap },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <IncidentDetail
        incident={incident}
        onBack={handleBack}
        onNavigateToApprovals={handleNavigateToApprovals}
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
            </button>
          );
        })}

        <button
          type="button"
          onClick={fetchIncidentDetails}
          disabled={isLoading}
          aria-label="Làm mới dữ liệu sự cố"
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
          <IncidentTimeline timeline={timeline} isLoading={isLoading} />
          <IncidentRCA rca={rca} isLoading={isLoading} />
          <IncidentHealingActions
            actions={healingActions}
            isLoading={isLoading}
            onNavigateToApprovals={handleNavigateToApprovals}
          />
        </div>
      )}

      {activeTab === 'timeline' && (
        <IncidentTimeline timeline={timeline} isLoading={isLoading} />
      )}

      {activeTab === 'rca' && (
        <IncidentRCA rca={rca} isLoading={isLoading} />
      )}

      {activeTab === 'actions' && (
        <IncidentHealingActions
          actions={healingActions}
          isLoading={isLoading}
          onNavigateToApprovals={handleNavigateToApprovals}
        />
      )}
    </div>
  );
};

export default IncidentDetailPage;
