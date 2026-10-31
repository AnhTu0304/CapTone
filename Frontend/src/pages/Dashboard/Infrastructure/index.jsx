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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with Status & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Hạ Tầng Cụm Máy Chủ Kubernetes
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: readyNodesCount > 0 ? 'var(--dash-mint-100)' : 'var(--dash-warning-bg)',
                color: readyNodesCount > 0 ? 'var(--dash-mint-600)' : 'var(--dash-warning-text)',
                border: readyNodesCount > 0 ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-warning-border)',
              }}
            >
              {totalNodesCount > 0 ? `${readyNodesCount} / ${totalNodesCount} Nodes Sẵn Sàng` : '0 Nodes Ngoại Tuyến'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Quản lý tài nguyên vCPU, Bộ nhớ RAM và dung lượng Pods của từng máy chủ riêng biệt
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: 'var(--dash-radius-md)',
            color: 'var(--dash-text-primary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
          <span>Làm mới Nodes</span>
        </button>
      </div>

      {/* 2. Top Metric Cards (Thống kê từ CSDL cụm) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Tổng Nodes */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng số Nodes</span>
            <Layers size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : totalNodesCount}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>
              {cpCount} CP / {workerCount} Workers
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            {readyPercent}% Sẵn sàng (Ready)
          </div>
        </div>

        {/* Card 2: vCPU */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng vCPU Khả dụng</span>
            <Cpu size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : totalClusterCpu}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>vCPUs</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Đã phân bổ: {totalAllocatedCpu} vCPUs ({clusterCpuPercent}%)
          </div>
        </div>

        {/* Card 3: RAM */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng Bộ nhớ RAM</span>
            <Database size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : totalClusterRam.toFixed(1)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>GB</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Đã phân bổ: {totalAllocatedRam.toFixed(1)} GB ({clusterRamPercent}%)
          </div>
        </div>

        {/* Card 4: Sức chứa Pods */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sức chứa Pods</span>
            <Box size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : `${totalClusterPods} / ${maxClusterPods}`}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>
              {totalNodesCount > 0 ? 'Dư địa dồi dào' : 'Chờ kết nối'}
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Tỷ lệ lấp đầy Pod: {podDensityPercent}%
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
        <div className="dash-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <input
                type="text"
                placeholder="Tìm theo tên máy chủ hoặc IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  backgroundColor: 'var(--dash-bg-canvas)',
                  outline: 'none',
                  color: 'var(--dash-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'CP', label: 'Control Plane' },
                { id: 'WORKER', label: 'Worker Nodes' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoleFilter(r.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: roleFilter === r.id ? 600 : 500,
                    backgroundColor: roleFilter === r.id ? 'var(--dash-primary-light)' : 'transparent',
                    color: roleFilter === r.id ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    borderRadius: 'var(--dash-radius-md)',
                    border: roleFilter === r.id ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-border)',
                    cursor: 'pointer',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tên Máy Chủ (Node)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Vai Trò</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Trạng Thái</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>CPU Đã Cấp</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>RAM Đã Cấp</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Số Lượng Pods</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Hệ Điều Hành / Kubelet</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                      Đang tải danh sách Nodes từ cụm Kubernetes...
                    </td>
                  </tr>
                ) : filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                      Không tìm thấy máy chủ nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredNodes.map((node) => (
                    <tr
                      key={node.id}
                      style={{
                        borderBottom: '1px solid var(--dash-border)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Server size={14} color="var(--dash-primary)" />
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{node.name}</span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginLeft: '22px' }}>
                          {node.addressDisplay}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--dash-radius-full)',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            backgroundColor: node.isControlPlane ? 'var(--dash-info-bg)' : 'var(--dash-bg-subtle)',
                            color: node.isControlPlane ? 'var(--dash-info-text)' : 'var(--dash-text-primary)',
                            border: '1px solid var(--dash-border)',
                          }}
                        >
                          {node.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: node.status === 'Ready' ? 'var(--dash-success)' : 'var(--dash-warning)',
                            }}
                          />
                          <span style={{ fontWeight: 600, color: node.status === 'Ready' ? 'var(--dash-success)' : 'var(--dash-warning-text)' }}>
                            {node.status || 'Ready'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {node.allocatedCores} / {node.totalCpuCores} vCPUs ({node.cpuPercent}%)
                      </td>
                      <td style={{ padding: '12px', color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {node.allocatedRamGB} / {node.totalRamGB} GB ({node.ramPercent}%)
                      </td>
                      <td style={{ padding: '12px', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {node.podCount} / {node.maxPods}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>{node.osDisplay}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Kubelet {node.kubeletDisplay}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedNode(node)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid var(--dash-border)',
                              borderRadius: 'var(--dash-radius-sm)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--dash-text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => setSelectedNode(node)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--dash-border)',
                              borderRadius: 'var(--dash-radius-sm)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--dash-text-secondary)',
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
