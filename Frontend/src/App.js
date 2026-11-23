import React, { useState, useEffect, useRef, useCallback } from 'react';
import RouteRenderer from './routes';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import { ServerErrorPage } from './pages/Error/StatusPages';
import { initPageFadeIn } from './lib/animations';
import './styles/globals.css';
import './styles/dashboard-tokens.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi không mong muốn khi hiển thị giao diện.',
    };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <PublicLayout currentPath="/500" onNavigate={this.props.onNavigate}>
          <ServerErrorPage
            title="500 — Lỗi hiển thị giao diện"
            message={this.state.errorMessage}
          />
        </PublicLayout>
      );
    }
    return this.props.children;
  }
}

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
      const { status, endpoint, message } = event?.detail || {};
      const currentPathname = (window.location.pathname || '/').toLowerCase();
      const normalizedEndpoint = String(endpoint || '').toLowerCase();

      if (status === 503) {
        warning(
          message || 'Máy chủ đang bảo trì hoặc tạm quá tải.',
          'Cảnh báo dịch vụ — 503'
        );
        if (currentPathname !== '/503') {
          handleNavigate('/503');
        }
      } else if (status === 429) {
        warning(
          message || 'Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau.',
          'Cảnh báo giới hạn — 429'
        );
        if (currentPathname !== '/429') {
          handleNavigate('/429');
        }
      } else if (
        status === 403 &&
        (normalizedEndpoint.includes('/admin') || currentPathname.startsWith('/admin'))
      ) {
        warning(
          message || 'Tài khoản không có quyền truy cập khu vực quản trị.',
          'Cảnh báo phân quyền — 403'
        );
        if (currentPathname !== '/403') {
          handleNavigate('/403');
        }
      } else if (
        status === 401 &&
        (currentPathname.startsWith('/dashboard') ||
          currentPathname.startsWith('/admin') ||
          currentPathname.startsWith('/portal') ||
          currentPathname.startsWith('/onboarding'))
      ) {
        warning(
          message || 'Phiên đăng nhập đã hết hạn hoặc chưa xác thực.',
          'Cảnh báo xác thực — 401'
        );
        if (currentPathname !== '/401') {
          handleNavigate('/401');
        }
      } else if (status === 500) {
        warning(
          message || 'Máy chủ gặp lỗi xử lý nội bộ.',
          'Cảnh báo máy chủ — 500'
        );
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
    <AppErrorBoundary onNavigate={handleNavigate}>
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
    </AppErrorBoundary>
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
