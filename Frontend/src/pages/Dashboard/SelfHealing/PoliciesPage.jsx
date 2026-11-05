import React, { useState, useEffect, useCallback } from 'react';
import { selfHealingService } from '../../../services/selfHealingService';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import usePermissions from '../../../hooks/usePermissions';
import NewPolicyModal from './NewPolicyModal';
import PolicyDetailModal from './PolicyDetailModal';
import {
  Shield,
  Sliders,
  RefreshCw,
  CheckCircle2,
  Lock,
  Zap,
  RotateCcw,
  Save,
  Plus,
  Settings,
  X,
  Check,
  ShieldCheck,
  User,
  AlertTriangle,
  Building,
  Server,
  UserCheck,
  Trash2,

  Eye,


  Clock
} from 'lucide-react';


export const PoliciesPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { success: toastSuccess, warning: toastWarning, error: toastError } = useToast();
  const { user } = useAuth();
  const { role, isOwner, isDevOps, isViewer, canManagePolicies } = usePermissions();

  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);

  // Cluster Identity & State Isolation Key
  const clusterName = currentEnv?.cluster || currentEnv?.name || currentEnv?.id || 'all-clusters';
  const isClusterOnline = currentEnv?.agentStatus === 'ONLINE';
  const clusterKey = currentEnv?.id ? `cluster_${currentEnv.id}` : `cluster_${clusterName}`;

  // Helper: Retrieve cluster-specific safety guards
  const getGuardsForCluster = useCallback((key, isOnline, cName) => {
    const saved = localStorage.getItem(`selfheal_guards_${key}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    // For primary/online cluster, check legacy settings or seed active defaults
    if (isOnline) {
      const legacy = localStorage.getItem('selfheal_safety_guards');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          return {
            globalMode: parsed.globalMode || 'AUTONOMOUS',
            blastRadiusThreshold: parsed.blastRadiusThreshold || 25,
            maxRestarts: parsed.maxRestarts || 5,
            restartTimeWindow: parsed.restartTimeWindow || 15,
            approvalTimeout: parsed.approvalTimeout || 20,
            cooldownPeriod: parsed.cooldownPeriod || 5,
          };
        } catch (e) {
          // ignore
        }
      }
      return {
        globalMode: 'AUTONOMOUS',
        blastRadiusThreshold: 25,
        maxRestarts: 5,
        restartTimeWindow: 15,
        approvalTimeout: 20,
        cooldownPeriod: 5,
      };
    }
    // Default for offline / pending clusters (like vcxv)
    return {
      globalMode: 'AUDIT',
      blastRadiusThreshold: 30,
      maxRestarts: 3,
      restartTimeWindow: 15,
      approvalTimeout: 20,
      cooldownPeriod: 5,
    };
  }, []);

  // Settings State - Isolated per cluster
  const [globalMode, setGlobalMode] = useState(() => getGuardsForCluster(clusterKey, isClusterOnline, clusterName).globalMode);
  const [blastRadiusThreshold, setBlastRadiusThreshold] = useState(() => getGuardsForCluster(clusterKey, isClusterOnline, clusterName).blastRadiusThreshold);
  const [maxRestarts, setMaxRestarts] = useState(() => getGuardsForCluster(clusterKey, isClusterOnline, clusterName).maxRestarts);
  const [restartTimeWindow, setRestartTimeWindow] = useState(() => getGuardsForCluster(clusterKey, isClusterOnline, clusterName).restartTimeWindow);
  const [approvalTimeout, setApprovalTimeout] = useState(() => getGuardsForCluster(clusterKey, isClusterOnline, clusterName).approvalTimeout);
  const [cooldownPeriod, setCooldownPeriod] = useState(() => getGuardsForCluster(clusterKey, isClusterOnline, clusterName).cooldownPeriod);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync guards whenever cluster changes
  useEffect(() => {
    const guards = getGuardsForCluster(clusterKey, isClusterOnline, clusterName);
    setGlobalMode(guards.globalMode);
    setBlastRadiusThreshold(guards.blastRadiusThreshold);
    setMaxRestarts(guards.maxRestarts);
    setRestartTimeWindow(guards.restartTimeWindow);
    setApprovalTimeout(guards.approvalTimeout);
    setCooldownPeriod(guards.cooldownPeriod);
    setHasUnsavedChanges(false);
  }, [clusterKey, isClusterOnline, clusterName, getGuardsForCluster]);

  const updateClusterGuard = (_field, _value) => {
    // Chỉ đánh dấu có thay đổi tạm thời trên giao diện; chỉ lưu thật khi người dùng nhấn nút "Lưu Thay Đổi"
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  // Policies list state
  const [policies, setPolicies] = useState([]);

  const KNOWN_POLICY_TITLES = {
    'POL-SCALE-OUT-TRAFFIC': 'Tự động mở rộng bản sao Pod khi quá tải lưu lượng đột biến',
    'POL-ROLLBACK-HTTP5XX': 'Hoàn nguyên phiên bản khi tỷ lệ HTTP 5xx vượt 5%',
    'POL-CLEANUP-DISK-TEMP': 'Dọn dẹp dung lượng disk tạm thời trong thư mục /tmp',
    'POL-BLOCK-MALICIOUS-IP': 'Chặn IP tấn công bất thường bằng eBPF/iptables',
    'POL-DRAIN-UNHEALTHY-NODE': 'Di tản workload và cô lập Node vật lý bị lỗi phần cứng',
    'POL-RESTART-CRASHED-POD': 'Tự động khởi động lại Pod bị treo hoặc crash liveness probe',
  };

  const mapBackendPolicyToUI = useCallback((p) => {
    const actionNames = p.actions && p.actions.length > 0
      ? p.actions.map((a) => a.action_name || a.action_code).join(', ')
      : 'Thực thi hành động theo chuẩn MAPE-K';

    let displayName = p.description || p.name;
    if (KNOWN_POLICY_TITLES[p.name] && (!p.description || p.description.includes('???') || p.description.includes('?'))) {
      displayName = KNOWN_POLICY_TITLES[p.name];
    } else if (!displayName || displayName.includes('???')) {
      displayName = KNOWN_POLICY_TITLES[p.name] || p.name;
    }

    return {
      id: p.id,
      code: p.name,
      name: displayName,
      category: p.risk_type || 'Tự phục hồi AI',
      targetNamespace: 'production',
      targetCluster: currentEnv?.name || currentEnv?.cluster || 'Tất cả cụm',
      condition: `Trigger: ${p.trigger_type} (Ngưỡng tin cậy >= ${Math.round(Number(p.confidence_threshold || 0.85) * 100)}%)`,
      action: actionNames,
      riskLevel: p.risk_level || 'LOW',
      hitlRequired: p.requires_approval ?? false,
      enabled: p.is_active ?? true,
      cooldown: p.cooldown_seconds || 300,
      maxRetries: p.max_retries || 2,
    };
  }, [currentEnv?.cluster]);

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeOrgId = currentOrg?.id;
      const activeEnvId = currentEnv?.environment_id || currentEnv?.clusterId || currentEnv?.id;
      const res = await selfHealingService.getPolicies({
        organization_id: activeOrgId,
        environment_id: activeEnvId,
      });
      const items = Array.isArray(res) ? res : (res?.items || []);
      const basePolicies = items.map(mapBackendPolicyToUI);
      setIsUsingLiveDb(true);

      // Check per-cluster saved policy overrides
      const savedPoliciesRaw = localStorage.getItem(`selfheal_policies_${clusterKey}`);
      let savedClusterMap = null;
      if (savedPoliciesRaw) {
        try {
          savedClusterMap = JSON.parse(savedPoliciesRaw);
        } catch (e) {
          // ignore
        }
      }

      const clusterPolicies = basePolicies.map((p) => {
        if (savedClusterMap && (savedClusterMap[p.id] !== undefined || savedClusterMap[p.code] !== undefined)) {
          const override = savedClusterMap[p.id] ?? savedClusterMap[p.code];
          return {
            ...p,
            enabled: override.enabled !== undefined ? override.enabled : p.enabled,
            hitlRequired: override.hitlRequired !== undefined ? override.hitlRequired : p.hitlRequired,
          };
        }
        // If no explicit settings saved yet for this cluster:
        // ONLINE cluster: Keep backend/active enabled
        // OFFLINE / PENDING cluster (e.g. vcxv): Switches must move to the OFF position ("về đúng vị trí tắt")!
        return {
          ...p,
          enabled: isClusterOnline ? (p.enabled ?? true) : false,
          hitlRequired: isClusterOnline ? (p.hitlRequired ?? false) : true,
        };
      });

      setPolicies(clusterPolicies);
    } catch (err) {
      console.warn('[PoliciesPage] Lỗi nạp chính sách:', err.message);
      setIsUsingLiveDb(true);
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentEnv?.environment_id, currentEnv?.clusterId, currentEnv?.id, mapBackendPolicyToUI, clusterKey, isClusterOnline]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies, isRefreshing, currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster, currentEnv?.agentStatus]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Policy Form State
  const [newRule, setNewRule] = useState({
    name: '',
    category: 'Tài nguyên & Cấu hình',
    targetNamespace: 'production',
    condition: '',
    action: '',
    riskLevel: 'MEDIUM',
    hitlRequired: true,
  });

  const handleSelectAutomationMode = (mode) => {
    if (!canManagePolicies) {
      toastWarning('Chỉ SME Owner và DevOps mới có quyền thay đổi chế độ tự động hóa.', 'Quyền Hạn');
      return;
    }
    setGlobalMode(mode);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);

    const updatedList = policies.map((p) => {
      const risk = String(p.riskLevel || 'LOW').toUpperCase();
      const isHighRisk = risk === 'HIGH' || risk === 'CRITICAL';
      if (mode === 'AUTONOMOUS') {
        return { ...p, enabled: true, hitlRequired: false };
      }
      if (mode === 'AUDIT') {
        return { ...p, enabled: false, hitlRequired: true };
      }
      return { ...p, enabled: true, hitlRequired: isHighRisk };
    });

    setPolicies(updatedList);
  };

  const [deletingPolicyId, setDeletingPolicyId] = useState(null);
  const [policyToDelete, setPolicyToDelete] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const handleDeletePolicy = (policy) => {
    if (!canManagePolicies) {
      toastWarning("Chỉ SME Owner và DevOps mới có quyền xóa chính sách tự phục hồi.", "Quyền Hạn");
      return;
    }
    setPolicyToDelete(policy);
  };

  const confirmExecuteDelete = async () => {
    if (!policyToDelete) return;
    setDeletingPolicyId(policyToDelete.id);
    try {
      await selfHealingService.deletePolicy(policyToDelete.id);
      setPolicies((prev) => prev.filter((p) => p.id !== policyToDelete.id));
      try {
        const savedPoliciesRaw = localStorage.getItem(`selfheal_policies_${clusterKey}`);
        if (savedPoliciesRaw) {
          const map = JSON.parse(savedPoliciesRaw);
          delete map[policyToDelete.id];
          if (policyToDelete.code) delete map[policyToDelete.code];
          localStorage.setItem(`selfheal_policies_${clusterKey}`, JSON.stringify(map));
        }
      } catch (e) {}
      toastSuccess(`Đã xóa thành công quy tắc "${policyToDelete.name}"!`, "Đã Xóa Quy Tắc");
      setSelectedPolicy(null);
      setPolicyToDelete(null);
    } catch (err) {
      toastError(err?.message || "Lỗi kết nối máy chủ khi xóa chính sách", "Xóa Thất Bại");
    } finally {
      setDeletingPolicyId(null);
    }
  };

  const handleTogglePolicy = (id) => {
    if (!canManagePolicies) {
      toastWarning('Chỉ SME Owner và DevOps mới có quyền bật/tắt chính sách tự phục hồi.', 'Quyền Hạn');
      return;
    }
    const target = policies.find((p) => p.id === id);
    if (!target) return;
    const newEnabled = !target.enabled;
    const updatedList = policies.map((p) => (p.id === id ? { ...p, enabled: newEnabled } : p));
    setPolicies(updatedList);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleToggleHitl = (id) => {
    if (!canManagePolicies) {
      toastWarning('Chỉ SME Owner và DevOps mới có quyền cấu hình cổng HITL.', 'Quyền Hạn');
      return;
    }
    const target = policies.find((p) => p.id === id);
    if (!target) return;
    const newHitl = !target.hitlRequired;
    const updatedList = policies.map((p) => (p.id === id ? { ...p, hitlRequired: newHitl } : p));
    setPolicies(updatedList);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
  };

  const handleSaveSettings = async () => {
    if (!canManagePolicies) {
      toastWarning('Chỉ SME Owner và DevOps mới có quyền lưu cấu hình ngưỡng an toàn.', 'Quyền Hạn');
      return;
    }

    const guardsData = {
      blastRadiusThreshold,
      maxRestarts,
      restartTimeWindow,
      approvalTimeout,
      cooldownPeriod,
      globalMode,
    };
    localStorage.setItem(`selfheal_guards_${clusterKey}`, JSON.stringify(guardsData));
    if (isClusterOnline) {
      localStorage.setItem('selfheal_safety_guards', JSON.stringify(guardsData));
    }

    const clusterMap = {};
    policies.forEach((p) => {
      clusterMap[p.id] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
      if (p.code) clusterMap[p.code] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
    });
    localStorage.setItem(`selfheal_policies_${clusterKey}`, JSON.stringify(clusterMap));

    if (isUsingLiveDb && isClusterOnline && policies.length > 0) {
      try {
        await Promise.all(
          policies.map((p) =>
            selfHealingService.updatePolicyConfig(p.id, {
              is_active: p.enabled,
              requires_approval: p.hitlRequired,
              execution_mode: p.hitlRequired ? 'MANUAL' : 'AUTO',
              cooldown_seconds: cooldownPeriod * 60,
              max_retries: maxRestarts,
            })
          )
        );
      } catch (err) {
        console.warn('Lỗi lưu cấu hình an toàn xuống DB:', err.message);
      }
    }

    setHasUnsavedChanges(false);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!canManagePolicies) {
      toastWarning('Chỉ SME Owner và DevOps mới có quyền thêm quy tắc tự phục hồi.', 'Quyền Hạn');
      return;
    }
    if (!newRule.name || !newRule.condition || !newRule.action) return;

    if (isUsingLiveDb) {
      try {
        await selfHealingService.createPolicy({
          organization_id: currentOrg?.id,
          environment_id: currentEnv?.environment_id || currentEnv?.clusterId || currentEnv?.id,
          name: `POL-${Date.now().toString().slice(-4)}`,
          description: newRule.name,
          risk_type: newRule.category,
          risk_level: newRule.riskLevel,
          requires_approval: newRule.hitlRequired,
          trigger_type: newRule.condition || 'Metric Threshold',
        });
        await fetchPolicies();
      } catch (err) {
        console.warn('Lỗi tạo quy tắc trên DB:', err.message);
        const created = {
          id: `POL-${String(policies.length + 1).padStart(2, '0')}`,
          name: newRule.name,
          category: newRule.category,
          targetNamespace: newRule.targetNamespace,
          condition: newRule.condition,
          action: newRule.action,
          riskLevel: newRule.riskLevel,
          hitlRequired: newRule.hitlRequired,
          enabled: true,
        };
        setPolicies([...policies, created]);
      }
    } else {
      const created = {
        id: `POL-${String(policies.length + 1).padStart(2, '0')}`,
        name: newRule.name,
        category: newRule.category,
        targetNamespace: newRule.targetNamespace,
        condition: newRule.condition,
        action: newRule.action,
        riskLevel: newRule.riskLevel,
        hitlRequired: newRule.hitlRequired,
        enabled: true,
      };
      setPolicies([...policies, created]);
    }

    setShowAddModal(false);
    setNewRule({
      name: '',
      category: 'Tài nguyên & Cấu hình',
      targetNamespace: 'production',
      condition: '',
      action: '',
      riskLevel: 'MEDIUM',
      hitlRequired: true,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Ma Trận Chính Sách Tự Phục Hồi
            </h1>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Quản lý chính sách tự động và an toàn MAPE-K
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={triggerRefresh}
            disabled={isRefreshing}
            className="dash-btn"
            style={{
              padding: '8px 12px',
              backgroundColor: 'white',
              border: '1px solid var(--dash-border-subtle)',
              color: 'var(--dash-text-secondary)',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Đồng bộ Kubernetes
          </button>

          <button
            onClick={() => {
              if (!canManagePolicies) {
                toastWarning('Chỉ SME Owner và DevOps mới có quyền thêm quy tắc tự phục hồi.', 'Quyền Hạn');
                return;
              }
              setShowAddModal(true);
            }}
            disabled={!canManagePolicies}
            className="dash-btn"
            style={{
              padding: '8px 14px',
              backgroundColor: !canManagePolicies ? '#F1F5F9' : 'white',
              border: `1px solid ${!canManagePolicies ? '#CBD5E1' : 'var(--dash-primary)'}`,
              color: !canManagePolicies ? '#94A3B8' : 'var(--dash-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: !canManagePolicies ? 'not-allowed' : 'pointer',
              opacity: !canManagePolicies ? 0.7 : 1,
            }}
            title={!canManagePolicies ? 'Chỉ SME Owner hoặc DevOps mới có quyền thêm quy tắc' : 'Thêm quy tắc mới'}
          >
            <Plus size={16} />
            Thêm Quy Tắc Mới
          </button>

          <button
            onClick={handleSaveSettings}
            disabled={!canManagePolicies}
            className="dash-btn"
            style={{
              padding: '8px 16px',
              backgroundColor: !canManagePolicies ? '#94A3B8' : 'var(--dash-primary)',
              color: 'white',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: !canManagePolicies ? 'not-allowed' : 'pointer',
              opacity: !canManagePolicies ? 0.7 : 1,
            }}
            title={!canManagePolicies ? 'Chỉ SME Owner hoặc DevOps mới có quyền lưu cấu hình' : 'Lưu cấu hình'}
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            {saveSuccess ? 'Đã Lưu Thành Công' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>

      {hasUnsavedChanges && !saveSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--dash-radius-md)',
            color: '#92400e',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={18} color="#d97706" />
          <span>Bạn có thay đổi cấu hình chưa lưu. Hãy nhấn nút <strong>"Lưu Thay Đổi"</strong> ở góc phải để áp dụng vào hệ thống.</span>
        </div>
      )}

      {saveSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065f46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Chính sách tự phục hồi đã được áp dụng tức thì vào cụm máy chủ và ghi nhận vào sổ kiểm toán.</span>
        </div>
      )}

      {/* 1. Chế Độ Vận Hành Tự Động Hóa (Cluster Automation Mode) */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dash-primary)',
              flexShrink: 0,
            }}
          >
            <Shield size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Chế Độ Vận Hành Tự Động Hóa (Cluster Automation Mode)
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Quyết định mức độ tự trị và quyền can thiệp phục hồi của AI trên cụm Kubernetes
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
          {/* Card 1: Supervised HITL (Khuyến nghị) */}
          <div
            onClick={() => handleSelectAutomationMode('SUPERVISED')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              border: globalMode === 'SUPERVISED' ? '2px solid var(--dash-primary)' : '1px solid #E2E8F0',
              backgroundColor: globalMode === 'SUPERVISED' ? 'rgba(16, 185, 129, 0.04)' : '#FFFFFF',
              boxShadow: globalMode === 'SUPERVISED' ? '0 2px 6px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
              cursor: canManagePolicies ? 'pointer' : 'not-allowed',
              opacity: canManagePolicies ? 1 : 0.8,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              {/* Row 1: Icon on left, Badge on right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap size={15} />
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    border: '1px solid #A7F3D0',
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                  }}
                >
                  Khuyến nghị cho SME
                </span>
              </div>

              {/* Row 2: Full Title without any truncation */}
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                Bán Tự Động Có Giám Sát
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '10px 0 0 0', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              Tự khắc phục rủi ro thấp (OOM, Deadlock). Mọi hành động rủi ro cao (Drain, Rollback) bắt buộc chuyển qua Cổng duyệt HITL.
            </p>
          </div>

          {/* Card 2: Autonomous */}
          <div
            onClick={() => handleSelectAutomationMode('AUTONOMOUS')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              border: globalMode === 'AUTONOMOUS' ? '2px solid #2563EB' : '1px solid #E2E8F0',
              backgroundColor: globalMode === 'AUTONOMOUS' ? 'rgba(37, 99, 235, 0.04)' : '#FFFFFF',
              boxShadow: globalMode === 'AUTONOMOUS' ? '0 2px 6px rgba(37, 99, 235, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
              cursor: canManagePolicies ? 'pointer' : 'not-allowed',
              opacity: canManagePolicies ? 1 : 0.8,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              {/* Row 1: Icon on left, Badge on right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={15} />
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                  }}
                >
                  Không cần can thiệp
                </span>
              </div>

              {/* Row 2: Full Title without any truncation */}
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                Tự Trị Toàn Phần (Autonomous)
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '10px 0 0 0', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              Mọi hành động được MAPE-K lập tức thực thi nếu không vượt quá ngưỡng Blast Radius. Tối ưu MTTR xuống dưới 2 giây.
            </p>
          </div>

          {/* Card 3: Audit Only */}
          <div
            onClick={() => handleSelectAutomationMode('AUDIT')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              border: globalMode === 'AUDIT' ? '2px solid #D97706' : '1px solid #E2E8F0',
              backgroundColor: globalMode === 'AUDIT' ? 'rgba(217, 119, 6, 0.04)' : '#FFFFFF',
              boxShadow: globalMode === 'AUDIT' ? '0 2px 6px rgba(217, 119, 6, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
              cursor: canManagePolicies ? 'pointer' : 'not-allowed',
              opacity: canManagePolicies ? 1 : 0.8,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              {/* Row 1: Icon on left, Badge on right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    backgroundColor: '#FFFBEB',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={15} />
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#FFFBEB',
                    color: '#D97706',
                    border: '1px solid #FDE68A',
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                  }}
                >
                  An toàn tuyệt đối
                </span>
              </div>

              {/* Row 2: Full Title without any truncation */}
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                Chỉ Cảnh Báo (Audit & Dry-Run)
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '10px 0 0 0', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              AI chỉ phân tích nguyên nhân gốc rễ và đề xuất giải pháp, tuyệt đối không can thiệp hay thay đổi trạng thái Kubernetes cluster.
            </p>
          </div>
        </div>
      </div>

                  {/* 2. Ngưỡng Kích Hoạt Cổng Phê Duyệt (HITL Safety Thresholds) */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dash-primary)',
              flexShrink: 0,
            }}
          >
            <Sliders size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Ngưỡng An Toàn & Kích Hoạt Cổng HITL (Safety Guards)
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Hàng rào bảo vệ tự động (Guardrails) ngăn chặn tác động tiêu cực lan truyền trên toàn bộ cụm Kubernetes
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
          {/* Card 1: Blast Radius */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={14} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Bán Kính Ảnh Hưởng
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    border: '1px solid #A7F3D0',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  {blastRadiusThreshold}% Pods
                </span>
              </div>

              {/* Slider Control */}
              <div style={{ padding: '4px 0 2px 0' }}>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={blastRadiusThreshold}
                  disabled={!canManagePolicies}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBlastRadiusThreshold(val);
                    updateClusterGuard('blastRadiusThreshold', val);
                  }}
                  style={{
                    width: '100%',
                    accentColor: '#059669',
                    cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                    opacity: canManagePolicies ? 1 : 0.6,
                    height: '5px',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94A3B8', marginTop: '4px', fontWeight: 600 }}>
                  <span>Min: 10%</span>
                  <span>Ngưỡng kích hoạt HITL</span>
                  <span>Max: 50%</span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '10px 0 0 0', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              Tự kích hoạt Cổng duyệt khi vượt quá <strong style={{ color: '#059669' }}>{blastRadiusThreshold}%</strong> số Pods trong cùng Namespace.
            </p>
          </div>

          {/* Card 2: Max Restarts / Circuit Breaker */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <RotateCcw size={14} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Giới Hạn Khởi Động
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  {maxRestarts} lần / {restartTimeWindow}m
                </span>
              </div>

              {/* Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                    Số lần tối đa
                  </label>
                  <select
                    value={maxRestarts}
                    disabled={!canManagePolicies}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxRestarts(val);
                      updateClusterGuard('maxRestarts', val);
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                      opacity: canManagePolicies ? 1 : 0.6,
                    }}
                  >
                    <option value={2}>2 lần</option>
                    <option value={3}>3 lần</option>
                    <option value={5}>5 lần</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                    Khung thời gian
                  </label>
                  <select
                    value={restartTimeWindow}
                    disabled={!canManagePolicies}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRestartTimeWindow(val);
                      updateClusterGuard('restartTimeWindow', val);
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                      opacity: canManagePolicies ? 1 : 0.6,
                    }}
                  >
                    <option value={10}>10 phút</option>
                    <option value={15}>15 phút</option>
                    <option value={30}>30 phút</option>
                  </select>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '10px 0 0 0', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              Ngăn hiện tượng CrashLoopBackOff lặp vô tận làm suy kiệt Node và tài nguyên CPU.
            </p>
          </div>

          {/* Card 3: Timeout & Cooldown */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: '#FFFBEB',
                      color: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={14} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Chờ Duyệt & Hạ Nhiệt
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#FFFBEB',
                    color: '#D97706',
                    border: '1px solid #FDE68A',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  {approvalTimeout}m / {cooldownPeriod}m
                </span>
              </div>

              {/* Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                    Hết hạn chờ
                  </label>
                  <select
                    value={approvalTimeout}
                    disabled={!canManagePolicies}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setApprovalTimeout(val);
                      updateClusterGuard('approvalTimeout', val);
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                      opacity: canManagePolicies ? 1 : 0.6,
                    }}
                  >
                    <option value={10}>10 phút</option>
                    <option value={20}>20 phút</option>
                    <option value={30}>30 phút</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                    Hạ nhiệt
                  </label>
                  <select
                    value={cooldownPeriod}
                    disabled={!canManagePolicies}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCooldownPeriod(val);
                      updateClusterGuard('cooldownPeriod', val);
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                      opacity: canManagePolicies ? 1 : 0.6,
                    }}
                  >
                    <option value={3}>3 phút</option>
                    <option value={5}>5 phút</option>
                    <option value={10}>10 phút</option>
                  </select>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '10px 0 0 0', lineHeight: 1.45, borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              Tự hủy lệnh khi quá hạn. Thời gian hạ nhiệt chống giật xung (chatter).
            </p>
          </div>
        </div>
      </div>

      {/* 3. Danh Sách Quy Tắc Tự Phục Hồi */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--dash-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              Quy Tắc Tự Động Phục Hồi Đang Áp Dụng ({policies.length})
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Mỗi quy tắc xác định điều kiện viễn trắc kích hoạt, hành động K8s can thiệp và yêu cầu qua Cổng HITL.
            </p>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-subtle)', borderBottom: '1px solid var(--dash-border-subtle)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Mã & Tên Quy Tắc</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Phân Loại</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Điều Kiện Kích Hoạt</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Hành Động Tự Sửa Lỗi</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Rủi Ro</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Cần Duyệt (HITL)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Bật / Tắt</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)', textAlign: 'center' }}>Chi Tiết</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B' }}>
                    <ShieldCheck size={40} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                      {isLoading ? 'Đang tải chính sách từ Database...' : 'Chưa có chính sách tự phục hồi nào'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', marginTop: '6px', color: '#64748B' }}>
                      {isLoading ? 'Vui lòng chờ trong giây lát...' : 'Tất cả các hành động hiện đang chạy theo ngưỡng an toàn mặc định.'}
                    </div>
                  </td>
                </tr>
              ) : (
                policies.map((p) => {
                  const isHighRisk = p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL';
                  const isMedRisk = p.riskLevel === 'MEDIUM';

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--dash-border-subtle)',
                        opacity: p.enabled ? 1 : 0.6,
                        backgroundColor: p.enabled ? 'transparent' : 'rgba(241, 245, 249, 0.5)',
                      }}
                    >
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', cursor: 'pointer' }} onClick={() => setSelectedPolicy(p)} title="Nhấp để xem chi tiết quy tắc">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-primary)', fontFamily: 'monospace' }}>
                            {p.code || p.id}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{p.name}</div>
                      </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)', fontWeight: 600 }}>
                        {p.category}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                      {p.condition}
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ color: 'var(--dash-text-primary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                        {p.action}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor: isHighRisk ? '#fef2f2' : isMedRisk ? '#fffbeb' : '#ecfdf5',
                          color: isHighRisk ? '#dc2626' : isMedRisk ? '#d97706' : '#059669',
                          border: `1px solid ${isHighRisk ? '#fecaca' : isMedRisk ? '#fde68a' : '#a7f3d0'}`,
                        }}
                      >
                        {isHighRisk ? 'Cao' : isMedRisk ? 'Vừa' : 'Thấp'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <button
                        onClick={() => handleToggleHitl(p.id)}
                        disabled={!canManagePolicies}
                        className="dash-btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor: p.hitlRequired ? '#eff6ff' : 'var(--dash-bg-subtle)',
                          color: p.hitlRequired ? '#2563eb' : 'var(--dash-text-secondary)',
                          border: `1px solid ${p.hitlRequired ? '#bfdbfe' : 'var(--dash-border-subtle)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: !canManagePolicies ? 'not-allowed' : 'pointer',
                          opacity: !canManagePolicies ? 0.6 : 1,
                        }}
                        title={!canManagePolicies ? 'Chỉ SME Owner và DevOps mới có quyền cấu hình HITL' : undefined}
                      >
                        {p.hitlRequired ? <Lock size={12} /> : null}
                        {p.hitlRequired ? 'Bắt Buộc Duyệt' : 'Tự Động Chạy'}
                      </button>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div
                        role="switch"
                        aria-checked={p.enabled}
                        tabIndex={canManagePolicies ? 0 : -1}
                        onClick={() => {
                          if (!canManagePolicies) return;
                          handleTogglePolicy(p.id);
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && canManagePolicies) {
                            e.preventDefault();
                            handleTogglePolicy(p.id);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: canManagePolicies ? 'pointer' : 'not-allowed',
                          opacity: canManagePolicies ? 1 : 0.65,
                          userSelect: 'none',
                        }}
                        title={
                          !canManagePolicies
                            ? 'Chỉ SME Owner và DevOps mới có quyền bật/tắt chính sách'
                            : p.enabled
                            ? 'Nhấn để Tắt chính sách trên cụm này'
                            : 'Nhấn để Bật chính sách trên cụm này'
                        }
                      >
                        {/* Modern Toggle Switch Slider */}
                        <div
                          style={{
                            width: '38px',
                            height: '22px',
                            borderRadius: '11px',
                            backgroundColor: p.enabled ? '#10B981' : '#CBD5E1',
                            position: 'relative',
                            transition: 'background-color 0.2s ease',
                            flexShrink: 0,
                            boxShadow: p.enabled ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
                          }}
                        >
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: '#FFFFFF',
                              position: 'absolute',
                              top: '3px',
                              left: p.enabled ? '19px' : '3px',
                              transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: p.enabled ? '#059669' : '#64748B',
                            minWidth: '55px',
                          }}
                        >
                          {p.enabled ? 'Đang Bật' : 'Đã Tắt'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPolicy(p)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--dash-text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F1F5F9';
                          e.currentTarget.style.borderColor = 'var(--dash-primary)';
                          e.currentTarget.style.color = 'var(--dash-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#FFFFFF';
                          e.currentTarget.style.borderColor = '#CBD5E1';
                          e.currentTarget.style.color = 'var(--dash-text-primary)';
                        }}
                        title="Xem chi tiết quy tắc"
                      >
                        <Eye size={13} />
                        <span>Chi tiết</span>
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

            {/* Modal Thêm Quy Tắc Mới (Structured Dropdown Builder) */}
            {/* Modal Chi Tiết Quy Tắc */}
      <PolicyDetailModal
        isOpen={!!selectedPolicy}
        policy={selectedPolicy}
        onClose={() => setSelectedPolicy(null)}
        onDelete={(pol) => handleDeletePolicy(pol)}
        canManagePolicies={canManagePolicies}
        currentEnv={currentEnv}
        deletingPolicyId={deletingPolicyId}
      />

      <NewPolicyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={fetchPolicies}
        currentOrg={currentOrg}
        currentEnv={currentEnv}
      />

      {/* Modal Xác Nhận Xóa Quy Tắc (Custom In-App Confirm Dialog) */}
      {policyToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => !deletingPolicyId && setPolicyToDelete(null)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              maxWidth: "490px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "20px 24px 14px 24px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#FEE2E2",
                  border: "1px solid #FECACA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#DC2626",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800, color: "#0F172A" }}>
                  Xác nhận xóa quy tắc tự phục hồi
                </h3>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.84375rem", color: "#64748B", lineHeight: 1.5 }}>
                  Bạn có chắc chắn muốn xóa quy tắc <strong style={{ color: "#0F172A" }}>"{policyToDelete.name}"</strong> (<code style={{ color: "#0284C7", fontWeight: 700 }}>{policyToDelete.code || policyToDelete.id?.slice(0, 8)}</code>) không?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPolicyToDelete(null)}
                disabled={!!deletingPolicyId}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Warning Box */}
            <div style={{ padding: "0 24px 18px 24px" }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderLeft: "4px solid #DC2626",
                  fontSize: "0.8125rem",
                  color: "#991B1B",
                  lineHeight: 1.5,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>
                  <strong>Cảnh báo an toàn:</strong> Sau khi xóa, AI sẽ dừng kích hoạt hành động này trên cụm Kubernetes. Hành động này không thể hoàn tác.
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: "14px 24px",
                backgroundColor: "#F8FAFC",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setPolicyToDelete(null)}
                disabled={!!deletingPolicyId}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  color: "#475569",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={confirmExecuteDelete}
                disabled={!!deletingPolicyId}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "1px solid #DC2626",
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: deletingPolicyId ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(220, 38, 38, 0.25)",
                }}
              >
                <Trash2 size={14} />
                <span>{deletingPolicyId ? "Đang xóa..." : "Xác nhận xóa"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoliciesPage;
