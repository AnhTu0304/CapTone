import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('contact');
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
      setErrorMsg(t('validation.requiredFields'));
      return;
    }

    if (!formData.workEmail.includes('@') || !formData.workEmail.includes('.')) {
      setErrorMsg(t('validation.invalidEmail'));
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
        {/* Full-width Architectural Hatched CAD Horizontal Rulers */}
        <div className="contact-banner-hatched-top" aria-hidden="true" />
        <div className="contact-banner-hatched-bottom" aria-hidden="true" />

        {/* Centered Contained Architectural Frame (matching Greptile reference) */}
        <div className="contact-hero-frame">
          {/* Vertical Hatched Dividing Columns defining the neat inner box */}
          <div className="contact-banner-hatched-left" aria-hidden="true" />
          <div className="contact-banner-hatched-right" aria-hidden="true" />

          {/* Soft Light Mint Dense Pixel Wave Canvas (strictly contained inside frame) */}
          <PixelWaveCanvas height={300} />

          {/* Banner Central Typography in Vietnamese */}
          <div className="contact-hero-content">
            <h1 className="contact-hero-title">{t('hero.title')}</h1>
            <p className="contact-hero-subtitle">
              {t('hero.subtitle')}
            </p>
          </div>
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
              <h2 className="contact-success-title">{t('success.title')}</h2>
              <p className="contact-success-desc">
                {t('success.descBefore')}
                <strong>{formData.workEmail}</strong>
                {t('success.descAfter')}
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
                <span>{t('success.anotherBtn')}</span>
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
                    <span>{t('form.firstNameLabel')}</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder={t('form.firstNamePlaceholder')}
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="contact-input"
                    autoComplete="given-name"
                  />
                </div>

                <div className="contact-field-group">
                  <label htmlFor="lastName" className="contact-label">
                    <User size={13} strokeWidth={2.2} />
                    <span>{t('form.lastNameLabel')}</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder={t('form.lastNamePlaceholder')}
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
                  <span>{t('form.workEmailLabel')}</span>
                </label>
                <input
                  id="workEmail"
                  name="workEmail"
                  type="email"
                  placeholder={t('form.workEmailPlaceholder')}
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
                  <span>{t('form.phoneLabel')}</span>
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  placeholder={t('form.phonePlaceholder')}
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
                  <span>{t('form.companyLabel')}</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder={t('form.companyPlaceholder')}
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
                  <span>{t('form.teamSizeLabel')}</span>
                </label>
                <div className="contact-select-wrapper">
                  <select
                    id="teamSize"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={(e) => handleChange('teamSize', e.target.value)}
                    className="contact-select"
                  >
                    <option value="" disabled>{t('form.teamSizePlaceholder')}</option>
                    <option value="1-10">{t('form.teamSizeOptions.1-10')}</option>
                    <option value="11-50">{t('form.teamSizeOptions.11-50')}</option>
                    <option value="51-200">{t('form.teamSizeOptions.51-200')}</option>
                    <option value="201-500">{t('form.teamSizeOptions.201-500')}</option>
                    <option value="500+">{t('form.teamSizeOptions.500+')}</option>
                  </select>
                  <ChevronDown size={14} className="contact-select-caret" aria-hidden="true" />
                </div>
              </div>

              {/* Row 6: Textarea Ghi Chú Hỗ Trợ */}
              <div className="contact-field-group">
                <label htmlFor="notes" className="contact-label">
                  <HelpCircle size={13} strokeWidth={2.2} />
                  <span>{t('form.notesLabel')}</span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder={t('form.notesPlaceholder')}
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
                  aria-label={t('form.submit')}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="contact-btn-spinner" />
                      <span>{t('form.submitting')}</span>
                    </>
                  ) : (
                    <span>{t('form.submit')}</span>
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
