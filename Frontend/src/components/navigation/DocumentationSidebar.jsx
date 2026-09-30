import React from 'react';
import { 
  BookOpen, 
  Cpu, 
  Layers, 
  Terminal, 
  Sliders, 
  Activity, 
  Zap, 
  ShieldCheck, 
  FileCode, 
  AlertCircle,
  HardDrive
} from 'lucide-react';

export const DOCS_SECTIONS = [
  {
    category: "Bắt đầu",
    items: [
      { id: "overview", title: "Tổng quan nền tảng", icon: BookOpen },
      { id: "architecture", title: "Kiến trúc hệ thống", icon: Layers },
      { id: "k8s-agent", title: "Agent Kubernetes", icon: HardDrive },
      { id: "installation", title: "Cài đặt & Triển khai", icon: Terminal },
      { id: "configuration", title: "Cấu hình vận hành", icon: Sliders },
    ]
  },
  {
    category: "Lõi tự hành",
    items: [
      { id: "monitoring", title: "Giám sát thời gian thực", icon: Activity },
      { id: "ai-prediction", title: "Dự báo bằng AI", icon: Cpu },
      { id: "self-healing", title: "Tự phục hồi sự cố", icon: Zap },
    ]
  },
  {
    category: "Bảo mật & Vận hành",
    items: [
      { id: "rbac-security", title: "Bảo mật & Phân quyền RBAC", icon: ShieldCheck },
      { id: "api-reference", title: "Tài liệu API & CLI", icon: FileCode },
      { id: "troubleshooting", title: "Xử lý sự cố thường gặp", icon: AlertCircle },
    ]
  }
];

export const DocumentationSidebar = ({
  activeDocId = 'overview',
  onSelectDoc,
  className = '',
}) => {
  return (
    <aside
      className={`docs-sidebar ${className}`}
      style={{
        width: '260px',
        flexShrink: 0,
        paddingRight: '20px',
        borderRight: '1px solid var(--border-default)',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {DOCS_SECTIONS.map((section, sIdx) => (
          <div key={sIdx}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: '10px',
                paddingLeft: '8px',
              }}
            >
              {section.category}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {section.items.map((item) => {
                const isActive = activeDocId === item.id;
                const ItemIcon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectDoc && onSelectDoc(item.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '0px',
                        background: isActive ? 'var(--color-surface)' : 'transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                        border: 'none',
                        borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <ItemIcon size={16} color={isActive ? 'var(--color-accent)' : 'var(--text-muted)'} />
                      <span>{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default DocumentationSidebar;
