import { formatearFecha } from '@/lib/formato';

/**
 * El estado se dice con palabras, nunca con un punto de color.
 * El tono acompaña; quien no distinga los dos grises lee lo mismo.
 *
 * Una pieza con una sola unidad es irrepetible y así se anuncia; con varias es
 * una edición, y ahí lo que importa es cuántas quedan.
 */
export function EstadoPieza({
  stock,
  soldAt,
}: {
  stock: number;
  soldAt: string | null;
}) {
  if (stock <= 0) {
    return (
      <span className="mayusculas tenue">
        Vendida{soldAt ? ` · ${formatearFecha(soldAt)}` : ''}
      </span>
    );
  }
  if (stock === 1) return <span className="mayusculas">Única</span>;
  return <span className="mayusculas">Quedan {stock}</span>;
}
