import React, { useState, useEffect, useRef } from 'react';
import RouteRenderer from './routes';
import { ToastProvider } from './context/ToastContext';
import { initPageFadeIn } from './lib/animations';
import './styles/globals.css';
import './styles/dashboard-tokens.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');
  const [activeDocId, setActiveDocId] = useState('overview');
  const mainRef = useRef(null);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (mainRef.current) {
      initPageFadeIn(mainRef.current);
    }
  };

  const handleSelectDoc = (docId) => {
    setActiveDocId(docId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ToastProvider>
      <div ref={mainRef} className="selfheal-app">
        <RouteRenderer
          currentPath={currentPath}
          onNavigate={handleNavigate}
          activeDocId={activeDocId}
          onSelectDoc={handleSelectDoc}
        />
      </div>
    </ToastProvider>
  );
}

export default App;
