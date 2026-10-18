import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  getAuditLogs,
  getAuditLogById,
  getAuditSummaryKPIs,
} from '../../services/adminAuditLogsService';

import ActorTypeBadge from '../../components/admin/audit-logs/ActorTypeBadge';
import AuditStatusBadge from '../../components/admin/audit-logs/AuditStatusBadge';
import AuditLogsFilters from '../../components/admin/audit-logs/AuditLogsFilters';
import AuditLogsTable from '../../components/admin/audit-logs/AuditLogsTable';
import AuditDetailDrawer from '../../components/admin/audit-logs/AuditDetailDrawer';
import AdminAuditLogsPage from './AuditLogs/AdminAuditLogsPage';

describe('Platform Admin Audit Logs Module', () => {
  describe('Service Layer Data Contracts', () => {
    test('getAuditLogs returns paginated logs with all 9 required fields and details', async () => {
      const res = await getAuditLogs();
      expect(res.data.length).toBeGreaterThan(0);
      const log = res.data[0];

      // 1. Timestamp
      expect(log).toHaveProperty('timestamp');
      // 2. Actor
      expect(log).toHaveProperty('actor');
      // 3. Actor Type
      expect(log).toHaveProperty('actorType');
      // 4. Action
      expect(log).toHaveProperty('action');
      // 5. Resource Type
      expect(log).toHaveProperty('resourceType');
      // 6. Resource ID
      expect(log).toHaveProperty('resourceId');
      // 7. Organization
      expect(log).toHaveProperty('organization');
      // 8. Status
      expect(log).toHaveProperty('status');
      // 9. IP Address
      expect(log).toHaveProperty('ipAddress');

      // Detail fields
      expect(log).toHaveProperty('description');
      expect(log).toHaveProperty('beforeData');
      expect(log).toHaveProperty('afterData');
      expect(log).toHaveProperty('metadata');
      expect(log.metadata).toHaveProperty('sha256');
    });

    test('getAuditLogById returns single record by id', async () => {
      const log = await getAuditLogById('AUD-2026-9048');
      expect(log).toBeDefined();
      expect(log.id).toBe('AUD-2026-9048');
      expect(log.action).toBe('HITL_APPROVAL_GRANTED');
    });

    test('getAuditSummaryKPIs returns security and audit summary KPIs', async () => {
      const kpis = await getAuditSummaryKPIs();
      expect(kpis).toHaveProperty('totalLogs');
      expect(kpis).toHaveProperty('verifiedIntegrity');
      expect(kpis).toHaveProperty('blockedViolations');
      expect(kpis).toHaveProperty('autonomousActions');
      expect(kpis).toHaveProperty('activeActorsCount');
    });
  });

  describe('UI Component Rendering', () => {
    test('ActorTypeBadge and AuditStatusBadge render corresponding labels', () => {
      const { rerender } = render(<ActorTypeBadge actorType="SYSTEM_AI" />);
      expect(screen.getByText('SYSTEM_AI')).toBeInTheDocument();

      rerender(<ActorTypeBadge actorType="USER" />);
      expect(screen.getByText('USER')).toBeInTheDocument();

      rerender(<ActorTypeBadge actorType="EBPF_AGENT" />);
      expect(screen.getByText('EBPF_AGENT')).toBeInTheDocument();

      rerender(<ActorTypeBadge actorType="API_KEY" />);
      expect(screen.getByText('API_KEY')).toBeInTheDocument();

      rerender(<AuditStatusBadge status="SUCCESS" />);
      expect(screen.getByText('Thành công')).toBeInTheDocument();

      rerender(<AuditStatusBadge status="BLOCKED" />);
      expect(screen.getByText(/Bị chặn/i)).toBeInTheDocument();

      rerender(<AuditStatusBadge status="FAILED" />);
      expect(screen.getByText('Thất bại')).toBeInTheDocument();
    });

    test('AuditLogsTable renders all 9 enterprise columns and handles sorting and pagination', () => {
      const mockLogs = [
        {
          id: 'AUD-TEST-1',
          timestamp: '30/09/2026 16:00:00',
          actor: 'Lê Minh Quân',
          actorType: 'USER',
          action: 'HITL_APPROVAL_GRANTED',
          resourceType: 'Deployment',
          resourceId: 'Deployment/order-processor',
          organization: 'FinTech Global',
          status: 'SUCCESS',
          ipAddress: '113.161.72.45',
        },
      ];

      const mockSortChange = jest.fn();
      const mockSelectLog = jest.fn();

      render(
        <AuditLogsTable
          logs={mockLogs}
          total={1}
          page={1}
          pageSize={10}
          onSortChange={mockSortChange}
          onSelectLog={mockSelectLog}
        />
      );

      // Check all 9 columns
      expect(screen.getByText(/Thời Gian \(Timestamp\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tác Nhân \(Actor\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Loại Tác Nhân \(Actor Type\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Hành Động \(Action\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Loại Tài Nguyên \(Resource Type\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Định Danh \(Resource ID\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tổ Chức \(Organization\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Trạng Thái \(Status\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Địa Chỉ IP \(IP Address\)/i)).toBeInTheDocument();

      // Check data row
      expect(screen.getByText('30/09/2026 16:00:00')).toBeInTheDocument();
      expect(screen.getByText('Lê Minh Quân')).toBeInTheDocument();
      expect(screen.getByText('HITL_APPROVAL_GRANTED')).toBeInTheDocument();
      expect(screen.getByText('Deployment/order-processor')).toBeInTheDocument();
      expect(screen.getByText('FinTech Global')).toBeInTheDocument();
      expect(screen.getByText('113.161.72.45')).toBeInTheDocument();

      // Click on row to trigger onSelectLog
      fireEvent.click(screen.getByText('Lê Minh Quân'));
      expect(mockSelectLog).toHaveBeenCalledWith(mockLogs[0]);

      // Click on timestamp header to sort
      fireEvent.click(screen.getByText(/Thời Gian \(Timestamp\)/i));
      expect(mockSortChange).toHaveBeenCalled();
    });

    test('AuditLogsFilters renders search input, 7 filters, and active filter chips', () => {
      const mockFilterChange = jest.fn();
      const mockReset = jest.fn();
      const mockRemoveChip = jest.fn();

      const activeFilters = {
        search: 'order-processor',
        dateRange: '24H',
        actor: '',
        actorType: 'SYSTEM_AI',
        action: 'K8S_LIMIT_PATCH',
        resourceType: 'Deployment',
        organization: 'Retail Corp',
        status: 'SUCCESS',
      };

      render(
        <AuditLogsFilters
          filters={activeFilters}
          onFilterChange={mockFilterChange}
          onResetFilters={mockReset}
          onRemoveFilterChip={mockRemoveChip}
        />
      );

      // Check search & dropdowns presence
      expect(screen.getByPlaceholderText(/Tìm theo tác nhân, hành động/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc theo khoảng thời gian/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc theo loại tác nhân/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc theo hành động/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc theo loại tài nguyên/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc theo tổ chức/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lọc theo trạng thái/i)).toBeInTheDocument();

      // Check filter chips
      expect(screen.getByText(/Từ khóa: "order-processor"/i)).toBeInTheDocument();
      expect(screen.getByText(/Thời gian: 24 giờ qua/i)).toBeInTheDocument();
      expect(screen.getByText(/Loại tác nhân: SYSTEM_AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Tổ chức: Retail Corp/i)).toBeInTheDocument();

      // Test chip removal
      const removeChipBtn = screen.getByLabelText(/Xóa bộ lọc search/i);
      fireEvent.click(removeChipBtn);
      expect(mockRemoveChip).toHaveBeenCalledWith('search');

      // Test clear all
      const clearAllBtn = screen.getByText('Xóa tất cả');
      fireEvent.click(clearAllBtn);
      expect(mockReset).toHaveBeenCalled();
    });

    test('AuditDetailDrawer displays description, before/after data, metadata, and no edit buttons', () => {
      const mockLog = {
        id: 'AUD-TEST-99',
        timestamp: '30/09/2026 15:30:00',
        actor: 'Lê Minh Quân',
        actorType: 'USER',
        action: 'K8S_LIMIT_PATCH',
        resourceType: 'Deployment',
        resourceId: 'Deployment/order-processor',
        organization: 'FinTech Global',
        status: 'SUCCESS',
        ipAddress: '113.161.72.45',
        description: 'Vá giới hạn bộ nhớ Pod sau tín hiệu cảnh báo rò rỉ RAM.',
        beforeData: { limits: { memory: '2048Mi' } },
        afterData: { limits: { memory: '3072Mi' } },
        metadata: {
          sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          correlationId: 'INC-2026-8812',
          executionLatency: '142ms',
          sessionId: 'sess-test-01',
          userAgent: 'Mozilla/5.0 Chrome/128.0',
        },
      };

      const mockClose = jest.fn();

      render(<AuditDetailDrawer log={mockLog} onClose={mockClose} />);

      // Header & ID
      expect(screen.getByText('AUD-TEST-99')).toBeInTheDocument();

      // Security immutability notice
      expect(screen.getByText(/Bản Ghi Bất Biến \(Cryptographically Sealed SHA-256\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Hệ thống ghi nhận theo cơ chế Append-Only/i)).toBeInTheDocument();

      // 1. Description
      expect(screen.getByText(/Diễn Giải Hành Động \(Description\)/i)).toBeInTheDocument();
      expect(screen.getByText('Vá giới hạn bộ nhớ Pod sau tín hiệu cảnh báo rò rỉ RAM.')).toBeInTheDocument();

      // 2. Before & After Data
      expect(screen.getByText(/TRẠNG THÁI TRƯỚC \(BEFORE DATA\)/i)).toBeInTheDocument();
      expect(screen.getByText(/2048Mi/i)).toBeInTheDocument();
      expect(screen.getByText(/TRẠNG THÁI SAU \(AFTER DATA\)/i)).toBeInTheDocument();
      expect(screen.getByText(/3072Mi/i)).toBeInTheDocument();

      // 3. Metadata & SHA-256
      expect(screen.getByText('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')).toBeInTheDocument();
      expect(screen.getByText('INC-2026-8812')).toBeInTheDocument();
      expect(screen.getByText('142ms')).toBeInTheDocument();

      // Verify no Edit / Delete / Modify buttons exist anywhere
      expect(screen.queryByRole('button', { name: /Chỉnh sửa|Edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Xóa|Delete/i })).not.toBeInTheDocument();

      // Close drawer
      const closeBtn = screen.getByLabelText('Đóng ngăn kéo chi tiết kiểm toán');
      fireEvent.click(closeBtn);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    test('AdminAuditLogsPage loads data, displays summary KPIs, and opens drawer on row click', async () => {
      render(<AdminAuditLogsPage />);

      // Await data loading
      await waitFor(() => {
        expect(screen.getByText(/TỔNG BẢN GHI KIỂM TOÁN/i)).toBeInTheDocument();
      });

      // KPIs
      expect(screen.getByText(/TÍNH TOÀN VẸN MẬT MÃ/i)).toBeInTheDocument();
      expect(screen.getByText(/HÀNH VI BỊ CHẶN/i)).toBeInTheDocument();
      expect(screen.getByText(/CAN THIỆP TỰ ĐỘNG AI/i)).toBeInTheDocument();

      // Row click opens drawer
      const logRowText = await screen.findByText('AUD-2026-9048');
      fireEvent.click(logRowText);

      // Verify drawer opens
      expect(screen.getByText(/Diễn Giải Hành Động \(Description\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Phê duyệt cấp phép khẩn cấp nâng ngưỡng giới hạn RAM/i)).toBeInTheDocument();
    });
  });
});
