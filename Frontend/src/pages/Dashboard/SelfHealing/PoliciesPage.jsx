import React, { useState, useEffect, useCallback } from 'react';
import { selfHealingService } from '../../../services/selfHealingService';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../../context/AuthContext';
import usePermissions from '../../../hooks/usePermissions';
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
  Database,
  ShieldCheck,
  User,
  AlertTriangle,
  Building,
  Server,
  UserCheck
} from 'lucide-react';

const INITIAL_POLICIES = [
  {
    id: 'POL-01',
    name: 'Tự động mở rộng RAM khi phát hiện rò rỉ (OOMKilled Guard)',
    category: 'Tài nguyên & Cấu hình',
    targetNamespace: 'production',
    condition: 'Memory Usage > 90% kéo dài trên 3 phút hoặc 1 lần OOMKilled',
    action: 'Tăng memory.limit thêm 25% (tối đa không vượt quá 4Gi)',
    riskLevel: 'LOW',
    hitlRequired: false,
    enabled: true,
  },
  {
    id: 'POL-02',
    name: 'Tháo tải & Cô lập máy chủ suy yếu (Cordon & Drain Node)',
    category: 'Hạ tầng Vật lý & Máy chủ',
    targetNamespace: 'Toàn cụm (All Nodes)',
    condition: 'Tỷ lệ lỗi Kubelet > 15% hoặc I/O Disk Stall > 45 giây',
    action: 'Cordon node, kiểm tra PDB và Evict từng Pod an toàn',
    riskLevel: 'HIGH',
    hitlRequired: true,
    enabled: true,
  },
  {
    id: 'POL-03',
    name: 'Tự động Rollback khi Deployment phát sinh lỗi CrashLoop',
    category: 'Phiên bản & Triển khai',
    targetNamespace: 'production',
    condition: 'Tỷ lệ Pod Restart > 3 lần trong vòng 5 phút sau release mới',
    action: 'Khôi phục về bản ReplicaSet ổn định trước đó (Rollback v-1)',
    riskLevel: 'HIGH',
    hitlRequired: true,
    enabled: true,
  },
  {
    id: 'POL-04',
    name: 'Khởi động lại Pods bị Deadlock Thread / Unresponsive',
    category: 'Tiến trình Ứng dụng',
    targetNamespace: 'backend, payments',
    condition: 'Liveness Probe thất bại 3 lần liên tiếp, HTTP 504 Gateway',
    action: 'Thu thập Thread Dump, sau đó Rolling Restart Pod',
    riskLevel: 'MEDIUM',
    hitlRequired: false,
    enabled: true,
  },
  {
    id: 'POL-05',
    name: 'Tự động mở rộng đĩa lưu trữ PVC (Storage Auto-Expander)',
    category: 'Lưu trữ & Dữ liệu',
    targetNamespace: 'database, logging',
    condition: 'Dung lượng đĩa khả dụng < 15% tổng dung lượng PVC',
    action: 'Gửi yêu cầu Resize CSI StorageClass thêm 20% dung lượng',
    riskLevel: 'MEDIUM',
    hitlRequired: false,
    enabled: true,
  },
  {
    id: 'POL-06',
    name: 'Tự kích hoạt HPA dự báo tải đột biến (Predictive Auto-Scale)',
    category: 'Khả năng Co giãn',
    targetNamespace: 'production, frontend',
    condition: 'AI dự báo tải lượng truy cập tăng gấp 2 lần trong 15 phút tới',
    action: 'Nâng trước số lượng Replicas tối thiểu từ 3 lên 6 Pods',
    riskLevel: 'LOW',
    hitlRequired: false,
    enabled: true,
  },
];

export const PoliciesPage = () => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const { user } = useAuth();
  const { role, isOwner, isDevOps, isViewer, canManagePolicies } = usePermissions();

  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);

  // Cluster Identity & State Isolation Key
  const clusterName = currentEnv?.cluster || currentEnv?.name || 'sang-k8s';
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
    // For primary/online cluster (e.g. sang-k8s), check legacy settings or seed active defaults
    if (isOnline || (cName && cName.includes('sang-k8s'))) {
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
  const [policies, setPolicies] = useState(INITIAL_POLICIES);

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
      targetCluster: currentEnv?.cluster || 'sang-k8s',
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
      const basePolicies = items.length > 0 ? items.map(mapBackendPolicyToUI) : INITIAL_POLICIES;
      setIsUsingLiveDb(items.length > 0);

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
        // ONLINE cluster (e.g. sang-k8s): Keep backend/active enabled
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
      setIsUsingLiveDb(false);
      setPolicies(INITIAL_POLICIES.map((p) => ({
        ...p,
        enabled: isClusterOnline ? p.enabled : false,
      })));
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
        await selfHealingService.togglePolicyActive(id);
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
        await selfHealingService.updatePolicyConfig(id, { requires_approval: newHitl });
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
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: isUsingLiveDb ? '#DCFCE7' : '#FEF3C7',
                color: isUsingLiveDb ? '#15803D' : '#B45309',
                border: `1px solid ${isUsingLiveDb ? '#86EFAC' : '#FDE68A'}`,
              }}
            >
              <Database size={10} />
              <span>{isUsingLiveDb ? 'Live DB' : 'Mô phỏng'}</span>
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Tổ chức: <strong style={{ color: 'var(--dash-text-primary)' }}>{currentOrg?.name || 'SME Retail Enterprise'}</strong> &bull; Vị trí Cụm K8s:{' '}
            <span style={{ fontWeight: 700, color: 'var(--dash-primary)' }}>{currentEnv?.cluster || 'sang-k8s'}</span> ({currentEnv?.envName || 'Production'}) &bull; Quản lý chính sách tự động và an toàn MAPE-K
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

      {/* Dynamic RBAC, Company & Cluster Identity Verification Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          border: canManagePolicies && currentEnv?.agentStatus === 'ONLINE' ? '1px solid #BBF7D0' : '1px solid #FED7AA',
          backgroundColor: canManagePolicies && currentEnv?.agentStatus === 'ONLINE' ? '#F0FDF4' : '#FFFBEB',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Company, Cluster and User details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {/* Organization / Company */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#DCFCE7',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Doanh nghiệp / Tổ chức
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                  {currentOrg?.name || 'SME Retail Enterprise'}
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', backgroundColor: '#CBD5E1' }} />

            {/* Kubernetes Cluster */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: currentEnv?.agentStatus === 'ONLINE' ? '#E0F2FE' : '#FEF2F2',
                  color: currentEnv?.agentStatus === 'ONLINE' ? '#0369A1' : '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Server size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Vị trí Cụm K8s Áp Dụng
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: currentEnv?.agentStatus === 'ONLINE' ? '#0369A1' : '#B91C1C', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{currentEnv?.cluster || currentEnv?.displayName || 'sang-k8s'}</span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: currentEnv?.agentStatus === 'ONLINE' ? '#DBEAFE' : '#FEE2E2',
                      color: currentEnv?.agentStatus === 'ONLINE' ? '#1E40AF' : '#991B1B',
                      fontWeight: 600,
                    }}
                  >
                    {currentEnv?.envName || 'Production'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: currentEnv?.agentStatus === 'ONLINE' ? '#DCFCE7' : '#FEF3C7',
                      color: currentEnv?.agentStatus === 'ONLINE' ? '#166534' : '#B45309',
                      border: `1px solid ${currentEnv?.agentStatus === 'ONLINE' ? '#86EFAC' : '#FDE68A'}`,
                      fontWeight: 700,
                    }}
                  >
                    {currentEnv?.agentStatus === 'ONLINE' ? '🟢 Tác tử Online' : '🔴 Tác tử Ngoại tuyến'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', backgroundColor: '#CBD5E1' }} />

            {/* Current Authenticated User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: isOwner ? '#FEF3C7' : isDevOps ? '#EDE9FE' : '#F1F5F9',
                  color: isOwner ? '#B45309' : isDevOps ? '#6D28D9' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isOwner ? <ShieldCheck size={18} /> : isDevOps ? <UserCheck size={18} /> : <User size={18} />}
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Người dùng vận hành
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                  {user?.email || user?.full_name || 'sme-owner@retail.com'}
                </div>
              </div>
            </div>
          </div>

          {/* User Role Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isOwner && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: '#DCFCE7',
                  border: '1.5px solid #86EFAC',
                  color: '#15803D',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
              >
                👑 CHỦ DOANH NGHIỆP (SME OWNER)
              </span>
            )}
            {isDevOps && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: '#EFF6FF',
                  border: '1.5px solid #BFDBFE',
                  color: '#1D4ED8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
              >
                🛠️ KỸ SƯ DEVOPS
              </span>
            )}
            {isViewer && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: '#F8FAFC',
                  border: '1.5px solid #CBD5E1',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
              >
                👁️ NGƯỜI XEM (VIEWER - CHỈ ĐỌC)
              </span>
            )}
          </div>
        </div>

        {/* Verification Status Banner */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: !canManagePolicies ? '#F8FAFC' : (currentEnv?.agentStatus === 'ONLINE' ? '#DCFCE7' : '#FEF3C7'),
            fontSize: '0.8125rem',
            color: !canManagePolicies ? '#475569' : (currentEnv?.agentStatus === 'ONLINE' ? '#166534' : '#92400E'),
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 500,
            border: `1px solid ${!canManagePolicies ? '#CBD5E1' : (currentEnv?.agentStatus === 'ONLINE' ? '#86EFAC' : '#FDE68A')}`,
          }}
        >
          {!canManagePolicies ? (
            <>
              <AlertTriangle size={18} color="#64748B" style={{ flexShrink: 0 }} />
              <span>
                <strong>Chế độ chỉ xem (Read-Only):</strong> Tài khoản của bạn không có quyền sửa đổi hoặc thực thi chính sách tự phục hồi trên cụm <strong>{currentEnv?.cluster || 'sang-k8s'}</strong>. Các quyền quản trị này chỉ dành riêng cho <strong>SME Owner</strong> và <strong>DevOps</strong>.
              </span>
            </>
          ) : currentEnv?.agentStatus === 'ONLINE' ? (
            <>
              <CheckCircle2 size={18} color="#166534" style={{ flexShrink: 0 }} />
              <span>
                <strong>Đã cấp quyền toàn diện trên cụm {currentEnv?.cluster || 'sang-k8s'}:</strong> Bạn có toàn quyền quản trị ({isOwner ? 'Chủ doanh nghiệp' : 'Kỹ sư DevOps'}) và Tác tử eBPF đang <strong>Online</strong> trên cụm <strong>{currentEnv?.cluster || 'sang-k8s'}</strong>. Mọi Action tự sửa lỗi và chính sách MAPE-K được phép tự động can thiệp.
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={18} color="#B45309" style={{ flexShrink: 0 }} />
              <span>
                <strong>Cảnh báo vị trí cụm {currentEnv?.cluster || 'vcxv'}:</strong> Bạn có thẩm quyền quản trị ({isOwner ? 'Chủ doanh nghiệp' : 'Kỹ sư DevOps'}), NHƯNG cụm <strong>{currentEnv?.cluster || 'vcxv'}</strong> hiện tại đang có <strong>Tác tử Ngoại tuyến (Pending / Chưa kết nối)</strong>. Các Action tự phục hồi sẽ tạm hoãn gửi lệnh can thiệp xuống cụm này cho đến khi kết nối Agent.
              </span>
            </>
          )}
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
            onClick={() => {
              if (!canManagePolicies) {
                alert('Chỉ SME Owner và DevOps mới có quyền thay đổi chế độ tự động hóa.');
                return;
              }
              setGlobalMode('SUPERVISED');
              updateClusterGuard('globalMode', 'SUPERVISED');
            }}
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
            onClick={() => {
              if (!canManagePolicies) {
                alert('Chỉ SME Owner và DevOps mới có quyền thay đổi chế độ tự động hóa.');
                return;
              }
              setGlobalMode('AUTONOMOUS');
              updateClusterGuard('globalMode', 'AUTONOMOUS');
            }}
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
            onClick={() => {
              if (!canManagePolicies) {
                alert('Chỉ SME Owner và DevOps mới có quyền thay đổi chế độ tự động hóa.');
                return;
              }
              setGlobalMode('AUDIT');
              updateClusterGuard('globalMode', 'AUDIT');
            }}
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
                          <span>Cụm: {currentEnv?.cluster || 'sang-k8s'}</span>
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
                            <span>Đã cấp quyền trên cụm {currentEnv?.cluster || 'sang-k8s'}</span>
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

      {/* Modal Thêm Quy Tắc Mới */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
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
              maxWidth: '560px',
              backgroundColor: 'white',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  Thêm Quy Tắc Tự Phục Hồi Mới
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="dash-btn"
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--dash-text-secondary)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRule} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Tên Quy Tắc
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Tự động điều chỉnh dung lượng JVM heap..."
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="dash-input"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                    Phân Loại
                  </label>
                  <select
                    value={newRule.category}
                    onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                    className="dash-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                  >
                    <option value="Tài nguyên & Cấu hình">Tài nguyên & Cấu hình</option>
                    <option value="Hạ tầng Vật lý & Máy chủ">Hạ tầng Vật lý & Máy chủ</option>
                    <option value="Phiên bản & Triển khai">Phiên bản & Triển khai</option>
                    <option value="Tiến trình Ứng dụng">Tiến trình Ứng dụng</option>
                    <option value="Lưu trữ & Dữ liệu">Lưu trữ & Dữ liệu</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                    Namespace Mục Tiêu
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="production, default hoặc all"
                    value={newRule.targetNamespace}
                    onChange={(e) => setNewRule({ ...newRule, targetNamespace: e.target.value })}
                    className="dash-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Điều Kiện Viễn Trắc Kích Hoạt (Condition)
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: HTTP 503 > 5% trong 2 phút liên tiếp..."
                  value={newRule.condition}
                  onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                  className="dash-input"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Hành Động Sửa Lỗi Tự Động (MAPE-K Action)
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Kích hoạt HPA Scale up thêm 2 pods hoặc Restart Service..."
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                  className="dash-input"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                    Mức Độ Rủi Ro
                  </label>
                  <select
                    value={newRule.riskLevel}
                    onChange={(e) => setNewRule({ ...newRule, riskLevel: e.target.value })}
                    className="dash-input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
                  >
                    <option value="LOW">Thấp (LOW)</option>
                    <option value="MEDIUM">Vừa (MEDIUM)</option>
                    <option value="HIGH">Cao (HIGH)</option>
                  </select>
                </div>

                <div style={{ paddingTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={newRule.hitlRequired}
                      onChange={(e) => setNewRule({ ...newRule, hitlRequired: e.target.checked })}
                      style={{ accentColor: 'var(--dash-primary)', width: '16px', height: '16px' }}
                    />
                    Bắt buộc duyệt HITL
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="dash-btn"
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'white',
                    border: '1px solid var(--dash-border-subtle)',
                    color: 'var(--dash-text-secondary)',
                    fontSize: '0.8125rem',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="dash-btn"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--dash-primary)',
                    color: 'white',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  Thêm Quy Tắc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoliciesPage;
