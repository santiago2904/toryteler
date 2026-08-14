'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { agregar, estaEnCarrito, EVENTO_CARRITO, LineaCarrito } from '@/lib/carrito';
import estilos from './BotonCarrito.module.scss';

/**
 * Añade y, si ya está dentro, deja de ofrecer añadir: una pieza es única y un
 * video va uno por persona, así que pulsar dos veces no significa nada. En vez
 * de repetir la acción, se ofrece ir al carrito.
 */
export function BotonCarrito({ linea }: { linea: LineaCarrito }) {
  const [dentro, setDentro] = useState(false);

  useEffect(() => {
    const actualizar = () => setDentro(estaEnCarrito(linea.kind, linea.slug));
    actualizar();
    window.addEventListener(EVENTO_CARRITO, actualizar);
    return () => window.removeEventListener(EVENTO_CARRITO, actualizar);
  }, [linea.kind, linea.slug]);

  if (dentro) {
    return (
      <div className={estilos.dentro}>
        <span className="mayusculas tenue">En tu carrito</span>
        <Link href="/carrito" className={estilos.enlace}>
          <button type="button">Ir al carrito</button>
        </Link>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => agregar(linea)}>
      Añadir al carrito
    </button>
  );
}
