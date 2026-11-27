import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import {
  DOCUMENTATION_DATA,
  FAQ_DATA,
} from '../../services/personalPortalService';

export const PersonalHelpPage = ({ onNavigate }) => {
  const { t } = useTranslation('portal');
  const [activeTab, setActiveTab] = useState('docs'); // 'docs' | 'faq'

  // Documentation state
  const [selectedDocId, setSelectedDocId] = useState(DOCUMENTATION_DATA[0].id);
  const activeDoc = DOCUMENTATION_DATA.find((d) => d.id === selectedDocId) || DOCUMENTATION_DATA[0];

  // FAQ state
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState('ALL');
  const [expandedFaqId, setExpandedFaqId] = useState('faq-1');

  // Filtered FAQs
  const filteredFaqs = FAQ_DATA.filter((f) => {
    const q = t(`help.faqsData.${f.id}.question`, { defaultValue: f.question }).toLowerCase();
    const a = t(`help.faqsData.${f.id}.answer`, { defaultValue: f.answer }).toLowerCase();
    const searchLower = faqSearch.toLowerCase();
    const matchesSearch =
      q.includes(searchLower) ||
      a.includes(searchLower) ||
      f.question.toLowerCase().includes(searchLower) ||
      f.answer.toLowerCase().includes(searchLower);
    const matchesCat = faqCategory === 'ALL' || f.category.includes(faqCategory);
    return matchesSearch && matchesCat;
  });

  const activeDocSteps = t(`help.docsData.${activeDoc.id}.steps`, {
    returnObjects: true,
    defaultValue: activeDoc.steps,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          {t('help.title')}
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          {t('help.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'docs', label: t('help.tabs.docs'), icon: BookOpen },
          { id: 'faq', label: t('help.tabs.faq'), icon: HelpCircle },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 4px',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#059669' : '#64748B',
                border: 'none',
                borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <TabIcon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DOCUMENTATION */}
      {activeTab === 'docs' && (
        <div className="portal-grid-sidebar" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Docs Sidebar / Table of Contents */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              height: 'fit-content',
            }}
          >
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                padding: '6px 8px',
                letterSpacing: '0.04em',
              }}
            >
              {t('help.docs.tocTitle')}
            </div>

            {DOCUMENTATION_DATA.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              const docTitle = t(`help.docsData.${doc.id}.title`, { defaultValue: doc.title });
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSelected ? '#F0FDF4' : 'transparent',
                    color: isSelected ? '#065F46' : '#334155',
                    fontSize: '0.8125rem',
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {docTitle}
                  </span>
                  {isSelected && <ChevronRight size={14} color="#059669" />}
                </button>
              );
            })}
          </div>

          {/* Docs Content Detail */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '28px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                }}
              >
                {t(`help.docsData.${activeDoc.id}.category`, { defaultValue: activeDoc.category })}
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '8px 0 6px 0' }}>
                {t(`help.docsData.${activeDoc.id}.title`, { defaultValue: activeDoc.title })}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                {t(`help.docsData.${activeDoc.id}.summary`, { defaultValue: activeDoc.summary })}
              </p>
            </div>

            {/* Step-by-Step Guide */}
            <div>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
                {t('help.docs.stepsTitle')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(Array.isArray(activeDocSteps) ? activeDocSteps : activeDoc.steps).map((st, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 14px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: '#1E293B', lineHeight: 1.5 }}>{st}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code snippet if any */}
            {activeDoc.codeSnippet && (
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                  {t('help.docs.commandTitle')}
                </h4>
                <pre
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#E2E8F0',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    overflowX: 'auto',
                    lineHeight: 1.5,
                  }}
                >
                  {activeDoc.codeSnippet}
                </pre>
              </div>
            )}

            {/* Troubleshooting / Tips */}
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.8125rem', color: '#92400E', display: 'block', marginBottom: '2px' }}>
                  {t('help.docs.tipsTitle')}
                </strong>
                <span style={{ fontSize: '0.8125rem', color: '#B45309', lineHeight: 1.4 }}>
                  {t(`help.docsData.${activeDoc.id}.tips`, { defaultValue: activeDoc.tips })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FAQ */}
      {activeTab === 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 'min(100%, 220px)' }}>
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder={t('help.faq.searchPlaceholder')}
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </div>

            <select
              value={faqCategory}
              onChange={(e) => setFaqCategory(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              <option value="ALL">{t('help.faq.categories.all')}</option>
              <option value="Agent">{t('help.faq.categories.agent')}</option>
              <option value="Hạ Tầng">{t('help.faq.categories.infra')}</option>
              <option value="AI">{t('help.faq.categories.ai')}</option>
              <option value="Tổ Chức">{t('help.faq.categories.org')}</option>
              <option value="Phân Quyền">{t('help.faq.categories.rbac')}</option>
            </select>
          </div>

          {/* FAQ Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;

              return (
                <div
                  key={faq.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      border: 'none',
                      background: isExpanded ? '#F8FAFC' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <HelpCircle size={18} color="#059669" />
                      <div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                          {t(`help.faqsData.${faq.id}.category`, { defaultValue: faq.category })}
                        </span>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {t(`help.faqsData.${faq.id}.question`, { defaultValue: faq.question })}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px 50px', borderTop: '1px solid #F1F5F9' }}>
                      <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, margin: '14px 0 12px 0' }}>
                        {t(`help.faqsData.${faq.id}.answer`, { defaultValue: faq.answer })}
                      </p>

                      {faq.actionPath && (
                        <button
                          type="button"
                          onClick={() => onNavigate && onNavigate(faq.actionPath)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            backgroundColor: '#F0FDF4',
                            color: '#065F46',
                            border: '1px solid #A7F3D0',
                            fontSize: '0.78125rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{t(`help.faqsData.${faq.id}.actionText`, { defaultValue: faq.actionText })}</span>
                          <ExternalLink size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalHelpPage;
