import React from 'react';

export const FeatureStrip = ({ className = '', onNavigate }) => {
  const handleLearnMore = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/guide');
    } else {
      window.history.pushState({}, '', '/guide');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <section
      className={`agent-bridge-banner ${className}`.trim()}
      data-testid="agent-bridge-section"
      style={{
        position: 'relative',
        zIndex: 25,
        width: '100%',
        backgroundColor: 'var(--bg-navy)', /* #3D3B4F */
        borderTop: '1px solid rgba(198, 249, 226, 0.18)',
        borderBottom: '1px solid rgba(198, 249, 226, 0.18)',
        overflow: 'hidden',
      }}
    >
      {/* Continuous Left & Right Vertical Dashed Guidelines spanning through the [ AGENT ] banner */}
      <span
        aria-hidden="true"
        className="agent-guide-v-left"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 'calc(clamp(20px, 3.5vw, 64px) + 5px)',
          width: '1px',
          borderLeft: '1px dashed rgba(138, 174, 160, 0.45)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <span
        aria-hidden="true"
        className="agent-guide-v-right"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 'calc(clamp(20px, 3.5vw, 64px) + 5px)',
          width: '1px',
          borderLeft: '1px dashed rgba(138, 174, 160, 0.45)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Top parallel horizontal scan lines matching Greptile [ AGENT ] banner */}
      <div
        aria-hidden="true"
        style={{
          width: '100%',
          height: '24px',
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(198, 249, 226, 0.16) 0px, rgba(198, 249, 226, 0.16) 1px, transparent 1px, transparent 4px)',
          borderBottom: '1px solid rgba(198, 249, 226, 0.14)',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: '56px',
          paddingBottom: '68px',
          paddingLeft: 'clamp(24px, 5vw, 96px)',
          paddingRight: 'clamp(24px, 5vw, 96px)',
        }}
      >
        {/* Top-left & top-right hexagon guide nodes */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '8px',
            left: 'clamp(20px, 3.5vw, 64px)',
            width: '11px',
            height: '11px',
            backgroundColor: '#8AAEA0',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            boxShadow: '0 0 6px rgba(138, 174, 160, 0.45)',
            zIndex: 3,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '8px',
            right: 'clamp(20px, 3.5vw, 64px)',
            width: '11px',
            height: '11px',
            backgroundColor: '#8AAEA0',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            boxShadow: '0 0 6px rgba(138, 174, 160, 0.45)',
            zIndex: 3,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '32px',
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          {/* Left Content: [ AGENT ] tag, headline, concise bridge description */}
          <div style={{ flex: '1 1 600px', maxWidth: '1100px' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                color: '#9CE8C9',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              [ AGENT ]
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 3.8vw, 3.25rem)',
                fontWeight: 700,
                color: '#C6F9E2',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                marginBottom: '16px',
              }}
            >
              Cách Agent kết nối với dự án của bạn
            </h2>

            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(0.95rem, 1.25vw, 1.125rem)',
                fontWeight: 400,
                color: '#88C6AD',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              SelfHeal Agent đóng vai trò cầu nối liên kết trực tiếp giữa dự án của bạn với chúng tôi, tự động đồng bộ trạng thái hạ tầng và kích hoạt quy trình khôi phục tức thì khi phát hiện sự cố tiềm ẩn.
            </p>
          </div>

          {/* Right Hexagon Button */}
          <div style={{ flexShrink: 0, paddingTop: '4px' }}>
            <a
              href="/guide"
              onClick={handleLearnMore}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 30px',
                backgroundColor: '#C6F9E2',
                color: '#2B2938',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                textDecoration: 'none',
                clipPath:
                  'polygon(11px 0%, calc(100% - 11px) 0%, 100% 50%, calc(100% - 11px) 100%, 11px 100%, 0% 50%)',
                transition: 'background-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#28E99F';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#C6F9E2';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Tìm hiểu thêm
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureStrip;
