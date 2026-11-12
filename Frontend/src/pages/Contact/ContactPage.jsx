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

  const isFilled = (val) => Boolean(val && val.trim().length > 0);

  return (
    <div className="contact-page-container">
      {/* ================= SECTION 1: CONTACT SALES HERO BANNER ================= */}
      <section className="contact-hero-banner" data-testid="contact-hero-banner">
        {/* Architectural Hatched Ruler Borders */}
        <div className="contact-banner-hatched-top" aria-hidden="true" />
        <div className="contact-banner-hatched-left" aria-hidden="true" />
        <div className="contact-banner-hatched-right" aria-hidden="true" />
        <div className="contact-banner-hatched-bottom" aria-hidden="true" />

        {/* Digital Matrix Mint Pixel Wave Canvas */}
        <div className="contact-hero-pixel-wave" aria-hidden="true">
          <svg
            className="contact-pixel-svg"
            viewBox="0 0 1200 180"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="pixelColPattern"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <rect x="2" y="2" width="6" height="6" fill="#28E99F" fillOpacity="0.32" />
                <rect x="14" y="14" width="6" height="6" fill="#28E99F" fillOpacity="0.45" />
                <rect x="14" y="2" width="6" height="6" fill="#28E99F" fillOpacity="0.18" />
                <rect x="2" y="14" width="6" height="6" fill="#28E99F" fillOpacity="0.22" />
              </pattern>
              <linearGradient id="waveMask" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#28E99F" stopOpacity="0.85" />
                <stop offset="20%" stopColor="#28E99F" stopOpacity="0.65" />
                <stop offset="50%" stopColor="#28E99F" stopOpacity="0.25" />
                <stop offset="80%" stopColor="#28E99F" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#28E99F" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Generative Pixel Column Rectangles with Varied Equalizer Heights */}
            <g opacity="0.85">
              {/* Left Wave Cluster */}
              <rect x="60" y="20" width="16" height="140" fill="#B2F8D5" opacity="0.65" />
              <rect x="84" y="40" width="14" height="100" fill="#28E99F" opacity="0.5" />
              <rect x="106" y="10" width="18" height="160" fill="#C6F9E2" opacity="0.75" />
              <rect x="132" y="50" width="12" height="90" fill="#28E99F" opacity="0.4" />
              <rect x="152" y="30" width="20" height="120" fill="#B2F8D5" opacity="0.6" />
              <rect x="180" y="60" width="14" height="70" fill="#C6F9E2" opacity="0.5" />
              <rect x="202" y="40" width="16" height="110" fill="#28E99F" opacity="0.45" />
              <rect x="226" y="20" width="18" height="130" fill="#B2F8D5" opacity="0.55" />
              <rect x="252" y="50" width="14" height="80" fill="#C6F9E2" opacity="0.4" />
              <rect x="274" y="70" width="16" height="60" fill="#28E99F" opacity="0.3" />
              <rect x="298" y="30" width="14" height="110" fill="#B2F8D5" opacity="0.4" />
              <rect x="320" y="60" width="18" height="80" fill="#C6F9E2" opacity="0.3" />

              {/* Center Subtle Cloud Dispersion */}
              <rect x="360" y="40" width="480" height="100" fill="url(#pixelColPattern)" opacity="0.45" />

              {/* Right Wave Cluster */}
              <rect x="862" y="60" width="18" height="80" fill="#C6F9E2" opacity="0.3" />
              <rect x="888" y="30" width="14" height="110" fill="#B2F8D5" opacity="0.4" />
              <rect x="910" y="70" width="16" height="60" fill="#28E99F" opacity="0.3" />
              <rect x="934" y="50" width="14" height="80" fill="#C6F9E2" opacity="0.4" />
              <rect x="956" y="20" width="18" height="130" fill="#B2F8D5" opacity="0.55" />
              <rect x="982" y="40" width="16" height="110" fill="#28E99F" opacity="0.45" />
              <rect x="1006" y="60" width="14" height="70" fill="#C6F9E2" opacity="0.5" />
              <rect x="1028" y="30" width="20" height="120" fill="#B2F8D5" opacity="0.6" />
              <rect x="1056" y="50" width="12" height="90" fill="#28E99F" opacity="0.4" />
              <rect x="1076" y="10" width="18" height="160" fill="#C6F9E2" opacity="0.75" />
              <rect x="1102" y="40" width="14" height="100" fill="#28E99F" opacity="0.5" />
              <rect x="1124" y="20" width="16" height="140" fill="#B2F8D5" opacity="0.65" />
            </g>
          </svg>
        </div>

        {/* Banner Central Typography */}
        <div className="contact-hero-content">
          <h1 className="contact-hero-title">Contact Sales</h1>
          <p className="contact-hero-subtitle">
            Thanks for your interest in SelfHeal. Fill out the form and our team will reach out ASAP.
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
                <span>Gửi thông tin khác</span>
              </button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div className="contact-error-banner" role="alert">
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Row 1: First Name & Last Name (2 columns) */}
              <div className="contact-row contact-row-2col">
                <div className="contact-field-group">
                  <label htmlFor="firstName" className="contact-label">
                    <User size={13} strokeWidth={2.2} />
                    <span>FIRST NAME</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Tú"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className={`contact-input ${isFilled(formData.firstName) ? 'contact-input-filled' : ''}`}
                    autoComplete="given-name"
                  />
                </div>

                <div className="contact-field-group">
                  <label htmlFor="lastName" className="contact-label">
                    <User size={13} strokeWidth={2.2} />
                    <span>LAST NAME</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Ngô"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className={`contact-input ${isFilled(formData.lastName) ? 'contact-input-filled' : ''}`}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Row 2: Work Email */}
              <div className="contact-field-group">
                <label htmlFor="workEmail" className="contact-label">
                  <Mail size={13} strokeWidth={2.2} />
                  <span>WORK EMAIL</span>
                </label>
                <input
                  id="workEmail"
                  name="workEmail"
                  type="email"
                  placeholder="tungo342005@gmail.com"
                  value={formData.workEmail}
                  onChange={(e) => handleChange('workEmail', e.target.value)}
                  className={`contact-input ${isFilled(formData.workEmail) ? 'contact-input-filled' : ''}`}
                  autoComplete="email"
                />
              </div>

              {/* Row 3: Phone Number (Optional) */}
              <div className="contact-field-group">
                <label htmlFor="phoneNumber" className="contact-label">
                  <Phone size={13} strokeWidth={2.2} />
                  <span>PHONE NUMBER (OPTIONAL)</span>
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={formData.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  className={`contact-input ${isFilled(formData.phoneNumber) ? 'contact-input-filled' : ''}`}
                  autoComplete="tel"
                />
              </div>

              {/* Row 4: Company Name */}
              <div className="contact-field-group">
                <label htmlFor="companyName" className="contact-label">
                  <Building2 size={13} strokeWidth={2.2} />
                  <span>COMPANY NAME</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Acme Inc."
                  value={formData.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  className={`contact-input ${isFilled(formData.companyName) ? 'contact-input-filled' : ''}`}
                  autoComplete="organization"
                />
              </div>

              {/* Row 5: How Many Engineers? Dropdown */}
              <div className="contact-field-group">
                <label htmlFor="teamSize" className="contact-label">
                  <Users size={13} strokeWidth={2.2} />
                  <span>HOW MANY ENGINEERS?</span>
                </label>
                <div className="contact-select-wrapper">
                  <select
                    id="teamSize"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={(e) => handleChange('teamSize', e.target.value)}
                    className={`contact-select ${isFilled(formData.teamSize) ? 'contact-input-filled' : ''}`}
                  >
                    <option value="" disabled>Select team size</option>
                    <option value="1-10">1-10 engineers</option>
                    <option value="11-50">11-50 engineers</option>
                    <option value="51-200">51-200 engineers</option>
                    <option value="201-500">201-500 engineers</option>
                    <option value="500+">500+ engineers</option>
                  </select>
                  <ChevronDown size={14} className="contact-select-caret" aria-hidden="true" />
                </div>
              </div>

              {/* Row 6: Textarea Notes */}
              <div className="contact-field-group">
                <label htmlFor="notes" className="contact-label">
                  <HelpCircle size={13} strokeWidth={2.2} />
                  <span>WHAT WOULD BE HELPFUL FOR US TO KNOW BEFORE THE CALL?</span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder="Tell us about your team, your codebase, and what you're looking to achieve..."
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className={`contact-textarea ${isFilled(formData.notes) ? 'contact-input-filled' : ''}`}
                />
              </div>

              {/* Row 7: Double-Hexagon / Chevron Submit Button */}
              <div className="contact-btn-container">
                <button
                  type="submit"
                  disabled={loading}
                  className="contact-btn-submit"
                  aria-label="Submit"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="contact-btn-spinner" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Submit</span>
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
