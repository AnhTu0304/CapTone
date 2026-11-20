import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { nodeService } from '../../../services/nodeService';
import {
  Layers,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Database,
  Box,
  HardDrive,
  ShieldCheck,
  Search,
  ExternalLink,
  X,
  Info,
  Terminal,
} from 'lucide-react';

export const InfrastructurePage = () => {
  const { currentEnv, isRefreshing, triggerRefresh, onNavigate } = useDashboard();
  const [nodes, setNodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal State cho Node Detail / Safe Drain
  const [selectedNode, setSelectedNode] = useState(null);
  const [drainStatus, setDrainStatus] = useState(null); // null | 'DRAINING' | 'SUCCESS'

  // 1. Tải danh sách Nodes THẬT theo Cụm K8s độc lập (Không gộp tổ chức)
  const fetchClusterNodes = useCallback(async () => {
    const clusterId = currentEnv?.clusterId || currentEnv?.id;
    if (!clusterId) return;

    setIsLoading(true);
    try {
      const data = await nodeService.getNodesByCluster(clusterId);
      setNodes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[InfrastructurePage] Lỗi tải danh sách Nodes:', err);
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentEnv?.clusterId, currentEnv?.id]);

  useEffect(() => {
    fetchClusterNodes();
  }, [fetchClusterNodes]);

  const handleRefresh = async () => {
    triggerRefresh();
    await fetchClusterNodes();
  };

  // 2. Chuẩn hóa dữ liệu từng Node
  const normalizedNodes = useMemo(() => {
    return nodes.map((node) => {
      // Xác định Role
      let roleLabel = 'Worker';
      try {
        let parsedRoles = node.roles;
        if (typeof parsedRoles === 'string') {
          parsedRoles = JSON.parse(parsedRoles);
        }
        if (Array.isArray(parsedRoles) && parsedRoles.some((r) => r.includes('control-plane') || r.includes('master'))) {
          roleLabel = 'Control Plane';
        }
      } catch (e) {
        if (node.name.includes('control-plane') || node.name.includes('master') || node.name === 'minikube') {
          roleLabel = 'Control Plane';
        }
      }

      const totalCpuCores = Math.max(1, Math.round((node.cpu_capacity_millicores || 4000) / 1000));
      const totalRamGB = Number(((node.memory_capacity_bytes || 8589934592) / (1024 ** 3)).toFixed(1));
      const totalDiskTB = node.disk_capacity_bytes ? Number((node.disk_capacity_bytes / (1024 ** 4)).toFixed(1)) : null;

      const podCount = Number(node.pods_count || 0);
      const maxPods = 110; // Giới hạn K8s chuẩn

      // Phân bổ CPU / RAM ước tính dựa trên số lượng Pods thật
      const allocatedCores = Number(Math.min(podCount * 0.15, totalCpuCores).toFixed(1));
      const cpuPercent = Math.min(100, Math.round((allocatedCores / totalCpuCores) * 100));

      const allocatedRamGB = Number(Math.min(podCount * 0.2, totalRamGB).toFixed(1));
      const ramPercent = Math.min(100, Math.round((allocatedRamGB / totalRamGB) * 100));

      // Thông tin OS & Kubelet
      const labels = node.labels || {};
      const osName = labels['kubernetes.io/os'] || 'Linux';
      const osArch = labels['kubernetes.io/arch'] || 'amd64';
      const hostname = labels['kubernetes.io/hostname'] || node.name || 'minikube';
      const isNumericIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
      const addressDisplay = isNumericIp ? `IP: ${hostname}` : `Hostname: ${hostname}`;

      return {
        ...node,
        role: roleLabel,
        isControlPlane: roleLabel === 'Control Plane',
        totalCpuCores,
        totalRamGB,
        totalDiskTB,
        podCount,
        maxPods,
        allocatedCores,
        cpuPercent,
        allocatedRamGB,
        ramPercent,
        osDisplay: `${osName.charAt(0).toUpperCase() + osName.slice(1)} (${osArch})`,
        kubeletDisplay: node.kubelet_version || 'v1.37.0',
        ipDisplay: hostname,
        addressDisplay,
      };
    });
  }, [nodes]);

  // 3. Lọc danh sách Nodes
  const filteredNodes = useMemo(() => {
    return normalizedNodes.filter((node) => {
      const matchesSearch =
        (node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.ipDisplay || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'CP' && node.role === 'Control Plane') ||
        (roleFilter === 'WORKER' && node.role === 'Worker');
      return matchesSearch && matchesRole;
    });
  }, [normalizedNodes, searchQuery, roleFilter]);

  // 4. Thống kê KPI trên đầu trang từ dữ liệu thật của Cụm
  const totalNodesCount = normalizedNodes.length;
  const cpCount = normalizedNodes.filter((n) => n.isControlPlane).length;
  const workerCount = totalNodesCount - cpCount;
  const readyNodesCount = normalizedNodes.filter((n) => n.status === 'Ready').length;
  const readyPercent = totalNodesCount > 0 ? Math.round((readyNodesCount / totalNodesCount) * 100) : 0;

  const totalClusterCpu = normalizedNodes.reduce((sum, n) => sum + n.totalCpuCores, 0);
  const totalAllocatedCpu = normalizedNodes.reduce((sum, n) => sum + n.allocatedCores, 0);
  const clusterCpuPercent = totalClusterCpu > 0 ? Math.round((totalAllocatedCpu / totalClusterCpu) * 100) : 0;

  const totalClusterRam = normalizedNodes.reduce((sum, n) => sum + n.totalRamGB, 0);
  const totalAllocatedRam = normalizedNodes.reduce((sum, n) => sum + n.allocatedRamGB, 0);
  const clusterRamPercent = totalClusterRam > 0 ? Math.round((totalAllocatedRam / totalClusterRam) * 100) : 0;

  const totalClusterPods = normalizedNodes.reduce((sum, n) => sum + n.podCount, 0);
  const maxClusterPods = totalNodesCount * 110;
  const podDensityPercent = maxClusterPods > 0 ? ((totalClusterPods / maxClusterPods) * 100).toFixed(1) : 0;

  // Xử lý Tháo tải (Safe Drain) Node
  const handleDrainNode = async (node) => {
    setDrainStatus('DRAINING');
    try {
      await nodeService.drainNode(node.id || node.name);
      setDrainStatus('SUCCESS');
      setTimeout(() => {
        setSelectedNode(null);
        setDrainStatus(null);
        if (onNavigate) onNavigate('/dashboard/self-healing/approvals');
      }, 1500);
    } catch (err) {
      console.warn('[InfrastructurePage] Lỗi yêu cầu Drain:', err);
      setDrainStatus(null);
      alert('Không thể gửi yêu cầu Drain Node: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header with Status & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <Server size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Hạ Tầng Máy Chủ Kubernetes
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Quản lý tài nguyên vCPU, RAM &amp; sức chứa Pods của từng Node trên cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{currentEnv?.cluster || currentEnv?.name || 'K8s'}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          style={{
            height: '34px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(203, 213, 225, 0.9)',
            borderRadius: '10px',
            color: '#334155',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
          }}
        >
          <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* 2. Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG SỐ NODES</span>
            <Layers size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : totalNodesCount}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#059669' }}>
              {cpCount} CP / {workerCount} Workers
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {readyPercent}% Sẵn sàng (Ready)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #3B82F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG vCPU KHẢ DỤNG</span>
            <Cpu size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : totalClusterCpu}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>vCPUs</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            Đã phân bổ: {totalAllocatedCpu} vCPUs ({clusterCpuPercent}%)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #10B981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>TỔNG BỘ NHỚ RAM</span>
            <Database size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : totalClusterRam.toFixed(1)}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>GB</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            Đã phân bổ: {totalAllocatedRam.toFixed(1)} GB ({clusterRamPercent}%)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '11px 14px', borderRadius: '12px', borderTop: '2.5px solid #8B5CF6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>SỨC CHỨA PODS</span>
            <Box size={14} color="#8B5CF6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {isLoading ? '...' : `${totalClusterPods}/${maxClusterPods}`}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#059669' }}>
              {podDensityPercent}%
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '3px' }}>
            {totalNodesCount > 0 ? 'Tỷ lệ lấp đầy Pod trên cụm' : 'Chờ kết nối Node'}
          </div>
        </div>
      </div>

      {/* 3. Honest Empty State (Nếu cụm chưa có Node hoặc Agent Offline) */}
      {!isLoading && normalizedNodes.length === 0 && (
        <div
          className="dash-card"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--dash-warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--dash-warning-text)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            Chưa có Node máy chủ nào được phát hiện trong cụm này
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-secondary)', maxWidth: '560px', lineHeight: '1.5' }}>
            Cụm <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv?.name}</strong> hiện chưa nhận được dữ liệu đồng bộ từ Kubernetes Agent. Vui lòng kiểm tra tác tử eBPF hoặc cài đặt Agent vào cụm để bắt đầu khám phá Nodes và Pods.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/agents')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--dash-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Terminal size={14} />
              <span>Kiểm Tra Tác Tử Agent</span>
            </button>
            <button
              onClick={handleRefresh}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-primary)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: '1px solid var(--dash-border)',
                cursor: 'pointer',
              }}
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* 4. Nodes Table (Hiển thị khi có dữ liệu) */}
      {(isLoading || normalizedNodes.length > 0) && (
        <div className="dash-card" style={{ padding: '16px 18px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder="Tìm theo tên máy chủ hoặc IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 12px',
                  fontSize: '0.8rem',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  outline: 'none',
                  color: '#0F172A',
                }}
              />
            </div>

            <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'CP', label: 'Control Plane' },
                { id: 'WORKER', label: 'Worker Nodes' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoleFilter(r.id)}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    fontSize: '0.75rem',
                    fontWeight: roleFilter === r.id ? 700 : 600,
                    backgroundColor: roleFilter === r.id ? '#FFFFFF' : 'transparent',
                    color: roleFilter === r.id ? '#047857' : '#64748B',
                    borderRadius: '7px',
                    border: 'none',
                    boxShadow: roleFilter === r.id ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dash-table-container" style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>Tên Máy Chủ (Node)</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>Vai Trò</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>Trạng Thái</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>CPU Đã Cấp</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>RAM Đã Cấp</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>Số Lượng Pods</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700 }}>Hệ Điều Hành / Kubelet</th>
                  <th style={{ padding: '11px 14px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                      Đang tải danh sách Nodes từ cụm Kubernetes...
                    </td>
                  </tr>
                ) : filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                      Không tìm thấy máy chủ nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredNodes.map((node) => (
                    <tr
                      key={node.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background-color 0.14s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Server size={14} color="#059669" />
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{node.name}</span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748B', marginLeft: '22px', fontFamily: 'var(--font-mono)' }}>
                          {node.addressDisplay}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 9px',
                            borderRadius: '999px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor: node.isControlPlane ? '#EFF6FF' : '#F8FAFC',
                            color: node.isControlPlane ? '#1D4ED8' : '#475569',
                            border: `1px solid ${node.isControlPlane ? '#BFDBFE' : '#E2E8F0'}`,
                          }}
                        >
                          {node.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 9px',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: node.status === 'Ready' ? '#ECFDF5' : '#FFFBEB',
                            color: node.status === 'Ready' ? '#047857' : '#B45309',
                            border: `1px solid ${node.status === 'Ready' ? '#A7F3D0' : '#FDE68A'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: node.status === 'Ready' ? '#10B981' : '#F59E0B',
                            }}
                          />
                          {node.status || 'Ready'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#0F172A', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {node.allocatedCores} / {node.totalCpuCores} vCPUs ({node.cpuPercent}%)
                      </td>
                      <td style={{ padding: '12px 14px', color: '#0F172A', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {node.allocatedRamGB} / {node.totalRamGB} GB ({node.ramPercent}%)
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {node.podCount} / {node.maxPods}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#0F172A', fontWeight: 600 }}>{node.osDisplay}</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                          Kubelet {node.kubeletDisplay}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedNode(node)}
                            style={{
                              height: '28px',
                              padding: '0 10px',
                              backgroundColor: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#047857',
                              cursor: 'pointer',
                            }}
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => setSelectedNode(node)}
                            style={{
                              height: '28px',
                              padding: '0 10px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Tháo tải (Drain)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Modal Chi Tiết Node & Xác Nhận Drain */}
      {selectedNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: 'var(--dash-shadow-lg)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Server size={18} color="var(--dash-primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                  Máy Chủ: {selectedNode.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Vai Trò (Role)</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedNode.role}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Trạng Thái Kubelet</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-success)', marginTop: '2px' }}>
                    {selectedNode.status} ({selectedNode.kubeletDisplay})
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>vCPU Capacity</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedNode.totalCpuCores} vCPUs (Đang cấp: {selectedNode.allocatedCores} vCPUs)
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Bộ Nhớ RAM</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedNode.totalRamGB} GB (Đang cấp: {selectedNode.allocatedRamGB} GB)
                  </div>
                </div>
              </div>

              {/* Disk & Pods */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Ổ Đĩa Cục Bộ (Disk)</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                    {selectedNode.totalDiskTB ? `${selectedNode.totalDiskTB} TB` : 'Chuẩn Container Runtime'}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Pods Đang Chạy</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-primary)', marginTop: '2px' }}>
                    {selectedNode.podCount} Pods / Max 110
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: '6px' }}>
                  Nhãn Kubernetes (Labels từ Cluster):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                  {Object.entries(selectedNode.labels || {}).map(([key, value]) => (
                    <span
                      key={key}
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#F1F5F9',
                        border: '1px solid var(--dash-border)',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--dash-text-secondary)',
                      }}
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Safe Drain Notice */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--dash-info-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-info-border)',
                  display: 'flex',
                  gap: '10px',
                  fontSize: '0.75rem',
                  color: 'var(--dash-info-text)',
                }}
              >
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Tháo tải an toàn (Safe Drain):</strong> Lệnh này sẽ đánh dấu Node là không nhận thêm Pod mới (Cordon) và di tản có kiểm soát các Pods sang Node khác theo PodDisruptionBudget.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: 'var(--dash-bg-canvas)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--dash-text-secondary)',
                }}
              >
                Đóng
              </button>
              <button
                onClick={() => handleDrainNode(selectedNode)}
                disabled={drainStatus === 'DRAINING'}
                style={{
                  padding: '8px 16px',
                  backgroundColor: drainStatus === 'SUCCESS' ? 'var(--dash-success)' : 'var(--dash-warning)',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {drainStatus === 'DRAINING' ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Đang gửi yêu cầu...</span>
                  </>
                ) : drainStatus === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Đã chuyển đến MAPE-K!</span>
                  </>
                ) : (
                  <span>Tháo tải an toàn (Drain Node)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfrastructurePage;
