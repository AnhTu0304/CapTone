import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { normalizeLanguage } from '../../i18n';

/**
 * LanguageSwitcherCompact
 * Nút chuyển đổi ngôn ngữ VI / EN gọn nhẹ dùng chung cho PersonalHeader (Portal) và TopHeader (Dashboard).
 */
export const LanguageSwitcherCompact = ({ height = '34px' }) => {
  const { t, i18n } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const currentLangCode = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const currentLabel = currentLangCode === 'en' ? 'EN' : 'VI';

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSelect = (lang) => {
    i18n.changeLanguage(normalizeLanguage(lang));
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        data-testid="compact-lang-switcher"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('header.ariaLangSwitcher')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        style={{
          height,
          padding: '0 9px',
          borderRadius: '10px',
          border: isOpen ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.9)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          color: '#0F172A',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: isOpen ? '0 4px 12px rgba(16, 185, 129, 0.14)' : '0 2px 6px rgba(15, 23, 42, 0.04)',
          transition: 'all 0.15s ease',
        }}
      >
        <Globe size={14} color="#059669" />
        <span>{currentLabel}</span>
        <ChevronDown size={11} style={{ opacity: 0.7 }} />
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '148px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
            padding: '4px',
            zIndex: 80,
          }}
        >
          {[
            { code: 'vi', label: t('header.lang.viName', 'Tiếng Việt') },
            { code: 'en', label: t('header.lang.enName', 'English') },
          ].map((opt) => {
            const active = currentLangCode === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                role="menuitem"
                data-testid={`compact-lang-option-${opt.code}`}
                onClick={() => handleSelect(opt.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: active ? '#ECFDF5' : 'transparent',
                  color: active ? '#047857' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>{opt.label}</span>
                {active && <Check size={13} color="#059669" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcherCompact;
