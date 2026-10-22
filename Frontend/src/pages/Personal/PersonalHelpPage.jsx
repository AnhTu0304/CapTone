import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Send,
  Bug,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import {
  personalPortalService,
  DOCUMENTATION_DATA,
  FAQ_DATA,
} from '../../services/personalPortalService';

export const PersonalHelpPage = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('docs'); // 'docs' | 'faq' | 'ticket' | 'bug'

  // Documentation state
  const [selectedDocId, setSelectedDocId] = useState(DOCUMENTATION_DATA[0].id);
  const activeDoc = DOCUMENTATION_DATA.find((d) => d.id === selectedDocId) || DOCUMENTATION_DATA[0];

  // FAQ state
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState('ALL');
  const [expandedFaqId, setExpandedFaqId] = useState('faq-1');

  // Support Ticket state
  const [tickets, setTickets] = useState(() => personalPortalService.getTickets());
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(tickets[0]?.id || null);
  const [replyMessage, setReplyMessage] = useState('');

  // New Ticket Form
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Agent');
  const [ticketImpact, setTicketImpact] = useState('Medium');
  const [ticketCompanyId, setTicketCompanyId] = useState('org-acme-01');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState('');

  // Bug Report state
  const [bugs, setBugs] = useState(() => personalPortalService.getBugReports());
  const [bugTitle, setBugTitle] = useState('');
  const [bugType, setBugType] = useState('UI');
  const [bugExpected, setBugExpected] = useState('');
  const [bugActual, setBugActual] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [bugSuccess, setBugSuccess] = useState('');

  const companies = personalPortalService.getMyCompanies();

  // Handle create ticket
  const handleCreateTicket = (e) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDesc.trim()) return;

    const companyObj = companies.find((c) => c.id === ticketCompanyId);
    const created = personalPortalService.createTicket({
      title: ticketTitle,
      category: ticketCategory,
      impact: ticketImpact,
      companyId: ticketCompanyId,
      companyName: companyObj ? companyObj.name : 'Acme Corporation',
      description: ticketDesc,
    });

    setTickets(personalPortalService.getTickets());
    setSelectedTicketId(created.id);
    setIsTicketModalOpen(false);
    setTicketTitle('');
    setTicketDesc('');
    setTicketSuccess(`Phiếu hỗ trợ #${created.id} đã được gửi thành công! Kỹ sư SelfAI sẽ phản hồi trong 2 giờ.`);
    setTimeout(() => setTicketSuccess(''), 5000);
  };

  // Handle reply message in ticket
  const handleSendTicketReply = (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicketId) return;

    personalPortalService.addTicketMessage(selectedTicketId, replyMessage);
    setTickets(personalPortalService.getTickets());
    setReplyMessage('');
  };

  // Handle create bug
  const handleCreateBug = (e) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugActual.trim()) return;

    const created = personalPortalService.createBugReport({
      title: bugTitle,
      type: bugType,
      description: bugSteps,
      expectedBehavior: bugExpected,
      actualBehavior: bugActual,
    });

    setBugs(personalPortalService.getBugReports());
    setBugTitle('');
    setBugExpected('');
    setBugActual('');
    setBugSteps('');
    setBugSuccess(`Báo cáo lỗi #${created.id} đã được ghi nhận vào hệ thống theo dõi QA/DevOps!`);
    setTimeout(() => setBugSuccess(''), 5000);
  };

  // Filtered FAQs
  const filteredFaqs = FAQ_DATA.filter((f) => {
    const matchesSearch =
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase());
    const matchesCat = faqCategory === 'ALL' || f.category.includes(faqCategory);
    return matchesSearch && matchesCat;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
          Help & Support — Trung Tâm Trợ Giúp & Hỗ Trợ
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
          Tra cứu tài liệu quy trình, câu hỏi thường gặp hoặc gửi phiếu hỗ trợ kỹ thuật trực tiếp tới đội ngũ kỹ sư SelfAI.
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
          { id: 'docs', label: '1. Tài Liệu Hướng Dẫn', icon: BookOpen },
          { id: 'faq', label: '2. Câu Hỏi Thường Gặp (FAQ)', icon: HelpCircle },
          { id: 'ticket', label: `3. Gửi Yêu Cầu Hỗ Trợ (${tickets.length})`, icon: Send },
          { id: 'bug', label: `4. Báo Cáo Lỗi (${bugs.length})`, icon: Bug },
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
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
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
              Quy Trình Chuẩn SelfAI
            </div>

            {DOCUMENTATION_DATA.map((doc) => {
              const isSelected = doc.id === selectedDocId;
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
                    {doc.title}
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
                {activeDoc.category}
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '8px 0 6px 0' }}>
                {activeDoc.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                {activeDoc.summary}
              </p>
            </div>

            {/* Step-by-Step Guide */}
            <div>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
                Các bước thực hiện cụ thể:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeDoc.steps.map((st, idx) => (
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
                  Lệnh thực thi mẫu (Command-line):
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
                  Kinh nghiệm xử lý & Lỗi thường gặp:
                </strong>
                <span style={{ fontSize: '0.8125rem', color: '#B45309', lineHeight: 1.4 }}>
                  {activeDoc.tips}
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
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm câu hỏi (Agent, Metrics, RCA, Self-Healing, Mời thành viên)..."
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
              <option value="ALL">Tất cả danh mục câu hỏi</option>
              <option value="Agent">Agent & Kết Nối</option>
              <option value="Hạ Tầng">Hạ Tầng & Metrics</option>
              <option value="AI">AI & Tự Phục Hồi</option>
              <option value="Tổ Chức">Tổ Chức & Thành Viên</option>
              <option value="Phân Quyền">Phân Quyền & Bảo Mật</option>
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
                          {faq.category}
                        </span>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {faq.question}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px 50px', borderTop: '1px solid #F1F5F9' }}>
                      <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, margin: '14px 0 12px 0' }}>
                        {faq.answer}
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
                          <span>{faq.actionText}</span>
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

      {/* TAB 3: SUBMIT SUPPORT TICKET */}
      {activeTab === 'ticket' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {ticketSuccess && (
            <div
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {ticketSuccess}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Danh Sách Phiếu Hỗ Trợ Kỹ Thuật (Tickets)
              </h3>
              <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Theo dõi tiến độ giải quyết sự cố cùng chuyên gia hỗ trợ SelfAI
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsTicketModalOpen(true)}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Send size={15} />
              <span>Tạo Phiếu Hỗ Trợ Mới</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
            {/* Tickets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tickets.map((t) => {
                const isSelected = t.id === selectedTicketId;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    style={{
                      backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #059669' : '1px solid #E2E8F0',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', fontFamily: 'var(--font-mono, monospace)' }}>
                        #{t.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '9999px',
                          backgroundColor: t.status === 'RESOLVED' ? '#ECFDF5' : '#FEF3C7',
                          color: t.status === 'RESOLVED' ? '#059669' : '#D97706',
                        }}
                      >
                        {t.statusLabel}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                      {t.title}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t.companyName}</span>
                      <span>{t.updatedAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Ticket Conversation Thread */}
            {selectedTicket ? (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#2563EB', fontFamily: 'var(--font-mono, monospace)' }}>
                      #{selectedTicket.id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                      }}
                    >
                      Danh mục: {selectedTicket.category}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: '9999px',
                        backgroundColor: selectedTicket.impact === 'High' ? '#FEE2E2' : '#F1F5F9',
                        color: selectedTicket.impact === 'High' ? '#DC2626' : '#475569',
                      }}
                    >
                      Mức độ: {selectedTicket.impact}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {selectedTicket.title}
                  </h4>
                  <div style={{ fontSize: '0.78125rem', color: '#64748B', marginTop: '4px' }}>
                    Company liên quan: <strong>{selectedTicket.companyName}</strong> • Tạo lúc {selectedTicket.createdAt}
                  </div>
                </div>

                {/* Messages Stream */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '380px', overflowY: 'auto' }}>
                  {selectedTicket.messages.map((m) => {
                    const isUser = m.senderRole === 'USER';

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: '#64748B',
                            display: 'flex',
                            gap: '8px',
                            justifyContent: isUser ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <strong>{m.sender}</strong>
                          <span>{m.time}</span>
                        </div>
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            backgroundColor: isUser ? '#059669' : '#F1F5F9',
                            color: isUser ? '#FFFFFF' : '#1E293B',
                            fontSize: '0.8125rem',
                            lineHeight: 1.5,
                          }}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendTicketReply} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <input
                    type="text"
                    placeholder="Nhập nội dung phản hồi kỹ thuật viên..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8125rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Gửi
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 4: REPORT A BUG */}
      {activeTab === 'bug' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Bug Form */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Báo Cáo Lỗi Ứng Dụng (Bug Report)
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Hỗ trợ đội ngũ kỹ sư khắc phục sự cố UI, lỗi tính năng hoặc xung đột API
              </p>
            </div>

            {bugSuccess && (
              <div
                style={{
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                {bugSuccess}
              </div>
            )}

            <form onSubmit={handleCreateBug} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Tiêu Đề Lỗi *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nút phê duyệt Drain Node không phản hồi khi click"
                  value={bugTitle}
                  onChange={(e) => setBugTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Phân Loại Lỗi
                </label>
                <select
                  value={bugType}
                  onChange={(e) => setBugType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="UI">Giao Diện Người Dùng (UI / CSS / Lag)</option>
                  <option value="API">API & Kết Nối Backend</option>
                  <option value="Agent">Agent eBPF Telemetry</option>
                  <option value="AI">Động Cơ Dự Báo AI & RCA</option>
                  <option value="Security">Bảo Mật & Phân Quyền (RBAC)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Hành Vi Mong Đợi (Expected Behavior)
                </label>
                <textarea
                  rows={2}
                  placeholder="Hệ thống nên hiển thị popup xác nhận phê duyệt..."
                  value={bugExpected}
                  onChange={(e) => setBugExpected(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Hành Vi Thực Tế Gặp Phải (Actual Behavior) *
                </label>
                <textarea
                  rows={2}
                  placeholder="Màn hình đứng im, console báo lỗi 500 hoặc uncaught error..."
                  value={bugActual}
                  onChange={(e) => setBugActual(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Các Bước Tái Hiện Lỗi (Steps to Reproduce)
                </label>
                <textarea
                  rows={2}
                  placeholder="1. Vào Cổng Phê Duyệt $\to$ 2. Click nút Phê Duyệt $\to$ 3. Lỗi xuất hiện"
                  value={bugSteps}
                  onChange={(e) => setBugSteps(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.75rem',
                  color: '#64748B',
                }}
              >
                Hệ thống tự động đính kèm thông số kỹ thuật an toàn (Trình duyệt Chrome Windows, Phiên bản ứng dụng v2.4.0), <strong>tuyệt đối không gửi token, mật khẩu hoặc dữ liệu bí mật</strong>.
              </div>

              <button
                type="submit"
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Bug size={16} />
                <span>Gửi Báo Cáo Lỗi</span>
              </button>
            </form>
          </div>

          {/* Bug History List */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Trạng Thái Các Báo Cáo Lỗi Đã Gửi
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Tiến độ tiếp nhận, phân tích nguyên nhân và phát hành bản vá từ đội ngũ phát triển
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bugs.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', fontFamily: 'var(--font-mono, monospace)' }}>
                        #{b.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                        }}
                      >
                        {b.typeLabel}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#FEF3C7',
                        color: '#D97706',
                      }}
                    >
                      {b.statusLabel}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>{b.title}</div>

                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Thực tế: {b.actualBehavior}
                  </div>

                  <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '2px' }}>
                    Môi trường: {b.browser} • Gửi lúc {b.createdAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE TICKET MODAL */}
      {isTicketModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: '0 0 14px 0' }}>
              Tạo Phiếu Hỗ Trợ Kỹ Thuật (Support Ticket)
            </h3>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Tiêu Đề Vấn Đề *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cụm K8s prod-01 báo lỗi eBPF agent CrashLoopBackOff"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Danh Mục Vấn Đề
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <option value="Agent">Agent eBPF Telemetry</option>
                    <option value="Cluster">Cụm K8s Cluster</option>
                    <option value="AI Prediction">Dự Đoán AI & RCA</option>
                    <option value="Self-Healing">Tự Phục Hồi & Phê Duyệt</option>
                    <option value="Account">Tài Khoản & Phân Quyền</option>
                    <option value="Other">Khác (Other)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Mức Độ Ảnh Hưởng
                  </label>
                  <select
                    value={ticketImpact}
                    onChange={(e) => setTicketImpact(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8125rem',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <option value="Low">Thấp (Low - Hỏi đáp thông thường)</option>
                    <option value="Medium">Trung bình (Medium - Tính năng phụ lỗi)</option>
                    <option value="High">Cao (High - Cụm K8s mất giám sát)</option>
                    <option value="Critical">Khẩn cấp (Critical - Dịch vụ dừng hoạt động)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Company Liên Quan
                </label>
                <select
                  value={ticketCompanyId}
                  onChange={(e) => setTicketCompanyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Mô Tả Chi Tiết Vấn Đề *
                </label>
                <textarea
                  rows={4}
                  placeholder="Ghi rõ triệu chứng, thông báo lỗi cụ thể và đính kèm nhật ký nếu có..."
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsTicketModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F1F5F9',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Gửi Phiếu Hỗ Trợ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalHelpPage;
