import { useState, useEffect } from 'react';

export const useScrollSpy = (elementIds = [], offset = 100) => {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!elementIds.length) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + offset;

      for (let i = elementIds.length - 1; i >= 0; i--) {
        const id = elementIds[i];
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveId(id);
            return;
          }
        }
      }

      if (elementIds.length > 0) {
        setActiveId(elementIds[0]);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [elementIds, offset]);

  return activeId;
};

export default useScrollSpy;
