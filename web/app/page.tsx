import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { DropDetail, PieceSummary } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { Precio } from '@/components/Precio';
import { EstadoPieza } from '@/components/EstadoPieza';
import { EstadoDrop } from '@/components/EstadoDrop';
import estilos from './page.module.scss';

export const revalidate = 30;

export default async function Catalogo() {
  const [piezas, drops] = await Promise.all([
    apiGet<PieceSummary[]>('/pieces'),
    apiGet<DropDetail[]>('/drops'),
  ]);

  if (piezas.length === 0 && drops.length === 0) {
    return <p className={estilos.vacio}>Aún no hay nada publicado.</p>;
  }

  return (
    <>
      {/* Los videos van arriba y en su propia franja: son pocos, se compran de
          otra manera y se agotan. Mezclarlos en la rejilla los escondería. */}
      {drops.length > 0 && (
        <section className={estilos.franja}>
          <h2 className="mayusculas tenue">Videos</h2>
          <ul className={estilos.drops}>
            {drops.map((drop) => (
              <li key={drop.slug}>
                <Link href={`/drops/${drop.slug}`} className={estilos.drop}>
                  {drop.posterImage && (
                    <div className={estilos.miniatura}>
                      <Imagen publicId={drop.posterImage} alt={drop.title} />
                    </div>
                  )}
                  <div className={estilos.pieDrop}>
                    <span className="mayusculas">{drop.title}</span>
                    <Precio cop={drop.priceCop} />
                    <EstadoDrop remaining={drop.remaining} soldOut={drop.soldOut} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className={estilos.rejilla}>
        {piezas.map((pieza, i) => (
          <li key={pieza.slug}>
            <Link href={`/piezas/${pieza.slug}`}>
              {pieza.images[0] && (
                // El nombre va solo en la foto, no en la tarjeta: si envolviera
                // también el título y el precio, el navegador escalaría ese texto
                // como si fuera una imagen y se vería estirado y borroso.
                <div style={{ viewTransitionName: `pieza-${pieza.slug}` }}>
                  <Imagen publicId={pieza.images[0]} alt={pieza.title} priority={i < 2} />
                </div>
              )}
              <div className={estilos.pie}>
                <span className="mayusculas">{pieza.title}</span>
                <Precio cop={pieza.priceCop} />
                {pieza.stock !== 1 && <EstadoPieza stock={pieza.stock} soldAt={null} />}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
