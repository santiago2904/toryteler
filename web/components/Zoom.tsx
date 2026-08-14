'use client';

import { useEffect, useState } from 'react';

type ConVistaDeTransicion = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/**
 * Alterna la densidad de la rejilla entre lejos (muchas piezas por fila) y
 * cerca (tres por fila, para mirar de verdad).
 *
 * El cambio se envuelve en una transición de vista: el navegador interpola la
 * posición y el tamaño de cada pieza, que es lo que produce la sensación de
 * acercarse. Sin ella —Firefox, Safari viejo— queda la transición CSS de las
 * columnas, que es peor pero no rompe nada.
 *
 * El estado vive como atributo en <html>, no en React: así el botón puede
 * estar en la cabecera y la rejilla en otra página sin pasar props.
 */
export function Zoom() {
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    setCerca(document.documentElement.dataset.zoom === 'cerca');
  }, []);

  function alternar() {
    const siguiente = !cerca;

    const aplicar = () => {
      setCerca(siguiente);
      document.documentElement.dataset.zoom = siguiente ? 'cerca' : 'lejos';
    };

    try {
      localStorage.setItem('zoom', siguiente ? 'cerca' : 'lejos');
    } catch {
      // Almacenamiento bloqueado: la preferencia dura la sesión.
    }

    const doc = document as ConVistaDeTransicion;
    const quietud = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (doc.startViewTransition && !quietud) {
      doc.startViewTransition(aplicar);
    } else {
      aplicar();
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="zoom"
      aria-pressed={cerca}
      aria-label={cerca ? 'Alejar: ver más piezas por fila' : 'Acercar: ver las piezas más grandes'}
    >
      {cerca ? '−' : '+'}
    </button>
  );
}
