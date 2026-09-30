import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
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
  Check
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
  const { isRefreshing, triggerRefresh } = useDashboard();

  // Settings State
  const [globalMode, setGlobalMode] = useState('SUPERVISED'); // AUTONOMOUS, SUPERVISED, AUDIT
  const [blastRadiusThreshold, setBlastRadiusThreshold] = useState(30); // %
  const [maxRestarts, setMaxRestarts] = useState(3);
  const [restartTimeWindow, setRestartTimeWindow] = useState(15); // minutes
  const [approvalTimeout, setApprovalTimeout] = useState(20); // minutes
  const [cooldownPeriod, setCooldownPeriod] = useState(5); // minutes

  // Policies list state
  const [policies, setPolicies] = useState(INITIAL_POLICIES);
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

  const handleTogglePolicy = (id) => {
    setPolicies(policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  };

  const handleToggleHitl = (id) => {
    setPolicies(policies.map((p) => (p.id === id ? { ...p, hitlRequired: !p.hitlRequired } : p)));
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    if (!newRule.name || !newRule.condition || !newRule.action) return;

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Ma Trận Chính Sách Tự Phục Hồi
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              MAPE-K v2.4
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            Thiết lập phạm vi tự động hóa, ngưỡng an toàn kích hoạt cổng phê duyệt con người (HITL) và kiểm soát tác động cụm.
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
            onClick={() => setShowAddModal(true)}
            className="dash-btn"
            style={{
              padding: '8px 14px',
              backgroundColor: 'white',
              border: '1px solid var(--dash-primary)',
              color: 'var(--dash-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} />
            Thêm Quy Tắc Mới
          </button>

          <button
            onClick={handleSaveSettings}
            className="dash-btn"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--dash-primary)',
              color: 'white',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
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
            onClick={() => setGlobalMode('SUPERVISED')}
            style={{
              padding: '16px',
              borderRadius: 'var(--dash-radius-md)',
              border: globalMode === 'SUPERVISED' ? '2px solid var(--dash-primary)' : '1px solid var(--dash-border-subtle)',
              backgroundColor: globalMode === 'SUPERVISED' ? 'rgba(16, 185, 129, 0.04)' : 'white',
              cursor: 'pointer',
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
            onClick={() => setGlobalMode('AUTONOMOUS')}
            style={{
              padding: '16px',
              borderRadius: 'var(--dash-radius-md)',
              border: globalMode === 'AUTONOMOUS' ? '2px solid var(--dash-primary)' : '1px solid var(--dash-border-subtle)',
              backgroundColor: globalMode === 'AUTONOMOUS' ? 'rgba(16, 185, 129, 0.04)' : 'white',
              cursor: 'pointer',
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
            onClick={() => setGlobalMode('AUDIT')}
            style={{
              padding: '16px',
              borderRadius: 'var(--dash-radius-md)',
              border: globalMode === 'AUDIT' ? '2px solid var(--dash-primary)' : '1px solid var(--dash-border-subtle)',
              backgroundColor: globalMode === 'AUDIT' ? 'rgba(16, 185, 129, 0.04)' : 'white',
              cursor: 'pointer',
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
              onChange={(e) => setBlastRadiusThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--dash-primary)', cursor: 'pointer' }}
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
                onChange={(e) => setMaxRestarts(Number(e.target.value))}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem' }}
              >
                <option value={2}>2 lần</option>
                <option value={3}>3 lần (Chuẩn K8s)</option>
                <option value={5}>5 lần</option>
              </select>
              <select
                value={restartTimeWindow}
                onChange={(e) => setRestartTimeWindow(Number(e.target.value))}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem' }}
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
                onChange={(e) => setApprovalTimeout(Number(e.target.value))}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem' }}
              >
                <option value={10}>Timeout: 10 phút</option>
                <option value={20}>Timeout: 20 phút</option>
                <option value={30}>Timeout: 30 phút</option>
              </select>
              <select
                value={cooldownPeriod}
                onChange={(e) => setCooldownPeriod(Number(e.target.value))}
                className="dash-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.8125rem' }}
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
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Phân Loại & Namespace</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Điều Kiện Kích Hoạt</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Hành Động Tự Sửa Lỗi</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Rủi Ro</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Cần Duyệt (HITL)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Bật / Tắt</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => {
                const isHighRisk = p.riskLevel === 'HIGH';
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
                          {p.id}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{p.name}</div>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)', fontWeight: 500 }}>
                        {p.category}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.6875rem',
                          fontFamily: 'monospace',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--dash-bg-subtle)',
                          color: 'var(--dash-text-secondary)',
                          marginTop: '4px',
                        }}
                      >
                        {p.targetNamespace}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
                      {p.condition}
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: 'var(--dash-text-primary)', fontSize: '0.8125rem', fontWeight: 500 }}>
                      {p.action}
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
                        }}
                      >
                        {p.hitlRequired ? <Lock size={12} /> : null}
                        {p.hitlRequired ? 'Bắt Buộc Duyệt' : 'Tự Động Chạy'}
                      </button>
                    </td>

                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={() => handleTogglePolicy(p.id)}
                          style={{ accentColor: 'var(--dash-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: p.enabled ? '#059669' : 'var(--dash-text-secondary)' }}>
                          {p.enabled ? 'Đang Bật' : 'Tạm Dừng'}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
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
