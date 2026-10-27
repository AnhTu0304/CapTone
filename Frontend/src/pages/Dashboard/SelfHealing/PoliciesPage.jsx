import React, { useState, useEffect, useCallback } from 'react';
import { selfHealingService } from '../../../services/selfHealingService';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import usePermissions from '../../../hooks/usePermissions';
import NewPolicyModal from './NewPolicyModal';
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
  UserCheck
} from 'lucide-react';

export const PoliciesPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { user } = useAuth();
  const { role, isOwner, isDevOps, isViewer, canManagePolicies } = usePermissions();

  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);

  // Cluster Identity & State Isolation Key
  const clusterName = currentEnv?.cluster || currentEnv?.name || currentEnv?.id || 'all-clusters';
  const isOfflineMockCluster = currentEnv?.agentStatus === 'OFFLINE' || ['vcxv', 'gfgfdg', 'dmsndisa'].includes(String(clusterName).toLowerCase());
  const isClusterOnline = !isOfflineMockCluster;
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

  // Sync guards whenever cluster changes
  useEffect(() => {
    const guards = getGuardsForCluster(clusterKey, isClusterOnline, clusterName);
    setGlobalMode(guards.globalMode);
    setBlastRadiusThreshold(guards.blastRadiusThreshold);
    setMaxRestarts(guards.maxRestarts);
    setRestartTimeWindow(guards.restartTimeWindow);
    setApprovalTimeout(guards.approvalTimeout);
    setCooldownPeriod(guards.cooldownPeriod);
  }, [clusterKey, isClusterOnline, clusterName, getGuardsForCluster]);

  const updateClusterGuard = (field, value) => {
    const current = getGuardsForCluster(clusterKey, isClusterOnline, clusterName);
    const updated = {
      ...current,
      globalMode,
      blastRadiusThreshold,
      maxRestarts,
      restartTimeWindow,
      approvalTimeout,
      cooldownPeriod,
      [field]: value,
    };
    localStorage.setItem(`selfheal_guards_${clusterKey}`, JSON.stringify(updated));
    if (isClusterOnline) {
      localStorage.setItem('selfheal_safety_guards', JSON.stringify(updated));
    }
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

  const handleSelectAutomationMode = async (mode) => {
    if (!canManagePolicies) {
      alert('Chỉ SME Owner và DevOps mới có quyền thay đổi chế độ tự động hóa.');
      return;
    }
    setGlobalMode(mode);
    updateClusterGuard('globalMode', mode);

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

    const clusterMap = {};
    updatedList.forEach((p) => {
      clusterMap[p.id] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
      if (p.code) clusterMap[p.code] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
    });
    localStorage.setItem(`selfheal_policies_${clusterKey}`, JSON.stringify(clusterMap));

    if (isUsingLiveDb && isClusterOnline && updatedList.length > 0) {
      try {
        await Promise.all(
          updatedList.map((p) =>
            selfHealingService.updatePolicyConfig(p.id, {
              is_active: p.enabled,
              requires_approval: p.hitlRequired,
              execution_mode: p.hitlRequired ? 'MANUAL' : 'AUTO',
            })
          )
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (err) {
        console.warn('Lỗi đồng bộ chế độ tự động hóa xuống DB:', err.message);
      }
    }
  };

  const handleTogglePolicy = async (id) => {
    if (!canManagePolicies) {
      alert('Chỉ SME Owner và DevOps mới có quyền bật/tắt chính sách tự phục hồi.');
      return;
    }
    const target = policies.find((p) => p.id === id);
    if (!target) return;
    const newEnabled = !target.enabled;
    const updatedList = policies.map((p) => (p.id === id ? { ...p, enabled: newEnabled } : p));
    setPolicies(updatedList);

    // Save state isolated to current cluster
    const clusterMap = {};
    updatedList.forEach((p) => {
      clusterMap[p.id] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
      if (p.code) clusterMap[p.code] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
    });
    localStorage.setItem(`selfheal_policies_${clusterKey}`, JSON.stringify(clusterMap));

    if (isUsingLiveDb && isClusterOnline) {
      try {
        await selfHealingService.updatePolicyConfig(id, { is_active: newEnabled });
      } catch (err) {
        console.warn('Lỗi bật/tắt chính sách trên DB:', err.message);
      }
    }
  };

  const handleToggleHitl = async (id) => {
    if (!canManagePolicies) {
      alert('Chỉ SME Owner và DevOps mới có quyền cấu hình cổng HITL.');
      return;
    }
    const target = policies.find((p) => p.id === id);
    if (!target) return;
    const newHitl = !target.hitlRequired;
    const updatedList = policies.map((p) => (p.id === id ? { ...p, hitlRequired: newHitl } : p));
    setPolicies(updatedList);

    // Save state isolated to current cluster
    const clusterMap = {};
    updatedList.forEach((p) => {
      clusterMap[p.id] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
      if (p.code) clusterMap[p.code] = { enabled: p.enabled, hitlRequired: p.hitlRequired };
    });
    localStorage.setItem(`selfheal_policies_${clusterKey}`, JSON.stringify(clusterMap));

    if (isUsingLiveDb && isClusterOnline) {
      try {
        await selfHealingService.updatePolicyConfig(id, { requires_approval: newHitl, execution_mode: newHitl ? 'MANUAL' : 'AUTO' });
      } catch (err) {
        console.warn('Lỗi cập nhật cổng HITL trên DB:', err.message);
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!canManagePolicies) {
      alert('Chỉ SME Owner và DevOps mới có quyền lưu cấu hình ngưỡng an toàn.');
      return;
    }
    setSaveSuccess(true);

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
              cooldown_seconds: cooldownPeriod * 60,
              max_retries: maxRestarts,
            })
          )
        );
      } catch (err) {
        console.warn('Lỗi lưu cấu hình an toàn xuống DB:', err.message);
      }
    }

    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!canManagePolicies) {
      alert('Chỉ SME Owner và DevOps mới có quyền thêm quy tắc tự phục hồi.');
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
            Tổ chức: <strong style={{ color: 'var(--dash-text-primary)' }}>{currentOrg?.name || 'Tổ chức hiện tại'}</strong> &bull; Vị trí Cụm K8s:{' '}
            <span style={{ fontWeight: 700, color: 'var(--dash-primary)' }}>{currentEnv?.cluster || currentEnv?.name || 'Tất cả cụm'}</span> ({currentEnv?.envName || 'Môi trường hiện tại'}) &bull; Quản lý chính sách tự động và an toàn MAPE-K
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
                alert('Chỉ SME Owner và DevOps mới có quyền thêm quy tắc tự phục hồi.');
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

      {/* 1. Chế Độ Tự Động Hóa Cốt Lõi */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Shield size={18} color="var(--dash-primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
            Chế Độ Vận Hành Tự Động Hóa (Cluster Automation Mode)
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Supervised HITL (Khuyến nghị) */}
          <div
            onClick={() => handleSelectAutomationMode('SUPERVISED')}
            style={{
              padding: '16px',
              borderRadius: 'var(--dash-radius-md)',
              border: globalMode === 'SUPERVISED' ? '2px solid var(--dash-primary)' : '1px solid var(--dash-border-subtle)',
              backgroundColor: globalMode === 'SUPERVISED' ? 'rgba(16, 185, 129, 0.04)' : 'white',
              cursor: canManagePolicies ? 'pointer' : 'not-allowed',
              opacity: canManagePolicies ? 1 : 0.8,
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#059669" />
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--dash-text-primary)' }}>
                  Bán Tự Động Có Giám Sát
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                }}
              >
                Khuyến nghị cho SME
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              AI tự động khắc phục các sự cố rủi ro thấp (OOM, Deadlock). Mọi hành động rủi ro cao (Drain node, Rollback) bắt buộc chuyển qua Cổng phê duyệt Con người (HITL).
            </p>
          </div>

          {/* Autonomous */}
          <div
            onClick={() => handleSelectAutomationMode('AUTONOMOUS')}
            style={{
              padding: '16px',
              borderRadius: 'var(--dash-radius-md)',
              border: globalMode === 'AUTONOMOUS' ? '2px solid var(--dash-primary)' : '1px solid var(--dash-border-subtle)',
              backgroundColor: globalMode === 'AUTONOMOUS' ? 'rgba(16, 185, 129, 0.04)' : 'white',
              cursor: canManagePolicies ? 'pointer' : 'not-allowed',
              opacity: canManagePolicies ? 1 : 0.8,
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} color="#2563eb" />
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--dash-text-primary)' }}>
                  Tự Trị Toàn Phần (Autonomous)
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                }}
              >
                Không cần can thiệp
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Mọi hành động phục hồi được MAPE-K lập tức thực thi nếu không vượt quá ngưỡng bán kính sự cố (Blast Radius). Tối ưu MTTR xuống dưới 2 giây.
            </p>
          </div>

          {/* Audit Only */}
          <div
            onClick={() => handleSelectAutomationMode('AUDIT')}
            style={{
              padding: '16px',
              borderRadius: 'var(--dash-radius-md)',
              border: globalMode === 'AUDIT' ? '2px solid var(--dash-primary)' : '1px solid var(--dash-border-subtle)',
              backgroundColor: globalMode === 'AUDIT' ? 'rgba(16, 185, 129, 0.04)' : 'white',
              cursor: canManagePolicies ? 'pointer' : 'not-allowed',
              opacity: canManagePolicies ? 1 : 0.8,
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} color="#d97706" />
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--dash-text-primary)' }}>
                  Chỉ Cảnh Báo (Audit & Dry-Run)
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--dash-radius-full)',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  border: '1px solid #fde68a',
                }}
              >
                An toàn tuyệt đối
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              AI chỉ phân tích nguyên nhân gốc rễ và đề xuất giải pháp, tuyệt đối không can thiệp hay thay đổi trạng thái Kubernetes cluster.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Ngưỡng Kích Hoạt Cổng Phê Duyệt (HITL Safety Thresholds) */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sliders size={18} color="var(--dash-primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
            Ngưỡng An Toàn & Kích Hoạt Cổng HITL (Safety Guards)
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Blast Radius Threshold */}
          <div style={{ padding: '14px', backgroundColor: 'var(--dash-bg-subtle)', borderRadius: 'var(--dash-radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Bán Kính Ảnh Hưởng Kích Hoạt HITL
              </label>
              <span style={{ fontWeight: 700, color: 'var(--dash-primary)', fontSize: '0.9375rem' }}>
                {blastRadiusThreshold}% Pods
              </span>
            </div>
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
              style={{ width: '100%', accentColor: 'var(--dash-primary)', cursor: canManagePolicies ? 'pointer' : 'not-allowed', opacity: canManagePolicies ? 1 : 0.6 }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '6px 0 0 0' }}>
              Hành động có khả năng tác động trên {blastRadiusThreshold}% số lượng Pods trong cùng Namespace sẽ tự động kích hoạt Cổng phê duyệt.
            </p>
          </div>

          {/* Max Restarts */}
          <div style={{ padding: '14px', backgroundColor: 'var(--dash-bg-subtle)', borderRadius: 'var(--dash-radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Giới Hạn Tự Động Khởi Động Lại
              </label>
              <span style={{ fontWeight: 700, color: 'var(--dash-primary)', fontSize: '0.9375rem' }}>
                {maxRestarts} lần / {restartTimeWindow} phút
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={maxRestarts}
                disabled={!canManagePolicies}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxRestarts(val);
                  updateClusterGuard('maxRestarts', val);
                }}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem', cursor: canManagePolicies ? 'pointer' : 'not-allowed', opacity: canManagePolicies ? 1 : 0.6 }}
              >
                <option value={2}>2 lần</option>
                <option value={3}>3 lần (Chuẩn K8s)</option>
                <option value={5}>5 lần</option>
              </select>
              <select
                value={restartTimeWindow}
                disabled={!canManagePolicies}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRestartTimeWindow(val);
                  updateClusterGuard('restartTimeWindow', val);
                }}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem', cursor: canManagePolicies ? 'pointer' : 'not-allowed', opacity: canManagePolicies ? 1 : 0.6 }}
              >
                <option value={10}>Trong 10 phút</option>
                <option value={15}>Trong 15 phút</option>
                <option value={30}>Trong 30 phút</option>
              </select>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '6px 0 0 0' }}>
              Ngăn chặn hiện tượng CrashLoopBackOff lặp vô tận làm suy kiệt Node và tài nguyên CPU.
            </p>
          </div>

          {/* Approval Timeout & Cooldown */}
          <div style={{ padding: '14px', backgroundColor: 'var(--dash-bg-subtle)', borderRadius: 'var(--dash-radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Thời Gian Chờ Duyệt & Hạ Nhiệt
              </label>
              <span style={{ fontWeight: 700, color: 'var(--dash-primary)', fontSize: '0.9375rem' }}>
                {approvalTimeout}m / {cooldownPeriod}m
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={approvalTimeout}
                disabled={!canManagePolicies}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setApprovalTimeout(val);
                  updateClusterGuard('approvalTimeout', val);
                }}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem', cursor: canManagePolicies ? 'pointer' : 'not-allowed', opacity: canManagePolicies ? 1 : 0.6 }}
              >
                <option value={10}>Timeout: 10 phút</option>
                <option value={20}>Timeout: 20 phút</option>
                <option value={30}>Timeout: 30 phút</option>
              </select>
              <select
                value={cooldownPeriod}
                disabled={!canManagePolicies}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCooldownPeriod(val);
                  updateClusterGuard('cooldownPeriod', val);
                }}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem', cursor: canManagePolicies ? 'pointer' : 'not-allowed', opacity: canManagePolicies ? 1 : 0.6 }}
              >
                <option value={3}>Hạ nhiệt: 3 phút</option>
                <option value={5}>Hạ nhiệt: 5 phút</option>
                <option value={10}>Hạ nhiệt: 10 phút</option>
              </select>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '6px 0 0 0' }}>
              Hết thời gian chờ duyệt sẽ tự hủy lệnh an toàn. Thời gian hạ nhiệt chống giật xung (chatter).
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
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Vị Trí Cụm & Phân Loại</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Điều Kiện Kích Hoạt</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Hành Động Tự Sửa Lỗi</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Rủi Ro</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Cần Duyệt (HITL)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Bật / Tắt</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B' }}>
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
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1px solid #BFDBFE',
                            width: 'fit-content',
                          }}
                        >
                          <Server size={10} />
                          <span>Cụm: {currentEnv?.cluster || currentEnv?.name || 'Tất cả cụm'}</span>
                        </span>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '0.6875rem',
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--dash-bg-subtle)',
                            color: 'var(--dash-text-secondary)',
                            width: 'fit-content',
                          }}
                        >
                          ns: {p.targetNamespace || 'production'}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                      {p.condition}
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ color: 'var(--dash-text-primary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                        {p.action}
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        {currentEnv?.agentStatus === 'ONLINE' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: '#059669',
                              backgroundColor: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            <CheckCircle2 size={10} />
                            <span>Đã cấp quyền trên cụm {currentEnv?.cluster || currentEnv?.name || 'Tất cả cụm'}</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: '#D97706',
                              backgroundColor: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            <AlertTriangle size={10} />
                            <span>Chưa cấp quyền (Tác tử Ngoại tuyến)</span>
                          </span>
                        )}
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
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

            {/* Modal Thêm Quy Tắc Mới (Structured Dropdown Builder) */}
      <NewPolicyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={fetchPolicies}
        currentOrg={currentOrg}
        currentEnv={currentEnv}
      />
    </div>
  );
};

export default PoliciesPage;
