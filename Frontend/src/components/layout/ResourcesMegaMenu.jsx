import React from 'react';
import {
  BookOpen,
  Scale,
  Mail,
  ShieldCheck,
  Lock,
  Info
} from 'lucide-react';
import './ResourcesMegaMenu.css';

export const ResourcesMegaMenu = ({ isOpen, onClose, onNavigate, menuRef }) => {
  if (!isOpen) return null;

  const handleItemClick = (e, path, isExternal = false) => {
    if (isExternal) return;
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    onClose();
  };

  const menuItems = [
    {
      id: 'docs',
      title: 'Tài Liệu Hướng Dẫn',
      description: 'Hướng dẫn cài đặt, cấu hình tác tử và tài liệu nền tảng.',
      icon: BookOpen,
      route: '/guide',
      isExternal: false,
    },
    {
      id: 'terms',
      title: 'Điều Khoản & Điều Kiện',
      description: 'Điều khoản sử dụng và chính sách dịch vụ nền tảng.',
      icon: Scale,
      route: '/terms',
      isExternal: false,
    },
    {
      id: 'contact',
      title: 'Liên Hệ Tư Vấn',
      description: 'Kết nối trực tiếp với đội ngũ phát triển và kỹ sư SelfHeal.',
      icon: Mail,
      route: '/contact',
      isExternal: false,
    },
    {
      id: 'security',
      title: 'Bảo Mật Hệ Thống',
      description: 'Kiến trúc an ninh đa tầng, kiểm soát truy cập và bảo vệ hạ tầng K8s.',
      icon: ShieldCheck,
      route: '/security',
      isExternal: false,
    },
    {
      id: 'privacy',
      title: 'Chính Sách Bảo Mật',
      description: 'Quy định thu thập, xử lý và bảo vệ dữ liệu cá nhân & thông tin doanh nghiệp.',
      icon: Lock,
      route: '/privacy',
      isExternal: false,
    },
    {
      id: 'about',
      title: 'Giới Thiệu SelfHeal',
      description: 'Tìm hiểu về sứ mệnh, kiến trúc tự phục hồi và đội ngũ phát triển.',
      icon: Info,
      route: '/about',
      isExternal: false,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="resources-mega-menu-overlay"
      id="resources-mega-menu"
      role="region"
      aria-label="Menu Tài nguyên SelfHeal"
    >
      <div className="resources-mega-menu-container">
        <div className="resources-mega-menu-grid">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div key={item.id} className="resources-mega-item-cell">
                {item.isExternal ? (
                  <a
                    href={item.route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="resources-mega-link"
                    onClick={() => onClose()}
                  >
                    <IconComponent size={19} strokeWidth={1.75} className="resources-item-icon" />
                    <div className="resources-item-text">
                      <span className="resources-item-title">{item.title}</span>
                      <p className="resources-item-desc">{item.description}</p>
                    </div>
                  </a>
                ) : (
                  <a
                    href={item.route}
                    className="resources-mega-link"
                    onClick={(e) => handleItemClick(e, item.route, false)}
                  >
                    <IconComponent size={19} strokeWidth={1.75} className="resources-item-icon" />
                    <div className="resources-item-text">
                      <span className="resources-item-title">{item.title}</span>
                      <p className="resources-item-desc">{item.description}</p>
                    </div>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ResourcesMegaMenu;
