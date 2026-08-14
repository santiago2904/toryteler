'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Entrar a una pieza desliza hacia la izquierda (avanzas); volver desliza hacia
 * la derecha (retrocedes). La dirección no se adivina por la ruta: se escucha
 * `popstate`, que es el único evento que distingue de verdad un «atrás» del
 * navegador de un clic normal.
 */
export function TransicionPagina({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const [direccion, setDireccion] = useState<'adelante' | 'atras'>('adelante');
  const volviendo = useRef(false);

  useEffect(() => {
    const alVolver = () => { volviendo.current = true; };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  useEffect(() => {
    setDireccion(volviendo.current ? 'atras' : 'adelante');
    volviendo.current = false;
  }, [ruta]);

  return (
    // La clave por ruta fuerza el remontaje, y con él la animación de entrada.
    <main key={ruta} data-direccion={direccion} className="transicion">
      {children}
    </main>
  );
}
