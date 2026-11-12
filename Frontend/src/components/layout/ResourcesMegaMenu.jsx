import React from 'react';
import { 
  BookOpen, 
  Scale, 
  Mail, 
  ShieldCheck, 
  Share2, 
  Info,
  ExternalLink
} from 'lucide-react';
import './ResourcesMegaMenu.css';

const GithubIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const LinkedinIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 0-2.9 1.45 1.45 0 0 0 0 2.9m1.4 9.74V10.13H5.06v8.37h2.8z" />
  </svg>
);

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
      socialLinks: [
        { name: 'GitHub', url: 'https://github.com/phamthaisang1710/captone', icon: GithubIcon },
        { name: 'LinkedIn', url: 'https://linkedin.com', icon: LinkedinIcon },
      ],
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
        <div className="resources-mega-menu-header">
          <span className="resources-meta-label">SELFHEAL // TÀI NGUYÊN & ĐIỀU HƯỚNG</span>
          <span className="resources-meta-tag">HỆ THỐNG K8S SẴN SÀNG</span>
        </div>

        <div className="resources-mega-menu-grid">
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                className="resources-mega-item-cell"
                style={{ '--item-stagger': `${index * 40}ms` }}
              >
                {item.isExternal ? (
                  <div className="resources-mega-item-content">
                    <a
                      href={item.route}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="resources-mega-link"
                      onClick={() => onClose()}
                    >
                      <div className="resources-item-icon-wrapper">
                        <IconComponent size={20} className="resources-item-icon" />
                      </div>
                      <div className="resources-item-text">
                        <div className="resources-item-title-row">
                          <span className="resources-item-title">{item.title}</span>
                          <ExternalLink size={12} className="resources-external-arrow" />
                        </div>
                        <p className="resources-item-desc">{item.description}</p>
                      </div>
                    </a>

                    {item.socialLinks && (
                      <div className="resources-social-badges">
                        {item.socialLinks.map((s) => {
                          const SIcon = s.icon;
                          return (
                            <a
                              key={s.name}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="resources-social-badge-btn"
                              title={s.name}
                              onClick={() => onClose()}
                            >
                              <SIcon size={13} />
                              <span>{s.name}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href={item.route}
                    onClick={(e) => handleItemClick(e, item.route)}
                    className="resources-mega-link resources-mega-item-content"
                  >
                    <div className="resources-item-icon-wrapper">
                      <IconComponent size={20} className="resources-item-icon" />
                    </div>
                    <div className="resources-item-text">
                      <div className="resources-item-title-row">
                        <span className="resources-item-title">{item.title}</span>
                      </div>
                      <p className="resources-item-desc">{item.description}</p>
                    </div>
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <div className="resources-mega-menu-footer">
          <div className="resources-footer-left">
            <span className="resources-footer-dot" />
            <span>TẤT CẢ TÀI NGUYÊN HOẠT ĐỘNG BÌNH THƯỜNG</span>
          </div>
          <div className="resources-footer-right">
            <span>DOCS VER 2.4.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourcesMegaMenu;
