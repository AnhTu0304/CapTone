import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Users, 
  HelpCircle, 
  CheckCircle2, 
  Loader2,
  ChevronDown
} from 'lucide-react';
import PixelWaveCanvas from './components/PixelWaveCanvas';
import './ContactPage.css';

export const ContactPage = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    phoneNumber: '',
    companyName: '',
    teamSize: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.workEmail.trim() || !formData.companyName.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }

    if (!formData.workEmail.includes('@') || !formData.workEmail.includes('.')) {
      setErrorMsg('Vui lòng nhập định dạng email hợp lệ');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Simulate sending contact message
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 400);
  };

  return (
    <div className="contact-page-container">
      {/* ================= SECTION 1: CONTACT SALES HERO BANNER (HEIGHT 300PX) ================= */}
      <section className="contact-hero-banner" data-testid="contact-hero-banner">
        {/* Architectural Hatched CAD Borders */}
        <div className="contact-banner-hatched-top" aria-hidden="true" />
        <div className="contact-banner-hatched-left" aria-hidden="true" />
        <div className="contact-banner-hatched-right" aria-hidden="true" />
        <div className="contact-banner-hatched-bottom" aria-hidden="true" />

        {/* Dynamic Electric Neon Mint Pixel Wave (Canvas 2D) */}
        <PixelWaveCanvas height={300} />

        {/* Banner Central Typography in Vietnamese */}
        <div className="contact-hero-content">
          <h1 className="contact-hero-title">Liên Hệ Tư Vấn</h1>
          <p className="contact-hero-subtitle">
            Cảm ơn bạn đã quan tâm đến SelfHeal. Vui lòng điền thông tin bên dưới, đội ngũ kỹ sư của chúng tôi sẽ liên hệ trong thời gian sớm nhất.
          </p>
        </div>
      </section>

      {/* ================= SECTION 2: FULL-WIDTH ARCHITECTURAL FORM SECTION ================= */}
      <section className="contact-form-section">
        {/* Background Architectural Grid Overlay with Side Guide Lines & Mint Crosshair Dots */}
        <div className="contact-bg-grid" aria-hidden="true">
          <div className="contact-gutter-guide gutter-left">
            <span className="contact-grid-dot dot-1" />
            <span className="contact-grid-dot dot-2" />
            <span className="contact-grid-dot dot-3" />
            <span className="contact-grid-dot dot-4" />
            <span className="contact-grid-dot dot-5" />
            <span className="contact-grid-dot dot-6" />
          </div>
          <div className="contact-gutter-guide gutter-right">
            <span className="contact-grid-dot dot-7" />
            <span className="contact-grid-dot dot-8" />
            <span className="contact-grid-dot dot-9" />
            <span className="contact-grid-dot dot-10" />
            <span className="contact-grid-dot dot-11" />
            <span className="contact-grid-dot dot-12" />
          </div>
        </div>

        <div className="contact-form-wrapper">
          {submitted ? (
            <div className="contact-success-card" data-testid="contact-success-state">
              <CheckCircle2 size={48} className="contact-success-icon" />
              <h2 className="contact-success-title">Cảm ơn bạn!</h2>
              <p className="contact-success-desc">
                Thông tin của bạn đã được gửi thành công. Đội ngũ kỹ sư SelfHeal sẽ liên hệ với bạn qua email{' '}
                <strong>{formData.workEmail}</strong> trong vòng 24 giờ làm việc.
              </p>
              <button
                type="button"
                className="contact-btn-submit"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    firstName: '',
                    lastName: '',
                    workEmail: '',
                    phoneNumber: '',
                    companyName: '',
                    teamSize: '',
                    notes: '',
                  });
                }}
              >
                <span>Gửi yêu cầu khác</span>
              </button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div className="contact-error-banner" role="alert">
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Row 1: Tên & Họ (2 columns) */}
              <div className="contact-row contact-row-2col">
                <div className="contact-field-group">
                  <label htmlFor="firstName" className="contact-label">
                    <User size={13} strokeWidth={2.2} />
                    <span>TÊN</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Tú"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="contact-input"
                    autoComplete="given-name"
                  />
                </div>

                <div className="contact-field-group">
                  <label htmlFor="lastName" className="contact-label">
                    <User size={13} strokeWidth={2.2} />
                    <span>HỌ</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Ngô"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="contact-input"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Row 2: Email Doanh Nghiệp */}
              <div className="contact-field-group">
                <label htmlFor="workEmail" className="contact-label">
                  <Mail size={13} strokeWidth={2.2} />
                  <span>EMAIL DOANH NGHIỆP</span>
                </label>
                <input
                  id="workEmail"
                  name="workEmail"
                  type="email"
                  placeholder="tungo342005@gmail.com"
                  value={formData.workEmail}
                  onChange={(e) => handleChange('workEmail', e.target.value)}
                  className="contact-input"
                  autoComplete="email"
                />
              </div>

              {/* Row 3: Số Điện Thoại (Tùy chọn) */}
              <div className="contact-field-group">
                <label htmlFor="phoneNumber" className="contact-label">
                  <Phone size={13} strokeWidth={2.2} />
                  <span>SỐ ĐIỆN THOẠI (TÙY CHỌN)</span>
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  placeholder="+84 912 345 678"
                  value={formData.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  className="contact-input"
                  autoComplete="tel"
                />
              </div>

              {/* Row 4: Tên Doanh Nghiệp / Công Ty */}
              <div className="contact-field-group">
                <label htmlFor="companyName" className="contact-label">
                  <Building2 size={13} strokeWidth={2.2} />
                  <span>TÊN DOANH NGHIỆP / CÔNG TY</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Acme Inc."
                  value={formData.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  className="contact-input"
                  autoComplete="organization"
                />
              </div>

              {/* Row 5: Quy Mô Đội Ngũ Kỹ Sư? Dropdown */}
              <div className="contact-field-group">
                <label htmlFor="teamSize" className="contact-label">
                  <Users size={13} strokeWidth={2.2} />
                  <span>QUY MÔ ĐỘI NGŨ KỸ SƯ?</span>
                </label>
                <div className="contact-select-wrapper">
                  <select
                    id="teamSize"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={(e) => handleChange('teamSize', e.target.value)}
                    className="contact-select"
                  >
                    <option value="" disabled>Chọn quy mô đội ngũ</option>
                    <option value="1-10">1 - 10 kỹ sư</option>
                    <option value="11-50">11 - 50 kỹ sư</option>
                    <option value="51-200">51 - 200 kỹ sư</option>
                    <option value="201-500">201 - 500 kỹ sư</option>
                    <option value="500+">Trên 500 kỹ sư</option>
                  </select>
                  <ChevronDown size={14} className="contact-select-caret" aria-hidden="true" />
                </div>
              </div>

              {/* Row 6: Textarea Ghi Chú Hỗ Trợ */}
              <div className="contact-field-group">
                <label htmlFor="notes" className="contact-label">
                  <HelpCircle size={13} strokeWidth={2.2} />
                  <span>BẠN CẦN CHÚNG TÔI HỖ TRỢ ĐIỀU GÌ TRƯỚC CUỘC HẸN?</span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder="Hãy chia sẻ về đội ngũ, quy mô hạ tầng Kubernetes hiện tại và mục tiêu bạn muốn tối ưu tự phục hồi..."
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="contact-textarea"
                />
              </div>

              {/* Row 7: Double-Hexagon / Chevron Submit Button */}
              <div className="contact-btn-container">
                <button
                  type="submit"
                  disabled={loading}
                  className="contact-btn-submit"
                  aria-label="Gửi Yêu Cầu Tư Vấn"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="contact-btn-spinner" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <span>Gửi Yêu Cầu Tư Vấn</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
