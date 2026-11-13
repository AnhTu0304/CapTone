import React from 'react';
import {
  BookOpen,
  Scale,
  Mail,
  ShieldCheck,
  Share2,
  Info
} from 'lucide-react';
import './ResourcesMegaMenu.css';

export const ResourcesMegaMenu = ({ isOpen, onClose, onNavigate }) => {
  if (!isOpen) return null;

  const handleItemClick = (e, path, isExternal = false) => {
    if (isExternal) return;
    e.preventDefault();
    onClose();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const menuItems = [
    {
      id: 'docs',
      title: 'Tài Liệu Hướng Dẫn',
      description: 'Hướng dẫn cài đặt, cấu hình tác tử và tài liệu nền tảng.',
      icon: BookOpen,
      route: '/docs',
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
      id: 'privacy',
      title: 'Bảo Mật & Quyền Riêng Tư',
      description: 'Bảo vệ dữ liệu hạ tầng và an toàn thông tin doanh nghiệp.',
      icon: ShieldCheck,
      route: '/privacy',
      isExternal: false,
    },
    {
      id: 'social',
      title: 'Mạng Xã Hội & Cộng Đồng',
      description: 'Theo dõi SelfHeal và kết nối cộng đồng kỹ sư trên GitHub & LinkedIn.',
      icon: Share2,
      route: 'https://github.com/phamthaisang1710/captone',
      isExternal: true,
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
                    onClick={(e) => handleItemClick(e, item.route)}
                    className="resources-mega-link"
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
