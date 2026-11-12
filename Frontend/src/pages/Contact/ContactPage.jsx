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
    </div>
  );
};

export default ContactPage;
