import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  Radio,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Database,
  Terminal,
  Copy,
  Check,
  X,
  ExternalLink,
  Shield,
  HelpCircle,
  FileCode,
  Layers,
} from 'lucide-react';

export const AgentsPage = () => {
  const { currentEnv, isRefreshing, triggerRefresh } = useDashboard();

  // Search and status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Install Modal state
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [activeInstallTab, setActiveInstallTab] = useState('helm');
  const [copiedHelm, setCopiedHelm] = useState(false);
  const [copiedKubectl, setCopiedKubectl] = useState(false);

  // Agents mock data
  const agents = [
    {
      id: 'agent-01',
      name: 'selfheal-agent-worker-01',
      node: 'k8s-worker-node-01.internal',
      status: 'ONLINE',
      heartbeat: '2 giây trước',
      version: 'v1.4.2',
      cpu: '0.5%',
      mem: '41 MB',
      ebpfHooks: 'socket, tcp_drop, sys_enter',
      restarts: 0,
      ip: '10.244.1.15',
    },
    {
      id: 'agent-02',
      name: 'selfheal-agent-worker-02',
      node: 'k8s-worker-node-02.internal',
      status: 'ONLINE',
      heartbeat: '4 giây trước',
      version: 'v1.4.2',
      cpu: '0.6%',
      mem: '43 MB',
      ebpfHooks: 'socket, tcp_drop, sys_enter',
      restarts: 0,
      ip: '10.244.2.18',
    },
    {
      id: 'agent-03',
      name: 'selfheal-agent-worker-03',
      node: 'k8s-worker-node-03.internal',
      status: 'ONLINE',
      heartbeat: '3 giây trước',
      version: 'v1.4.2',
      cpu: '0.7%',
      mem: '45 MB',
      ebpfHooks: 'socket, tcp_drop, sys_enter',
      restarts: 0,
      ip: '10.244.3.22',
    },
  ];

  const filteredAgents = agents.filter((ag) => {
    const matchesSearch =
      ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.node.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || ag.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const helmCommand = `helm repo add selfheal https://charts.selfheal.io
helm upgrade --install selfheal-agent selfheal/selfheal-agent \\
  --namespace selfheal-system \\
  --create-namespace \\
  --set clusterName="${currentEnv?.cluster || 'k8s-prod-cluster-01'}" \\
  --set apiKey="sh_live_8f7b2c9a1e3d4f5a6b7c"`;

  const kubectlCommand = `kubectl apply -f https://raw.githubusercontent.com/selfheal/manifests/v1.4.2/agent-daemonset.yaml`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'helm') {
      setCopiedHelm(true);
      setTimeout(() => setCopiedHelm(false), 2000);
    } else {
      setCopiedKubectl(true);
      setTimeout(() => setCopiedKubectl(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header with Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Quản Trị Tác Tử eBPF Agent
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--dash-radius-full)',
                backgroundColor: 'var(--dash-mint-100)',
                color: 'var(--dash-mint-600)',
                border: '1px solid var(--dash-mint-200)',
              }}
            >
              3 Đang Hoạt Động
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Giám sát trạng thái kết nối, nhịp tim heartbeat, tải CPU/RAM của tác tử và triển khai lệnh DaemonSet vào cụm Kubernetes
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={triggerRefresh}
            disabled={isRefreshing}
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
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => setIsInstallModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--dash-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-sm)',
            }}
          >
            <Plus size={16} />
            <span>Cài đặt Tác tử Mới</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tổng số Tác tử</span>
            <Radio size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              3 / 3
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>100% Trực tuyến</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Bao phủ 100% worker nodes
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Nhịp tim Trung bình</span>
            <Clock size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              3.0s
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>Tần suất 5s</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Độ trễ truyền tin &lt; 2ms
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tải CPU / RAM Tác tử</span>
            <Cpu size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              0.6%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>~43 MB RAM</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            Mô hình siêu nhẹ (Zero-Overhead)
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Đầu dò Nhân eBPF</span>
            <CheckCircle2 size={16} color="var(--dash-success)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-success)', letterSpacing: '-0.02em' }}>
              Hoạt động
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>Linux 5.15+</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
            mTLS 1.3 bảo mật end-to-end
          </div>
        </div>
      </div>

      {/* 3. Filter & Agents Table */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Search box */}
          <div style={{ position: 'relative', width: '300px' }}>
            <input
              type="text"
              placeholder="Tìm theo tên agent hoặc node..."
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

          {/* Status filter */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'ONLINE', label: 'Trực tuyến' },
              { id: 'OFFLINE', label: 'Ngoại tuyến' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterStatus(st.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: filterStatus === st.id ? 600 : 500,
                  backgroundColor: filterStatus === st.id ? 'var(--dash-primary-light)' : 'transparent',
                  color: filterStatus === st.id ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                  borderRadius: 'var(--dash-radius-md)',
                  border: filterStatus === st.id ? '1px solid var(--dash-mint-200)' : '1px solid var(--dash-border)',
                  cursor: 'pointer',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agents Table */}
        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tên Tác Tử</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Node Máy Chủ</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Trạng Thái & Nhịp Tim</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Phiên Bản</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>CPU / RAM</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Đầu Dò eBPF</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Khởi Động Lại</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => (
                <tr
                  key={agent.id}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Radio size={14} color="var(--dash-primary)" />
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{agent.name}</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginLeft: '22px' }}>
                      IP: {agent.ip}
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {agent.node}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--dash-success)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--dash-success)' }}>Trực tuyến</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                      {agent.heartbeat}
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {agent.version}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{agent.cpu}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{agent.mem}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        backgroundColor: 'var(--dash-mint-100)',
                        color: 'var(--dash-mint-600)',
                        borderRadius: 'var(--dash-radius-full)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        border: '1px solid var(--dash-mint-200)',
                      }}
                    >
                      {agent.ebpfHooks}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--dash-text-secondary)' }}>
                    {agent.restarts} lần
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Troubleshooting Guide Box */}
      <div
        className="dash-card"
        style={{
          padding: '20px 24px',
          borderLeft: '4px solid var(--dash-primary)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <HelpCircle size={18} color="var(--dash-primary)" />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Hướng Dẫn Xử Lý Sự Cố Kết Nối Tác Tử (Troubleshooting)
          </h3>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
          Nếu một tác tử chuyển sang trạng thái Ngoại tuyến hoặc ngừng phát nhịp tim, vui lòng kiểm tra các bước sau trên cụm Kubernetes của bạn:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '0.75rem' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
            <strong>1. Kiểm tra Pod DaemonSet</strong>
            <p style={{ color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              Chạy <code>kubectl get pods -n selfheal-system -l app=selfheal-agent</code> để xác nhận toàn bộ Pods đang ở trạng thái Running.
            </p>
          </div>
          <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
            <strong>2. Phiên bản Linux Kernel</strong>
            <p style={{ color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              eBPF BPF_PROG_TYPE_SOCK_OPS yêu cầu phiên bản nhân Linux tối thiểu &gt;= 5.8 (khuyến nghị 5.15+ LTS).
            </p>
          </div>
          <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
            <strong>3. Kiểm tra Cổng Kết nối Egress</strong>
            <p style={{ color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              Đảm bảo NetworkPolicy hoặc tường lửa cho phép lưu lượng TCP cổng 443 đi ra <code>telemetry.selfheal.io</code>.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Modal: Cài đặt Tác tử Mới */}
      {isInstallModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: '100%',
              maxWidth: '620px',
              backgroundColor: '#FFFFFF',
              boxShadow: 'var(--dash-shadow-dropdown)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
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
                <Terminal size={18} color="var(--dash-primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Cài Đặt Tác Tử SelfHeal eBPF
                </h3>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <button
                  onClick={() => setActiveInstallTab('helm')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--dash-radius-md)',
                    border: 'none',
                    backgroundColor: activeInstallTab === 'helm' ? 'var(--dash-primary-light)' : 'transparent',
                    color: activeInstallTab === 'helm' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    fontWeight: activeInstallTab === 'helm' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Helm Chart (Khuyến nghị)
                </button>
                <button
                  onClick={() => setActiveInstallTab('kubectl')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--dash-radius-md)',
                    border: 'none',
                    backgroundColor: activeInstallTab === 'kubectl' ? 'var(--dash-primary-light)' : 'transparent',
                    color: activeInstallTab === 'kubectl' ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                    fontWeight: activeInstallTab === 'kubectl' ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  kubectl Manifest Trực tiếp
                </button>
              </div>

              {activeInstallTab === 'helm' ? (
                <div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginBottom: '10px' }}>
                    Sao chép và thực thi câu lệnh sau trên máy trạm có kết nối <code>kubectl</code> tới cụm Kubernetes của bạn:
                  </p>
                  <div style={{ position: 'relative' }}>
                    <pre
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--dash-bg-canvas)',
                        borderRadius: 'var(--dash-radius-md)',
                        border: '1px solid var(--dash-border)',
                        color: 'var(--dash-text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        lineHeight: 1.5,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {helmCommand}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(helmCommand, 'helm')}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--dash-border)',
                        borderRadius: 'var(--dash-radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: copiedHelm ? 'var(--dash-success)' : 'var(--dash-text-primary)',
                      }}
                    >
                      {copiedHelm ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedHelm ? 'Đã sao chép!' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginBottom: '10px' }}>
                    Áp dụng tệp tài nguyên YAML DaemonSet trực tiếp:
                  </p>
                  <div style={{ position: 'relative' }}>
                    <pre
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--dash-bg-canvas)',
                        borderRadius: 'var(--dash-radius-md)',
                        border: '1px solid var(--dash-border)',
                        color: 'var(--dash-text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        lineHeight: 1.5,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {kubectlCommand}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(kubectlCommand, 'kubectl')}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--dash-border)',
                        borderRadius: 'var(--dash-radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: copiedKubectl ? 'var(--dash-success)' : 'var(--dash-text-primary)',
                      }}
                    >
                      {copiedKubectl ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKubectl ? 'Đã sao chép!' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Security Notice */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 12px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-50)',
                  border: '1px solid var(--dash-mint-200)',
                  fontSize: '0.75rem',
                  color: 'var(--dash-text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <Shield size={16} color="var(--dash-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Nguyên tắc Không Quyền Quản Trị Cụm (Zero Cluster-Admin):</strong> Tác tử SelfHeal chỉ thu thập viễn trắc thông qua socket nhân Linux và hoạt động dưới quyền ServiceAccount bị giới hạn chặt chẽ.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: 'var(--dash-bg-canvas)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setIsInstallModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  color: 'var(--dash-text-primary)',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
