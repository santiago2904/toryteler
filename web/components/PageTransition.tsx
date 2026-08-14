'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Entering a piece slides in from the right (moving forward); going back slides
 * in from the left. Direction is not guessed from the route: it listens to
 * `popstate`, the only event that truly tells a browser "back" apart from a
 * normal click.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const goingBack = useRef(false);

  useEffect(() => {
    const onPopState = () => { goingBack.current = true; };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setDirection(goingBack.current ? 'back' : 'forward');
    goingBack.current = false;
  }, [pathname]);

  return (
    // Keying by route forces a remount, and with it the entrance animation.
    <main key={pathname} data-direction={direction} className="page-transition">
      {children}
    </main>
  );
}
