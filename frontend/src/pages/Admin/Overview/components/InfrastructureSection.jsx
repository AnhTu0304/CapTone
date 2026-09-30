import React from 'react';
import { Server, Cpu, HardDrive, Wifi, CheckCircle2, AlertTriangle } from 'lucide-react';
import WidgetContainer from '../../../../components/admin/WidgetContainer';

export const InfrastructureSection = ({ infraData, status, errorMessage, onRetry }) => {
  return (
    <WidgetContainer
      title="Tổng Quan Hạ Tầng & Phân Bổ Tài Nguyên (Infrastructure Overview)"
      subtitle="Thống kê mức độ sử dụng CPU, RAM, Dung lượng đĩa và mật độ Pods trên các máy chủ"
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
    >
      {infraData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Resource Bars Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}
          >
            {/* CPU */}
            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} color="#059669" />
                  <span>CPU TỔNG HỢP</span>
                </span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065F46', fontFamily: 'var(--font-mono)' }}>
                  {infraData.cpuUsage}%
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${infraData.cpuUsage}%`, height: '100%', backgroundColor: '#10B981', borderRadius: '9999px' }} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
                Khả dụng còn lại: {100 - infraData.cpuUsage}% Cores
              </div>
            </div>

            {/* RAM */}
            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={14} color="#0284C7" />
                  <span>BỘ NHỚ RAM RSS</span>
                </span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0369A1', fontFamily: 'var(--font-mono)' }}>
                  {infraData.ramUsage}%
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${infraData.ramUsage}%`, height: '100%', backgroundColor: '#0284C7', borderRadius: '9999px' }} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
                Đã phân bổ 261.1 GB / 384 GB
              </div>
            </div>

            {/* Disk */}
            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={14} color="#D97706" />
                  <span>LƯU TRỮ ĐĨA (IOPS)</span>
                </span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#92400E', fontFamily: 'var(--font-mono)' }}>
                  {infraData.diskUsage}%
                </span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${infraData.diskUsage}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: '9999px' }} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
                NVMe Ceph / EBS CSI Volume
              </div>
            </div>

            {/* Network Throughput */}
            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={14} color="#6366F1" />
                  <span>BĂNG THÔNG MẠNG</span>
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4338CA', fontFamily: 'var(--font-mono)' }}>
                  RX: {infraData.networkRx}
                </span>
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                TX: {infraData.networkTx}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '6px' }}>
                Lưu lượng nội bộ Cilium eBPF
              </div>
            </div>
          </div>

          {/* Nodes Snapshot Table */}
          <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Tên Máy Chủ (Node)</th>
                  <th>CPU Tải</th>
                  <th>RAM Tiêu Thụ</th>
                  <th>Số Lượng Pods</th>
                  <th style={{ textAlign: 'right' }}>Trạng Thái Kubelet</th>
                </tr>
              </thead>
              <tbody>
                {infraData.topNodes.map((node) => (
                  <tr key={node.name}>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{node.name}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: node.cpu > 80 ? '#DC2626' : 'var(--dash-text-primary)' }}>
                        {node.cpu}%
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: node.ram > 85 ? '#DC2626' : 'var(--dash-text-primary)' }}>
                        {node.ram}%
                      </span>
                    </td>
                    <td>{node.pods} Pods</td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: node.status === 'Ready' ? '#ECFDF5' : '#FFFBEB',
                          color: node.status === 'Ready' ? '#065F46' : '#92400E',
                        }}
                      >
                        {node.status === 'Ready' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        <span>{node.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
};

export default InfrastructureSection;
