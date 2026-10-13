import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders its children only once the section is about to scroll into view, and shows a placeholder
 * of the same height until then, so a heavy section never delays the rest of the screen.
 */
export default function LazySection({ children, height, label }: { children: ReactNode; height: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const placeholder = <div className="panel skeleton" style={{ minHeight: height }} aria-label={`Loading ${label}`} />;
  return <div ref={ref}>{visible ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder}</div>;
}
