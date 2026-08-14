'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Imagen } from '@/components/Imagen';
import { formatearPrecio } from '@/lib/formato';
import { EVENTO_CARRITO, LineaCarrito, leerCarrito, quitar, totalCop } from '@/lib/carrito';
import estilos from './page.module.scss';

export default function CarritoPagina() {
  const [lineas, setLineas] = useState<LineaCarrito[] | null>(null);

  useEffect(() => {
    const actualizar = () => setLineas(leerCarrito());
    actualizar();
    window.addEventListener(EVENTO_CARRITO, actualizar);
    return () => window.removeEventListener(EVENTO_CARRITO, actualizar);
  }, []);

  // null mientras no se ha leído el navegador: mostrar «vacío» antes de saberlo
  // haría parpadear el mensaje en cada visita con carrito lleno.
  if (lineas === null) return <div className={estilos.carrito} />;

  if (lineas.length === 0) {
    return (
      <div className={estilos.carrito}>
        <h1 className="mayusculas tenue">Carrito</h1>
        <p>No tienes nada en el carrito.</p>
        <Link href="/" className="mayusculas">Ver la casa de Tory</Link>
      </div>
    );
  }

  const hayPieza = lineas.some((l) => l.kind === 'piece');

  return (
    <div className={estilos.carrito}>
      <h1 className="mayusculas tenue">Carrito</h1>

      <ul className={estilos.lista}>
        {lineas.map((linea) => (
          <li key={`${linea.kind}-${linea.slug}`} className={estilos.linea}>
            <div className={estilos.miniatura}>
              {linea.image && <Imagen publicId={linea.image} alt={linea.title} />}
            </div>

            <div className={estilos.datos}>
              <Link
                href={`/${linea.kind === 'piece' ? 'piezas' : 'drops'}/${linea.slug}`}
                className="mayusculas"
              >
                {linea.title}
              </Link>
              <span className="tenue mayusculas">
                {linea.kind === 'piece' ? 'Pieza única' : 'Video'}
              </span>
              <span>{formatearPrecio(linea.priceCop)}</span>
            </div>

            <button
              type="button"
              className="enlace"
              onClick={() => quitar(linea.kind, linea.slug)}
              aria-label={`Quitar ${linea.title} del carrito`}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <div className={estilos.total}>
        <span className="mayusculas">Total</span>
        <span className="mayusculas">{formatearPrecio(totalCop(lineas))}</span>
      </div>

      {hayPieza && (
        <p className="tenue">
          Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu
          cédula a mano.
        </p>
      )}

      {/* lazy: el checkout necesita la API para reservar las piezas y cobrar. */}
      <button type="button" disabled>Pagar</button>
      <p className="tenue">El pago estará disponible cuando conectemos la tienda.</p>
    </div>
  );
}
