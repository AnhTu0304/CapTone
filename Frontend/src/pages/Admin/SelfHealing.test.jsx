import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  getHealingActions,
  getActionTypes,
  getPolicies,
  updatePolicyConfig,
  togglePolicyActive,
  getSelfHealingAnalytics,
} from '../../services/adminSelfHealingService';

import RiskBadge from '../../components/admin/self-healing/RiskBadge';
import ExecutionModeBadge from '../../components/admin/self-healing/ExecutionModeBadge';
import {
  ApprovalStatusBadge,
  ExecutionStatusBadge,
} from '../../components/admin/self-healing/ActionStatusBadge';
import SelfHealingFilters from '../../components/admin/self-healing/SelfHealingFilters';
import HealingActionsTable from '../../components/admin/self-healing/HealingActionsTable';
import ActionTypesCatalog from '../../components/admin/self-healing/ActionTypesCatalog';
import PoliciesTable from '../../components/admin/self-healing/PoliciesTable';
import PolicyConfigModal from '../../components/admin/self-healing/PolicyConfigModal';
import SelfHealingAnalytics from '../../components/admin/self-healing/SelfHealingAnalytics';
import AdminSelfHealingPage from './SelfHealing/AdminSelfHealingPage';

describe('Platform Admin Self-Healing Module', () => {
  describe('Service Layer Data Contracts', () => {
    test('getHealingActions returns actions with all 14 required fields', async () => {
      const actions = await getHealingActions();
      expect(actions.length).toBeGreaterThan(0);
      const action = actions[0];

      // 1. action type
      expect(action).toHaveProperty('actionType');
      // 2. target
      expect(action).toHaveProperty('target');
      // 3. organization
      expect(action).toHaveProperty('organization');
      // 4. environment
      expect(action).toHaveProperty('environment');
      // 5. risk level
      expect(action).toHaveProperty('riskLevel');
      // 6. execution mode
      expect(action).toHaveProperty('executionMode');
      // 7. approval status
      expect(action).toHaveProperty('approvalStatus');
      // 8. execution status
      expect(action).toHaveProperty('executionStatus');
      // 9. requested by
      expect(action).toHaveProperty('requestedBy');
      // 10. executed by
      expect(action).toHaveProperty('executedBy');
      // 11. requested time
      expect(action).toHaveProperty('requestedTime');
      // 12. started time
      expect(action).toHaveProperty('startedTime');
      // 13. completed time
      expect(action).toHaveProperty('completedTime');
      // 14. result
      expect(action).toHaveProperty('result');
    });

    test('getHealingActions filters by search, risk, mode, and status', async () => {
      const filtered = await getHealingActions({
        riskLevel: 'HIGH',
        executionMode: 'HITL_GATE',
      });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((a) => a.riskLevel === 'HIGH')).toBe(true);
      expect(filtered.every((a) => a.executionMode === 'HITL_GATE')).toBe(true);
    });

    test('getActionTypes returns standardized library of action types', async () => {
      const types = await getActionTypes();
      expect(types.length).toBeGreaterThan(0);
      const first = types[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('defaultRiskLevel');
      expect(first).toHaveProperty('targetResourceType');
      expect(first).toHaveProperty('defaultApprovalRequired');
      expect(first).toHaveProperty('supportsRollback');
      expect(first).toHaveProperty('description');
    });

    test('getPolicies returns policies with all 9 required fields', async () => {
      const policies = await getPolicies();
      expect(policies.length).toBeGreaterThan(0);
      const pol = policies[0];

      // 1. name
      expect(pol).toHaveProperty('name');
      // 2. trigger type
      expect(pol).toHaveProperty('triggerType');
      // 3. risk type
      expect(pol).toHaveProperty('riskType');
      // 4. execution mode
      expect(pol).toHaveProperty('executionMode');
      // 5. confidence threshold
      expect(pol).toHaveProperty('confidenceThreshold');
      // 6. cooldown
      expect(pol).toHaveProperty('cooldown');
      // 7. max retries
      expect(pol).toHaveProperty('maxRetries');
      // 8. approval requirement
      expect(pol).toHaveProperty('approvalRequirement');
      // 9. active status
      expect(pol).toHaveProperty('activeStatus');
      expect(typeof pol.activeStatus).toBe('boolean');
    });

    test('updatePolicyConfig modifies parameters without arbitrary execution', async () => {
      const updated = await updatePolicyConfig('POL-001', {
        confidenceThreshold: 97,
        cooldown: '30m',
        maxRetries: 4,
      });
      expect(updated.confidenceThreshold).toBe(97);
      expect(updated.cooldown).toBe('30m');
      expect(updated.maxRetries).toBe(4);
    });

    test('togglePolicyActive inverts activeStatus', async () => {
      const policies = await getPolicies();
      const initialStatus = policies.find((p) => p.id === 'POL-001').activeStatus;
      const toggled = await togglePolicyActive('POL-001');
      expect(toggled.activeStatus).toBe(!initialStatus);
    });

    test('getSelfHealingAnalytics returns all 6 required analytics metrics', async () => {
      const analytics = await getSelfHealingAnalytics();

      // 1. total actions
      expect(analytics).toHaveProperty('totalActions');
      expect(typeof analytics.totalActions).toBe('number');
      // 2. success rate
      expect(analytics).toHaveProperty('successRate');
      // 3. failed actions
      expect(analytics).toHaveProperty('failedActions');
      expect(typeof analytics.failedActions).toBe('number');
      // 4. average recovery time
      expect(analytics).toHaveProperty('averageRecoveryTime');
      // 5. retry count
      expect(analytics).toHaveProperty('retryCount');
      expect(typeof analytics.retryCount).toBe('number');
      // 6. action type distribution
      expect(analytics).toHaveProperty('actionTypeDistribution');
      expect(Array.isArray(analytics.actionTypeDistribution)).toBe(true);
      expect(analytics.actionTypeDistribution.length).toBeGreaterThan(0);
      expect(analytics.actionTypeDistribution[0]).toHaveProperty('type');
      expect(analytics.actionTypeDistribution[0]).toHaveProperty('percentage');
    });
  });

  describe('Component Tests', () => {
    test('RiskBadge renders correct labels for each level', () => {
      const { rerender } = render(<RiskBadge riskLevel="CRITICAL" />);
      expect(screen.getByText(/Nguy Cấp \(Critical\)/i)).toBeInTheDocument();

      rerender(<RiskBadge riskLevel="HIGH" />);
      expect(screen.getByText(/Cao \(High\)/i)).toBeInTheDocument();

      rerender(<RiskBadge riskLevel="MEDIUM" />);
      expect(screen.getByText(/Trung Bình \(Medium\)/i)).toBeInTheDocument();

      rerender(<RiskBadge riskLevel="LOW" />);
      expect(screen.getByText(/Thấp \(Low\)/i)).toBeInTheDocument();
    });

    test('ExecutionModeBadge renders correct text', () => {
      const { rerender } = render(<ExecutionModeBadge mode="AUTONOMOUS" />);
      expect(screen.getByText(/Tự Trị AI \(Autonomous\)/i)).toBeInTheDocument();

      rerender(<ExecutionModeBadge mode="HITL_GATE" />);
      expect(screen.getByText(/Cổng Duyệt HITL/i)).toBeInTheDocument();

      rerender(<ExecutionModeBadge mode="MANUAL" />);
      expect(screen.getByText(/Thủ Công \(Manual\)/i)).toBeInTheDocument();
    });

    test('ActionStatusBadges render approval and execution statuses', () => {
      const { rerender } = render(<ApprovalStatusBadge status="APPROVED" />);
      expect(screen.getByText(/Đã Phê Duyệt/i)).toBeInTheDocument();

      rerender(<ApprovalStatusBadge status="AWAITING_APPROVAL" />);
      expect(screen.getByText(/Chờ Duyệt HITL/i)).toBeInTheDocument();

      rerender(<ExecutionStatusBadge status="SUCCEEDED" />);
      expect(screen.getByText(/Thành Công/i)).toBeInTheDocument();

      rerender(<ExecutionStatusBadge status="ROLLED_BACK" />);
      expect(screen.getByText(/Đã Hoàn Nguyên/i)).toBeInTheDocument();
    });

    test('SelfHealingFilters triggers callbacks on input changes', () => {
      const handleSearch = jest.fn();
      const handleRisk = jest.fn();
      const handleMode = jest.fn();
      const handleStatus = jest.fn();
      const handleReset = jest.fn();

      render(
        <SelfHealingFilters
          search=""
          onSearchChange={handleSearch}
          riskLevel="ALL"
          onRiskLevelChange={handleRisk}
          executionMode="ALL"
          onExecutionModeChange={handleMode}
          executionStatus="ALL"
          onExecutionStatusChange={handleStatus}
          onReset={handleReset}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Tìm hành động, tài nguyên K8s, tổ chức.../i);
      fireEvent.change(searchInput, { target: { value: 'order-processor' } });
      expect(handleSearch).toHaveBeenCalledWith('order-processor');

      const riskSelect = screen.getByLabelText(/Lọc theo mức độ rủi ro/i);
      fireEvent.change(riskSelect, { target: { value: 'HIGH' } });
      expect(handleRisk).toHaveBeenCalledWith('HIGH');

      const modeSelect = screen.getByLabelText(/Lọc theo chế độ thực thi/i);
      fireEvent.change(modeSelect, { target: { value: 'HITL_GATE' } });
      expect(handleMode).toHaveBeenCalledWith('HITL_GATE');

      const resetBtn = screen.getByLabelText(/Đặt lại bộ lọc/i);
      fireEvent.click(resetBtn);
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    test('HealingActionsTable renders all 14 headers and enforces NO approval bypass', async () => {
      const actions = await getHealingActions();
      const handleNavigateApprovals = jest.fn();

      render(
        <HealingActionsTable
          actions={actions}
          onNavigateToApprovals={handleNavigateApprovals}
        />
      );

      // Verify all 14 headers
      expect(screen.getByText(/Loại Hành Động \(Action Type\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tài Nguyên Đích \(Target\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tổ Chức \(Organization\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Môi Trường \(Environment\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Mức Rủi Ro \(Risk Level\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Chế Độ \(Execution Mode\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Phê Duyệt \(Approval Status\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Thực Thi \(Execution Status\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Yêu Cầu Bởi \(Requested By\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Thực Thi Bởi \(Executed By\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Thời Gian Yêu Cầu \(Requested Time\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Bắt Đầu \(Started Time\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Hoàn Tất \(Completed Time\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Kết Quả \(Result\)/i)).toBeInTheDocument();

      // Verify Strict Security Policy notice
      expect(screen.getByText(/Tuyệt đối không cho phép bỏ qua \(bypass\) quy trình phê duyệt HITL/i)).toBeInTheDocument();

      // Verify NO bypass or force execute button exists
      expect(screen.queryByRole('button', { name: /Bỏ qua duyệt/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Force Execute/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Thực thi cưỡng bức/i })).not.toBeInTheDocument();

      // Navigation to approval gate button
      const toGateBtn = screen.getByRole('button', { name: /Đến Cổng Phê Duyệt HITL/i });
      fireEvent.click(toGateBtn);
      expect(handleNavigateApprovals).toHaveBeenCalledTimes(1);
    });

    test('ActionTypesCatalog displays catalog items and rollback support', async () => {
      const types = await getActionTypes();
      render(<ActionTypesCatalog actionTypes={types} />);

      expect(screen.getByText('K8s Resource Limit Patch (RAM/CPU)')).toBeInTheDocument();
      expect(screen.getByText('Zero-Downtime Rolling Restart')).toBeInTheDocument();
      expect(screen.getByText('Node Cordon & Safe Drain')).toBeInTheDocument();
      expect(screen.getAllByText(/Có hỗ trợ/i).length).toBeGreaterThan(0);
    });

    test('PoliciesTable renders all 9 policy fields and manages configuration modal', async () => {
      const policies = await getPolicies();
      const handleToggle = jest.fn();
      const handleUpdate = jest.fn();

      render(
        <PoliciesTable
          policies={policies}
          onToggleActive={handleToggle}
          onUpdateConfig={handleUpdate}
        />
      );

      // Verify 9 headers
      expect(screen.getByText(/Tên Chính Sách \(Name\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tín Hiệu Kích Hoạt \(Trigger Type\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Phân Loại Rủi Ro \(Risk Type\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Chế Độ Thực Thi \(Execution Mode\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Ngưỡng Tin Cậy \(Confidence\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Hạ Nhiệt \(Cooldown\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Thử Lại \(Max Retries\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Quy Định Phê Duyệt \(Approval Req\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Trạng Thái \(Active\)/i)).toBeInTheDocument();

      // Test active toggle button
      const toggleButtons = screen.getAllByRole('button', { name: /Chuyển trạng thái chính sách/i });
      fireEvent.click(toggleButtons[0]);
      expect(handleToggle).toHaveBeenCalledWith('POL-001');

      // Test open config modal
      const configButtons = screen.getAllByRole('button', { name: /Cấu hình chính sách/i });
      fireEvent.click(configButtons[0]);

      // Check modal is open
      expect(screen.getByText('Cấu Hình Chính Sách Tự Lành')).toBeInTheDocument();
      expect(screen.getByLabelText(/Ngưỡng Tin Cậy AI Tối Thiểu/i)).toBeInTheDocument();

      // Submit modal
      const saveBtn = screen.getByRole('button', { name: /Lưu Cấu Hình/i });
      fireEvent.click(saveBtn);
      expect(handleUpdate).toHaveBeenCalledWith('POL-001', expect.any(Object));
    });

    test('SelfHealingAnalytics displays all 6 required metrics and progress bars', async () => {
      const analytics = await getSelfHealingAnalytics();
      render(<SelfHealingAnalytics analytics={analytics} />);

      expect(screen.getByText(/TỔNG SỐ HÀNH ĐỘNG/i)).toBeInTheDocument();
      expect(screen.getByText('248')).toBeInTheDocument();
      expect(screen.getByText(/TỶ LỆ THÀNH CÔNG/i)).toBeInTheDocument();
      expect(screen.getByText('96.4%')).toBeInTheDocument();
      expect(screen.getByText(/HÀNH ĐỘNG THẤT BẠI/i)).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.getByText(/THỜI GIAN PHỤC HỒI TRUNG BÌNH/i)).toBeInTheDocument();
      expect(screen.getByText('1m 24s')).toBeInTheDocument();
      expect(screen.getByText(/SỐ LẦN THỬ LẠI/i)).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText(/Phân Bổ Hành Động Tự Phục Hồi Theo Loại/i)).toBeInTheDocument();
    });
  });

  describe('Page Level Integration', () => {
    test('AdminSelfHealingPage renders actions section by default and supports tab navigation', async () => {
      const handleNavigate = jest.fn();
      render(<AdminSelfHealingPage currentSection="actions" onNavigate={handleNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('ACT-2026-901')).toBeInTheDocument();
      });

      expect(screen.getByText('Nhật Ký Hành Động Tự Phục Hồi (Self-Healing Actions)')).toBeInTheDocument();
      expect(screen.getByText('K8s Resource Limit Patch (RAM)')).toBeInTheDocument();

      // Click sub-navigation tabs
      const policyTab = screen.getByRole('button', { name: /Chính Sách Tự Lành/i });
      fireEvent.click(policyTab);
      expect(handleNavigate).toHaveBeenCalledWith('/admin/self-healing/policies');

      const analyticsTab = screen.getByRole('button', { name: /Số Liệu Phân Tích/i });
      fireEvent.click(analyticsTab);
      expect(handleNavigate).toHaveBeenCalledWith('/admin/self-healing/analytics');
    });

    test('AdminSelfHealingPage renders policies section with active toggle', async () => {
      render(<AdminSelfHealingPage currentSection="policies" onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Tự Động Nâng Hạn Mức RAM OOM-Guard')).toBeInTheDocument();
      });

      expect(screen.getByText('POL-001')).toBeInTheDocument();
    });

    test('AdminSelfHealingPage renders analytics section', async () => {
      render(<AdminSelfHealingPage currentSection="analytics" onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('248')).toBeInTheDocument();
      });

      expect(screen.getByText('96.4%')).toBeInTheDocument();
    });
  });
});
