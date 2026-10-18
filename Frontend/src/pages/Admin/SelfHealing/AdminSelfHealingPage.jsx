import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Zap, Sliders, Layers, BarChart3 } from 'lucide-react';
import {
  getHealingActions,
  getActionTypes,
  getPolicies,
  updatePolicyConfig,
  togglePolicyActive,
  getSelfHealingAnalytics,
} from '../../../services/adminSelfHealingService';

import SelfHealingNavTabs from '../../../components/admin/self-healing/SelfHealingNavTabs';
import SelfHealingFilters from '../../../components/admin/self-healing/SelfHealingFilters';
import HealingActionsTable from '../../../components/admin/self-healing/HealingActionsTable';
import ActionTypesCatalog from '../../../components/admin/self-healing/ActionTypesCatalog';
import PoliciesTable from '../../../components/admin/self-healing/PoliciesTable';
import SelfHealingAnalytics from '../../../components/admin/self-healing/SelfHealingAnalytics';
import { useDebounce } from '../../../hooks/useDebounce';
import { AdminErrorState } from '../../../components/admin/common';

export const AdminSelfHealingPage = ({ currentSection = 'actions', onNavigate }) => {
  const [actions, setActions] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state for Actions section
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('ALL');
  const [executionMode, setExecutionMode] = useState('ALL');
  const [executionStatus, setExecutionStatus] = useState('ALL');

  const debouncedSearch = useDebounce(search, 300);

  const loadSectionData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (currentSection === 'actions') {
        const data = await getHealingActions({
          search: debouncedSearch,
          riskLevel,
          executionMode,
          executionStatus,
        });
        setActions(data);
      } else if (currentSection === 'action-types') {
        const types = await getActionTypes();
        setActionTypes(types);
      } else if (currentSection === 'policies') {
        const pols = await getPolicies();
        setPolicies(pols);
      } else if (currentSection === 'analytics') {
        const stats = await getSelfHealingAnalytics();
        setAnalytics(stats);
      }
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu Tự Phục Hồi:', err);
      setError('Không thể nạp dữ liệu phân hệ Tự Phục Hồi từ máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [currentSection, debouncedSearch, riskLevel, executionMode, executionStatus]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  // Policy handlers
  const handleTogglePolicyActive = async (policyId) => {
    try {
      const updated = await togglePolicyActive(policyId);
      setPolicies((prev) =>
        prev.map((p) => (p.id === policyId ? { ...p, activeStatus: updated.activeStatus } : p))
      );
    } catch (err) {
      console.error('Lỗi khi chuyển đổi trạng thái chính sách:', err);
    }
  };

  const handleUpdatePolicyConfig = async (policyId, newConfig) => {
    try {
      const updated = await updatePolicyConfig(policyId, newConfig);
      setPolicies((prev) => prev.map((p) => (p.id === policyId ? updated : p)));
    } catch (err) {
      console.error('Lỗi khi cập nhật cấu hình chính sách:', err);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setRiskLevel('ALL');
    setExecutionMode('ALL');
    setExecutionStatus('ALL');
  };

  const handleNavigateToApprovals = () => {
    if (onNavigate) {
      onNavigate('/admin/approvals');
    }
  };

  const getSectionHeader = () => {
    switch (currentSection) {
      case 'action-types':
        return {
          title: 'Danh Mục Loại Hành Động Tự Phục Hồi (Action Types Library)',
          desc: 'Thư viện các phương thức can thiệp chuẩn hóa của động cơ MAPE-K, phân loại mức độ rủi ro và xác định cơ chế hoàn nguyên tự động.',
          icon: Layers,
        };
      case 'policies':
        return {
          title: 'Quản Trị Chính Sách Tự Lành (Self-Healing Policies)',
          desc: 'Quan sát và cấu hình các ngưỡng giám sát, mức độ tự trị, thời gian hạ nhiệt và số lần thử lại tối đa. Không trực tiếp thực thi lệnh K8s tùy ý.',
          icon: Sliders,
        };
      case 'analytics':
        return {
          title: 'Phân Tích & Thống Kê Tự Phục Hồi (Self-Healing Analytics)',
          desc: 'Đo lường hiệu quả tự phục hồi trên toàn bộ hạ tầng đa cụm, tỷ lệ thành công, thời gian phục hồi trung bình (MTTR) và cơ cấu loại hành động.',
          icon: BarChart3,
        };
      case 'actions':
      default:
        return {
          title: 'Nhật Ký Hành Động Tự Phục Hồi (Self-Healing Actions)',
          desc: 'Giám sát chi tiết mọi hành động cứu hộ tự động trên toàn bộ hệ thống đa tổ chức. Tuân thủ nghiêm ngặt quy trình phê duyệt an toàn.',
          icon: Zap,
        };
    }
  };

  const sectionHeader = getSectionHeader();
  const HeaderIcon = sectionHeader.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontWeight: 700,
                fontSize: '0.6875rem',
              }}
            >
              <ShieldCheck size={12} /> Cấp Độ Quản Trị Hệ Thống (Platform Super Admin)
            </span>
          </div>

          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--dash-text-primary)',
              margin: '8px 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <HeaderIcon size={26} style={{ color: '#059669' }} />
            <span>{sectionHeader.title}</span>
          </h1>

          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, maxWidth: '850px' }}>
            {sectionHeader.desc}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={loadSectionData}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <SelfHealingNavTabs currentSection={currentSection} onNavigate={onNavigate} />

      {/* Error state if fetch failed */}
      {error && (
        <AdminErrorState
          title="Không thể tải dữ liệu tự phục hồi"
          message={error}
          onRetry={loadSectionData}
          isRetrying={isLoading}
        />
      )}

      {/* Section Content */}
      {currentSection === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SelfHealingFilters
            search={search}
            onSearchChange={setSearch}
            riskLevel={riskLevel}
            onRiskLevelChange={setRiskLevel}
            executionMode={executionMode}
            onExecutionModeChange={setExecutionMode}
            executionStatus={executionStatus}
            onExecutionStatusChange={setExecutionStatus}
            onReset={handleResetFilters}
          />

          <HealingActionsTable
            actions={actions}
            isLoading={isLoading}
            onNavigateToApprovals={handleNavigateToApprovals}
          />
        </div>
      )}

      {currentSection === 'action-types' && (
        <ActionTypesCatalog actionTypes={actionTypes} isLoading={isLoading} />
      )}

      {currentSection === 'policies' && (
        <PoliciesTable
          policies={policies}
          isLoading={isLoading}
          onToggleActive={handleTogglePolicyActive}
          onUpdateConfig={handleUpdatePolicyConfig}
        />
      )}

      {currentSection === 'analytics' && (
        <SelfHealingAnalytics analytics={analytics} isLoading={isLoading} />
      )}
    </div>
  );
};

export default AdminSelfHealingPage;
