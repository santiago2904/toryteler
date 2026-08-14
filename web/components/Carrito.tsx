'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EVENTO_CARRITO, leerCarrito } from '@/lib/carrito';
import estilos from './Carrito.module.scss';

/**
 * El contador arranca vacío y se llena tras montar: leer localStorage durante
 * el render daría un desajuste de hidratación, porque el servidor no puede
 * saber qué hay en el carrito de cada quien.
 */
export function Carrito() {
  const [cantidad, setCantidad] = useState(0);

  useEffect(() => {
    const actualizar = () => setCantidad(leerCarrito().length);
    actualizar();
    window.addEventListener(EVENTO_CARRITO, actualizar);
    window.addEventListener('storage', actualizar); // otras pestañas
    return () => {
      window.removeEventListener(EVENTO_CARRITO, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);

  return (
    <Link
      href="/carrito"
      className={estilos.carrito}
      aria-label={
        cantidad === 0
          ? 'Carrito vacío'
          : `Carrito, ${cantidad} ${cantidad === 1 ? 'artículo' : 'artículos'}`
      }
    >
      <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" focusable="false">
        {/* Bolsa: dos trazos, sin relleno, del mismo grosor que las líneas del sitio. */}
        <path
          d="M1 5.5h14l-1 11.5H2L1 5.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M5 5.5V4a3 3 0 0 1 6 0v1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
      {/* El número también se lee en el aria-label, así que aquí sobra. */}
      <span className={estilos.contador} aria-hidden="true">
        {cantidad}
      </span>
    </Link>
  );
}
