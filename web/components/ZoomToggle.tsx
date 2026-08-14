'use client';

import { useEffect, useState } from 'react';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/**
 * Toggles grid density between out (many pieces per row) and in (three per
 * row, to actually look at them).
 *
 * The change is wrapped in a view transition so the browser interpolates each
 * piece's position and size, which is what produces the feeling of moving
 * closer. Without support — Firefox, older Safari — the CSS column transition
 * remains: worse, but nothing breaks.
 *
 * State lives as an attribute on <html>, not in React: that way the button can
 * sit in the header and the grid on another page with no props or context.
 */
export function ZoomToggle() {
  const [zoomedIn, setZoomedIn] = useState(false);

  useEffect(() => {
    setZoomedIn(document.documentElement.dataset.zoom === 'in');
  }, []);

  function toggle() {
    const next = !zoomedIn;

    const apply = () => {
      setZoomedIn(next);
      document.documentElement.dataset.zoom = next ? 'in' : 'out';
    };

    try {
      localStorage.setItem('zoom', next ? 'in' : 'out');
    } catch {
      // Storage blocked: the preference lasts for the session.
    }

    const doc = document as DocumentWithViewTransition;
    const stillness = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (doc.startViewTransition && !stillness) {
      doc.startViewTransition(apply);
    } else {
      apply();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="zoom-button"
      aria-pressed={zoomedIn}
      aria-label={
        zoomedIn ? 'Alejar: ver más piezas por fila' : 'Acercar: ver las piezas más grandes'
      }
    >
      {zoomedIn ? '−' : '+'}
    </button>
  );
}
