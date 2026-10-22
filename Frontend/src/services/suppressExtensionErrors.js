/**
 * @file suppressExtensionErrors.js
 * @description Ngăn lỗi unhandled từ Browser Extensions (Urban VPN, Adblockers, Translators...)
 * kích hoạt màn hình Create React App Error Overlay trong quá trình phát triển (development).
 */

if (typeof window !== 'undefined') {
  const isExtensionError = (errOrEvent) => {
    const filename = errOrEvent?.filename || errOrEvent?.source || '';
    const stack = errOrEvent?.error?.stack || errOrEvent?.stack || '';
    const message = errOrEvent?.message || (typeof errOrEvent === 'string' ? errOrEvent : '');
    return (
      filename.includes('chrome-extension://') ||
      filename.includes('moz-extension://') ||
      stack.includes('chrome-extension://') ||
      stack.includes('moz-extension://') ||
      message.includes("reading 'M_ID'")
    );
  };

  window.addEventListener(
    'error',
    (event) => {
      if (isExtensionError(event)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        console.warn('[Ignored Browser Extension Error]', event.message || event);
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isExtensionError(event.reason)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        console.warn('[Ignored Browser Extension Rejection]', event.reason);
      }
    },
    true
  );
}

const isSuppressorActive = true;
export default isSuppressorActive;
