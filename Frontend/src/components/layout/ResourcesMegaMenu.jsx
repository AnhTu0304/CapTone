import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
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
      title: t('megaMenu.items.docs.title'),
      description: t('megaMenu.items.docs.description'),
      icon: BookOpen,
      route: '/guide',
      isExternal: false,
    },
    {
      id: 'terms',
      title: t('megaMenu.items.terms.title'),
      description: t('megaMenu.items.terms.description'),
      icon: Scale,
      route: '/terms',
      isExternal: false,
    },
    {
      id: 'contact',
      title: t('megaMenu.items.contact.title'),
      description: t('megaMenu.items.contact.description'),
      icon: Mail,
      route: '/contact',
      isExternal: false,
    },
    {
      id: 'security',
      title: t('megaMenu.items.security.title'),
      description: t('megaMenu.items.security.description'),
      icon: ShieldCheck,
      route: '/security',
      isExternal: false,
    },
    {
      id: 'privacy',
      title: t('megaMenu.items.privacy.title'),
      description: t('megaMenu.items.privacy.description'),
      icon: Lock,
      route: '/privacy',
      isExternal: false,
    },
    {
      id: 'about',
      title: t('megaMenu.items.about.title'),
      description: t('megaMenu.items.about.description'),
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
      aria-label={t('megaMenu.ariaLabel')}
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
