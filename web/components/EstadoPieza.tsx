import { formatearFecha } from '@/lib/formato';

/**
 * El estado se dice con palabras, nunca con un punto de color.
 * El tono acompaña; quien no distinga los dos grises lee lo mismo.
 */
export function EstadoPieza({ available, soldAt }: { available: boolean; soldAt: string | null }) {
  if (available) return <span className="mayusculas">Disponible</span>;
  return (
    <span className="mayusculas tenue">
      Vendida{soldAt ? ` · ${formatearFecha(soldAt)}` : ''}
    </span>
  );
}
