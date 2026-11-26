import React, { useState, useEffect, useRef, useCallback } from 'react';
import i18n from './i18n';
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
      errorMessage: error?.message || i18n.t('common:app.errorBoundary.defaultMessage'),
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
            title={i18n.t('common:app.errorBoundary.title')}
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
          message || i18n.t('common:app.httpToast.503Message'),
          i18n.t('common:app.httpToast.503Title')
        );
        if (currentPathname !== '/503') {
          handleNavigate('/503');
        }
      } else if (status === 429) {
        warning(
          message || i18n.t('common:app.httpToast.429Message'),
          i18n.t('common:app.httpToast.429Title')
        );
        if (currentPathname !== '/429') {
          handleNavigate('/429');
        }
      } else if (
        status === 403 &&
        (normalizedEndpoint.includes('/admin') || currentPathname.startsWith('/admin'))
      ) {
        warning(
          message || i18n.t('common:app.httpToast.403Message'),
          i18n.t('common:app.httpToast.403Title')
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
          message || i18n.t('common:app.httpToast.401Message'),
          i18n.t('common:app.httpToast.401Title')
        );
        if (currentPathname !== '/401') {
          handleNavigate('/401');
        }
      } else if (status === 500) {
        warning(
          message || i18n.t('common:app.httpToast.500Message'),
          i18n.t('common:app.httpToast.500Title')
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
