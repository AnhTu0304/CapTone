import React, { useState, useEffect, useRef, useCallback } from 'react';
import RouteRenderer from './routes';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { initPageFadeIn } from './lib/animations';
import './styles/globals.css';
import './styles/dashboard-tokens.css';

const AppContent = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');
  const [activeDocId, setActiveDocId] = useState('overview');
  const mainRef = useRef(null);
  const { warning } = useToast();

  const handleNavigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new CustomEvent('selfheal:urlchange', { detail: { path } }));
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (mainRef.current) {
      initPageFadeIn(mainRef.current);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    const handleHttpStatus = (event) => {
      const { status, message } = event?.detail || {};
      if (status === 503) {
        warning(
          message || 'Máy chủ đang bảo trì hoặc tạm quá tải.',
          'Cảnh báo dịch vụ — 503'
        );
        if (window.location.pathname !== '/503') {
          handleNavigate('/503');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('selfheal:http-status', handleHttpStatus);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('selfheal:http-status', handleHttpStatus);
    };
  }, [handleNavigate, warning]);

  const handleSelectDoc = (docId) => {
    setActiveDocId(docId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AuthProvider>
      <div ref={mainRef} className="selfheal-app">
        <RouteRenderer
          currentPath={currentPath}
          onNavigate={handleNavigate}
          activeDocId={activeDocId}
          onSelectDoc={handleSelectDoc}
        />
      </div>
    </AuthProvider>
  );
};

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
