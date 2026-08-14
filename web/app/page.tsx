import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { PieceSummary } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { Precio } from '@/components/Precio';
import { EstadoPieza } from '@/components/EstadoPieza';
import estilos from './page.module.scss';

export const revalidate = 30;

export default async function Catalogo() {
  const piezas = await apiGet<PieceSummary[]>('/pieces');

  if (piezas.length === 0) {
    return <p className={estilos.vacio}>Aún no hay piezas publicadas.</p>;
  }

  return (
    <ul className={estilos.rejilla}>
      {piezas.map((pieza, i) => (
        <li key={pieza.slug}>
          <Link href={`/piezas/${pieza.slug}`}>
            {pieza.images[0] && (
              <Imagen publicId={pieza.images[0]} alt={pieza.title} priority={i < 2} />
            )}
            <div className={estilos.pie}>
              <span className="mayusculas">{pieza.title}</span>
              <Precio cop={pieza.priceCop} />
              {!pieza.available && <EstadoPieza available={false} soldAt={null} />}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
