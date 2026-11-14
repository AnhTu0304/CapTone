import React, { useEffect, useState } from 'react';
import { Bookmark, Compass } from 'lucide-react';

/**
 * NotebookIndexNav
 * Sticky notebook-edge bookmark tabs that follow the user as they scroll through the guide.
 */
export const NotebookIndexNav = ({
  items = [],
  activeId = '',
  onItemClick,
  className = '',
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`notebook-sticky-nav ${className}`}
      aria-label="Mục lục sổ tay hướng dẫn"
      style={{
        position: 'sticky',
        top: '90px',
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}
    >
      {/* Notebook Index Header & Reading Progress */}
      <div className="notebook-nav-header">
        <div className="notebook-nav-badge">
          <Compass size={13} color="#28E99F" />
          <span>SỔ TAY VẬN HÀNH</span>
        </div>

        {/* Reading Progress Indicator */}
        <div className="notebook-progress-track" title={`Tiến độ đọc: ${Math.round(scrollProgress)}%`}>
          <div
            className="notebook-progress-fill"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </div>

      {/* Index Tabs Stack (Mép thẻ sổ tay dán ngoài) */}
      <div className="notebook-tabs-list">
        {items.map((item, index) => {
          const isActive = activeId === item.id;
          const numStr = String(index + 1).padStart(2, '0');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              className={`notebook-index-tab ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              title={item.title}
            >
              {/* Tab Bookmark Ribbon Accent */}
              <span className="notebook-tab-bookmark" aria-hidden="true">
                <Bookmark size={11} strokeWidth={2.5} />
              </span>

              {/* Number prefix */}
              <span className="notebook-tab-num">{numStr}</span>

              {/* Title text */}
              <span className="notebook-tab-label">
                {item.title.replace(/^\d+\s*/, '')}
              </span>

              {/* Active Pointer */}
              {isActive && <span className="notebook-tab-arrow" aria-hidden="true">&rarr;</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NotebookIndexNav;
