import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrganizationsListPage from './Organizations/OrganizationsListPage';
import OrganizationDetailsPage from './Organizations/OrganizationDetailsPage';
import OrganizationStatusBadge from '../../components/admin/organizations/OrganizationStatusBadge';
import OrganizationMembers from '../../components/admin/organizations/OrganizationMembers';
import {
  getOrganizations,
  getOrganization,
  getOrganizationMembers,
  getOrganizationEnvironments,
  getOrganizationClusters,
  getOrganizationAgents,
  getOrganizationIncidents,
  getOrganizationAuditActivity,
} from '../../services/adminOrganizationsService';

describe('Platform Admin Organizations Service & Components', () => {
  describe('Service Layer Data Contracts', () => {
    test('getOrganizations returns valid list of tenant organizations', async () => {
      const orgs = await getOrganizations();
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.length).toBeGreaterThan(0);
      const first = orgs[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('plan');
      expect(first).toHaveProperty('status');
      expect(first).toHaveProperty('clustersCount');
    });

    test('getOrganization returns single organization by ID', async () => {
      const org = await getOrganization('org-acme-01');
      expect(org).toBeDefined();
      expect(org.id).toBe('org-acme-01');
      expect(org.name).toBe('Acme Infrastructure Corp');
    });

    test('getOrganizationMembers returns SME members with segregated scopeNote', async () => {
      const members = await getOrganizationMembers('org-acme-01');
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThan(0);
      const owner = members.find((m) => m.smeRole === 'SME Owner');
      expect(owner).toBeDefined();
      expect(owner.scopeNote).toContain('Không có quyền Platform Admin');
    });

    test('getOrganizationEnvironments returns environment clusters and autoHealingMode', async () => {
      const envs = await getOrganizationEnvironments('org-acme-01');
      expect(envs.length).toBeGreaterThan(0);
      expect(envs[0]).toHaveProperty('autoHealingMode');
    });

    test('getOrganizationClusters returns cluster details with latency', async () => {
      const clusters = await getOrganizationClusters('org-acme-01');
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters[0]).toHaveProperty('agentLatency');
    });

    test('getOrganizationAgents returns eBPF sensor heartbeats', async () => {
      const agents = await getOrganizationAgents('org-acme-01');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toHaveProperty('kernel');
    });

    test('getOrganizationIncidents returns tenant incidents with MTTR', async () => {
      const incidents = await getOrganizationIncidents('org-acme-01');
      expect(incidents.length).toBeGreaterThan(0);
      expect(incidents[0]).toHaveProperty('mttr');
    });

    test('getOrganizationAuditActivity returns admin audit items with SHA-256 hash', async () => {
      const audits = await getOrganizationAuditActivity('org-acme-01');
      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0]).toHaveProperty('hash');
    });
  });

  describe('OrganizationStatusBadge', () => {
    test('renders correct badge for ACTIVE status', () => {
      render(<OrganizationStatusBadge status="ACTIVE" />);
      expect(screen.getByText(/Hoạt Động/i)).toBeInTheDocument();
    });

    test('renders correct badge for TRIAL status', () => {
      render(<OrganizationStatusBadge status="TRIAL" />);
      expect(screen.getByText(/Dùng Thử/i)).toBeInTheDocument();
    });

    test('renders correct badge for SUSPENDED status', () => {
      render(<OrganizationStatusBadge status="SUSPENDED" />);
      expect(screen.getByText(/Tạm Dừng/i)).toBeInTheDocument();
    });
  });

  describe('OrganizationMembers - SME Role Segregation', () => {
    test('displays clear notice that SME roles have no Platform Admin permissions', () => {
      const mockMembers = [
        {
          id: 'user-1',
          name: 'Nguyễn Văn A',
          email: 'a@example.com',
          smeRole: 'SME Owner',
          scopeNote: 'Toàn quyền cấu hình cụm K8s nội bộ Acme',
          lastActive: '5 phút trước',
          twoFactorEnabled: true,
          status: 'ACTIVE',
        },
      ];

      render(<OrganizationMembers members={mockMembers} isLoading={false} />);
      expect(
        screen.getByText(/không có quyền hạn cấp Quản Trị Hệ Thống \(Platform Super Admin\)/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
      expect(screen.getByText('SME Owner')).toBeInTheDocument();
    });
  });

  describe('OrganizationsListPage', () => {
    test('renders page title, summary cards, and organization table', async () => {
      const mockNavigate = jest.fn();
      render(<OrganizationsListPage onNavigate={mockNavigate} />);

      expect(screen.getByText(/Quản Lý Tổ Chức & Doanh Nghiệp \(Tenants\)/i)).toBeInTheDocument();
      expect(screen.getByText(/TỔNG SỐ TỔ CHỨC/i)).toBeInTheDocument();

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('Acme Infrastructure Corp')).toBeInTheDocument();
      });

      expect(screen.getByText('Fintech Payments Group')).toBeInTheDocument();
    });

    test('triggers onNavigate when clicking on an organization', async () => {
      const mockNavigate = jest.fn();
      render(<OrganizationsListPage onNavigate={mockNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Infrastructure Corp')).toBeInTheDocument();
      });

      const acmeLink = screen.getByText('Acme Infrastructure Corp');
      fireEvent.click(acmeLink);

      expect(mockNavigate).toHaveBeenCalledWith('/admin/organizations/org-acme-01');
    });

    test('filters organizations based on search query', async () => {
      render(<OrganizationsListPage onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Acme Infrastructure Corp')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Tìm theo tên tổ chức/i);
      fireEvent.change(searchInput, { target: { value: 'Fintech' } });

      await waitFor(() => {
        expect(screen.getByText('Fintech Payments Group')).toBeInTheDocument();
        expect(screen.queryByText('Acme Infrastructure Corp')).not.toBeInTheDocument();
      });
    });
  });

  describe('OrganizationDetailsPage', () => {
    test('renders organization details, tabs, and switches views', async () => {
      const mockNavigate = jest.fn();
      render(<OrganizationDetailsPage orgId="org-acme-01" onNavigate={mockNavigate} />);

      // Wait for data load
      await waitFor(() => {
        expect(screen.getByText('Acme Infrastructure Corp')).toBeInTheDocument();
      });

      // Check SME notice exists after data finishes loading
      await waitFor(() => {
        expect(
          screen.getByText(/không có quyền hạn cấp Quản Trị Hệ Thống/i)
        ).toBeInTheDocument();
      });

      // Check tabs
      const membersTab = screen.getByText(/Nhân Sự SME/i);
      expect(membersTab).toBeInTheDocument();

      fireEvent.click(membersTab);

      // Verify members content remains visible
      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
      });

      // Click clusters tab
      const clustersTab = screen.getByText(/Cụm K8s/i);
      fireEvent.click(clustersTab);

      await waitFor(() => {
        expect(screen.getByText(/Cụm Kubernetes Đã Đăng Ký/i)).toBeInTheDocument();
      });
    });

    test('toggles tenant active/suspended status via admin action', async () => {
      render(<OrganizationDetailsPage orgId="org-acme-01" onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Tạm Dừng Hoạt Động Tenant')).toBeInTheDocument();
      });

      const toggleButton = screen.getByText('Tạm Dừng Hoạt Động Tenant');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Kích Hoạt Hoạt Động Tenant')).toBeInTheDocument();
      });
    });

    test('renders not found state when given non-existent orgId', async () => {
      render(<OrganizationDetailsPage orgId="non-existent-id" onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Không Tìm Thấy Tổ Chức')).toBeInTheDocument();
      });
    });
  });
});
