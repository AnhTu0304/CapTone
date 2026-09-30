import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  getIncidents,
  getIncidentById,
  getIncidentTimeline,
  getIncidentRCA,
  getIncidentHealingActions,
  getIncidentKPIs,
} from '../../services/adminIncidentsService';

import SeverityBadge from '../../components/admin/incidents/SeverityBadge';
import IncidentStatusBadge from '../../components/admin/incidents/IncidentStatusBadge';
import IncidentFilters from '../../components/admin/incidents/IncidentFilters';
import IncidentTable from '../../components/admin/incidents/IncidentTable';
import IncidentDetail from '../../components/admin/incidents/IncidentDetail';
import IncidentTimeline from '../../components/admin/incidents/IncidentTimeline';
import IncidentRCA from '../../components/admin/incidents/IncidentRCA';
import IncidentHealingActions from '../../components/admin/incidents/IncidentHealingActions';

import IncidentsListPage from './Incidents/IncidentsListPage';
import IncidentDetailPage from './Incidents/IncidentDetailPage';

describe('Platform Admin Incidents Module', () => {
  describe('Service Layer Data Contracts', () => {
    test('getIncidents returns list with all 12 required fields', async () => {
      const incidents = await getIncidents();
      expect(incidents.length).toBeGreaterThan(0);
      const inc = incidents[0];

      // 1. incident ID
      expect(inc).toHaveProperty('id');
      // 2. title
      expect(inc).toHaveProperty('title');
      // 3. severity
      expect(inc).toHaveProperty('severity');
      // 4. status
      expect(inc).toHaveProperty('status');
      // 5. organization
      expect(inc).toHaveProperty('organizationName');
      // 6. environment
      expect(inc).toHaveProperty('environment');
      // 7. cluster
      expect(inc).toHaveProperty('clusterName');
      // 8. source
      expect(inc).toHaveProperty('source');
      // 9. detected time
      expect(inc).toHaveProperty('detectedTime');
      // 10. started time
      expect(inc).toHaveProperty('startedTime');
      // 11. resolved time
      expect(inc).toHaveProperty('resolvedTime');
      // 12. recovery duration
      expect(inc).toHaveProperty('recoveryDuration');
    });

    test('getIncidentById returns specific incident', async () => {
      const inc = await getIncidentById('INC-2026-8812');
      expect(inc).not.toBeNull();
      expect(inc.id).toBe('INC-2026-8812');
      expect(inc.severity).toBe('CRITICAL');
      expect(inc.clusterName).toBe('acme-production-us-east');
    });

    test('getIncidentTimeline returns 8-stage lifecycle sequence', async () => {
      const timeline = await getIncidentTimeline('INC-2026-8812');
      expect(timeline.length).toBe(8);

      const stages = timeline.map((s) => s.stage);
      expect(stages).toEqual([
        'Detection',
        'Investigation',
        'RCA',
        'Recommendation',
        'Approval',
        'Healing',
        'Verification',
        'Resolution',
      ]);
    });

    test('getIncidentRCA returns root cause analysis details', async () => {
      const rca = await getIncidentRCA('INC-2026-8812');
      expect(rca).not.toBeNull();
      expect(rca).toHaveProperty('rootCause');
      expect(rca).toHaveProperty('causalChain');
      expect(Array.isArray(rca.causalChain)).toBe(true);
      expect(rca).toHaveProperty('signals');
      expect(rca).toHaveProperty('blastRadius');
    });

    test('getIncidentHealingActions returns plan with audit hash and safety properties', async () => {
      const actions = await getIncidentHealingActions('INC-2026-8812');
      expect(actions.length).toBeGreaterThan(0);
      const firstAction = actions[0];
      expect(firstAction).toHaveProperty('id');
      expect(firstAction).toHaveProperty('action');
      expect(firstAction).toHaveProperty('auditHash');
      expect(firstAction).toHaveProperty('state');
    });

    test('getIncidentKPIs returns aggregated metrics', async () => {
      const kpis = await getIncidentKPIs();
      expect(kpis).toHaveProperty('totalIncidents');
      expect(kpis).toHaveProperty('criticalCount');
      expect(kpis).toHaveProperty('resolvedCount');
      expect(kpis).toHaveProperty('awaitingApprovalCount');
      expect(kpis).toHaveProperty('averageMTTR');
      expect(kpis).toHaveProperty('autoHealingRate');
    });
  });

  describe('Component Tests', () => {
    test('SeverityBadge displays correct label and styling for CRITICAL', () => {
      render(<SeverityBadge severity="CRITICAL" />);
      expect(screen.getByText('Nghiêm Trọng (P1)')).toBeInTheDocument();
    });

    test('SeverityBadge displays correct label for MAJOR, MINOR, and INFO', () => {
      const { rerender } = render(<SeverityBadge severity="MAJOR" />);
      expect(screen.getByText('Đáng Kể (P2)')).toBeInTheDocument();

      rerender(<SeverityBadge severity="MINOR" />);
      expect(screen.getByText('Nhỏ (P3)')).toBeInTheDocument();

      rerender(<SeverityBadge severity="INFO" />);
      expect(screen.getByText('Thông Tin')).toBeInTheDocument();
    });

    test('IncidentStatusBadge renders Vietnamese label for statuses', () => {
      const { rerender } = render(<IncidentStatusBadge status="INVESTIGATING" />);
      expect(screen.getByText('Đang Điều Tra')).toBeInTheDocument();

      rerender(<IncidentStatusBadge status="RESOLVED" />);
      expect(screen.getByText('Đã Khắc Phục')).toBeInTheDocument();

      rerender(<IncidentStatusBadge status="AWAITING_APPROVAL" />);
      expect(screen.getByText('Chờ Duyệt HITL')).toBeInTheDocument();

      rerender(<IncidentStatusBadge status="HEALING" />);
      expect(screen.getByText('Đang Tự Phục Hồi')).toBeInTheDocument();
    });

    test('IncidentFilters triggers callbacks on search and filter change', () => {
      const handleSearch = jest.fn();
      const handleSeverity = jest.fn();
      const handleStatus = jest.fn();

      render(
        <IncidentFilters
          search=""
          onSearchChange={handleSearch}
          severity="ALL"
          onSeverityChange={handleSeverity}
          status="ALL"
          onStatusChange={handleStatus}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Tìm mã sự cố, tiêu đề, tổ chức, cụm.../i);
      fireEvent.change(searchInput, { target: { value: 'INC-2026' } });
      expect(handleSearch).toHaveBeenCalledWith('INC-2026');

      const severitySelect = screen.getByLabelText(/Lọc theo mức độ nghiêm trọng/i);
      fireEvent.change(severitySelect, { target: { value: 'CRITICAL' } });
      expect(handleSeverity).toHaveBeenCalledWith('CRITICAL');

      const statusSelect = screen.getByLabelText(/Lọc theo trạng thái xử lý/i);
      fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });
      expect(handleStatus).toHaveBeenCalledWith('RESOLVED');
    });

    test('IncidentTable renders all 12 requested fields and handles click', async () => {
      const incidents = await getIncidents();
      const handleView = jest.fn();

      render(<IncidentTable incidents={incidents} onViewIncident={handleView} />);

      // Verify all 12 requested table headers
      expect(screen.getByText(/Mã Sự Cố \(ID\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tiêu Đề \(Title\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Mức Độ \(Severity\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Trạng Thái \(Status\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tổ Chức \(Org\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Môi Trường \(Env\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Cụm K8s \(Cluster\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Nguồn \(Source\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Phát Hiện \(Detected\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Bắt Đầu \(Started\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Khắc Phục \(Resolved\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Thời Gian \(MTTR\)/i)).toBeInTheDocument();

      // Check incident row
      expect(screen.getByText('INC-2026-8812')).toBeInTheDocument();
      expect(
        screen.getByText('Sự Cố Xung Đột Bộ Nhớ OOM-Killed Dây Chuyền trên Order Processor')
      ).toBeInTheDocument();

      // Click action button
      const viewButtons = screen.getAllByRole('button', { name: /Xem chi tiết sự cố/i });
      fireEvent.click(viewButtons[0]);
      expect(handleView).toHaveBeenCalledWith(incidents[0]);
    });

    test('IncidentDetail displays header, metadata, and HITL gate banner for AWAITING_APPROVAL', async () => {
      const incident = await getIncidentById('INC-2026-8815');
      const handleBack = jest.fn();
      const handleToApprovals = jest.fn();

      render(
        <IncidentDetail
          incident={incident}
          onBack={handleBack}
          onNavigateToApprovals={handleToApprovals}
        />
      );

      expect(screen.getByText('INC-2026-8815')).toBeInTheDocument();
      expect(
        screen.getByText('Tắc Nghẽn Hàng Đợi Kafka Consumer Lag trên Cụm Thanh Toán Giao Dịch')
      ).toBeInTheDocument();
      expect(screen.getByText(/fintech-core-prod-sg/i)).toBeInTheDocument();
      expect(screen.getByText('Hành Động Cứu Hộ Đang Chờ Phê Duyệt Cổng HITL Gate')).toBeInTheDocument();

      // Navigation to approval gate
      const approvalBtn = screen.getByRole('button', { name: /Đến Cổng Phê Duyệt HITL/i });
      fireEvent.click(approvalBtn);
      expect(handleToApprovals).toHaveBeenCalledTimes(1);

      // Back button
      const backBtn = screen.getByRole('button', { name: /Quay lại danh sách sự cố/i });
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    test('IncidentTimeline renders all 8 lifecycle steps in order', async () => {
      const timeline = await getIncidentTimeline('INC-2026-8812');
      render(<IncidentTimeline timeline={timeline} />);

      // Verify the 8 stages appear in horizontal step tracker
      expect(screen.getByText('1. Detection')).toBeInTheDocument();
      expect(screen.getByText('2. Investigation')).toBeInTheDocument();
      expect(screen.getByText('3. RCA')).toBeInTheDocument();
      expect(screen.getByText('4. Recommendation')).toBeInTheDocument();
      expect(screen.getByText('5. Approval')).toBeInTheDocument();
      expect(screen.getByText('6. Healing')).toBeInTheDocument();
      expect(screen.getByText('7. Verification')).toBeInTheDocument();
      expect(screen.getByText('8. Resolution')).toBeInTheDocument();

      // Verify timeline detail feed actors
      expect(screen.getByText('eBPF DaemonSet Kernel Probe')).toBeInTheDocument();
      expect(screen.getByText('Autonomous Diagnostics Engine')).toBeInTheDocument();
    });

    test('IncidentRCA renders root cause analysis, causal chain, and telemetry', async () => {
      const rca = await getIncidentRCA('INC-2026-8812');
      render(<IncidentRCA rca={rca} />);

      expect(screen.getByText(/KẾT LUẬN NGUYÊN NHÂN CỐT LÕI \(ROOT CAUSE\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Chuỗi Quan Hệ Nhân Quả \(Causal Chain Graph\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tín Hiệu Dị Thường Thu Thập Từ Nhân Kernel/i)).toBeInTheDocument();
      expect(screen.getByText(/Phạm Vi Tác Động \(Blast Radius\)/i)).toBeInTheDocument();
      expect(screen.getByText('container_memory_working_set_bytes')).toBeInTheDocument();
      expect(screen.getByText('98.4%', { exact: false })).toBeInTheDocument();
    });

    test('IncidentHealingActions enforces security: NO direct execution and links to HITL gate', async () => {
      const actions = await getIncidentHealingActions('INC-2026-8812');
      const handleToApprovals = jest.fn();

      render(
        <IncidentHealingActions
          actions={actions}
          onNavigateToApprovals={handleToApprovals}
        />
      );

      // Verify audit hash is shown
      expect(screen.getByText(/Chữ Ký Mật Mã/i)).toBeInTheDocument();
      expect(screen.getByText('sha256:7f3a8b...19e0')).toBeInTheDocument();

      // Verify strict security banner that direct execution is forbidden
      expect(screen.getByText(/Chính Sách An Toàn & Phân Định Quyền Hạn/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Không được phép kích hoạt hay thực thi trực tiếp hành động tự phục hồi từ trang này/i)
      ).toBeInTheDocument();

      // Verify NO execution button exists
      expect(screen.queryByRole('button', { name: /Thực thi ngay/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Áp dụng thay đổi/i })).not.toBeInTheDocument();

      // Verify button to HITL Approval Gate
      const gateBtn = screen.getByRole('button', { name: /Đến Cổng Phê Duyệt HITL/i });
      expect(gateBtn).toBeInTheDocument();
      fireEvent.click(gateBtn);
      expect(handleToApprovals).toHaveBeenCalledTimes(1);
    });
  });

  describe('Page Level Integration', () => {
    test('IncidentsListPage renders KPI cards, table, and supports navigation', async () => {
      const handleNavigate = jest.fn();
      render(<IncidentsListPage onNavigate={handleNavigate} />);

      // Wait for loading to finish and table to render
      await waitFor(() => {
        expect(screen.getByText('INC-2026-8812')).toBeInTheDocument();
      });

      // KPI cards
      expect(screen.getByText('TỔNG SỐ SỰ CỐ')).toBeInTheDocument();
      expect(screen.getAllByText(/NGHIÊM TRỌNG \(P1\)/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/CHỜ DUYỆT HITL/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ĐÃ KHẮC PHỤC/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/MTTR TRUNG BÌNH/i)).toBeInTheDocument();

      // Click detail action on table
      const detailButtons = screen.getAllByRole('button', { name: /Xem chi tiết sự cố/i });
      fireEvent.click(detailButtons[0]);
      expect(handleNavigate).toHaveBeenCalledWith('/admin/incidents/INC-2026-8812');
    });

    test('IncidentDetailPage renders details, sub-tabs, and back button', async () => {
      const handleNavigate = jest.fn();
      render(<IncidentDetailPage incidentId="INC-2026-8812" onNavigate={handleNavigate} />);

      // Wait for data load
      await waitFor(() => {
        expect(
          screen.getByText('Sự Cố Xung Đột Bộ Nhớ OOM-Killed Dây Chuyền trên Order Processor')
        ).toBeInTheDocument();
      });

      // Back navigation
      const backBtn = screen.getByRole('button', { name: /Quay lại danh sách sự cố/i });
      fireEvent.click(backBtn);
      expect(handleNavigate).toHaveBeenCalledWith('/admin/incidents');

      // Check tabs
      const timelineTab = screen.getByRole('button', { name: /Chu Trình 8 Giai Đoạn/i });
      fireEvent.click(timelineTab);
      expect(screen.getByText('1. Detection')).toBeInTheDocument();

      const rcaTab = screen.getByRole('button', { name: /Chẩn Đoán Nguyên Nhân Gốc \(RCA\)/i });
      fireEvent.click(rcaTab);
      expect(screen.getByText(/KẾT LUẬN NGUYÊN NHÂN CỐT LÕI \(ROOT CAUSE\)/i)).toBeInTheDocument();

      const actionsTab = screen.getByRole('button', { name: /Kế Hoạch Tự Phục Hồi/i });
      fireEvent.click(actionsTab);
      expect(
        screen.getByText(/Không được phép kích hoạt hay thực thi trực tiếp hành động tự phục hồi từ trang này/i)
      ).toBeInTheDocument();
    });
  });
});
