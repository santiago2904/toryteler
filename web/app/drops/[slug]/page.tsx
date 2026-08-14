import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BotonCarrito } from '@/components/BotonCarrito';
import { apiGet } from '@/lib/api';
import { DropDetail } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { Precio } from '@/components/Precio';
import { EstadoDrop } from '@/components/EstadoDrop';
import estilos from './page.module.scss';

async function cargar(slug: string): Promise<DropDetail | null> {
  try {
    return await apiGet<DropDetail>(`/drops/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const drop = await cargar(slug);
  if (!drop) return { title: 'No encontrado' };
  return {
    title: `${drop.title} — Toryteler`,
    description: drop.description ?? undefined,
  };
}

export default async function Drop({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const drop = await cargar(slug);
  if (!drop) notFound();

  const horas = drop.viewWindowHours;

  return (
    <article className={estilos.drop}>
      {drop.posterImage && (
        <div className={estilos.poster}>
          <Imagen publicId={drop.posterImage} alt={drop.title} priority encuadre="completa" />
        </div>
      )}

      <div className={estilos.ficha}>
        <p className="mayusculas tenue">Video</p>
        <h1 className="titulo">{drop.title}</h1>

        <div className={estilos.datos}>
          <Precio cop={drop.priceCop} />
          <EstadoDrop remaining={drop.remaining} soldOut={drop.soldOut} />
        </div>

        {drop.description && <p className={estilos.parrafo}>{drop.description}</p>}

        {/* Las condiciones son la mitad del producto: no pueden estar en letra
            pequeña ni después del pago. */}
        <section className={estilos.condiciones}>
          <h2 className="mayusculas tenue">Cómo funciona</h2>
          <ul className={estilos.lista}>
            {drop.capacity !== null && (
              <li>Solo {drop.capacity} personas pueden comprarlo. Cuando se acabe, se acabó.</li>
            )}
            <li>
              Se ve una sola vez. Al darle play se abre una ventana de {horas} horas y dentro de
              ella puedes salir y volver las veces que quieras.
            </li>
            <li>Cuando la ventana se cierra, el video no vuelve a abrirse para ti.</li>
            <li>No se puede descargar ni regalar.</li>
          </ul>
        </section>

        {drop.soldOut ? (
          <p className="mayusculas tenue">Ya no quedan cupos.</p>
        ) : (
          <div className={estilos.accion}>
            <BotonCarrito
              linea={{
                kind: 'drop',
                slug: drop.slug,
                title: drop.title,
                image: drop.posterImage,
                priceCop: drop.priceCop,
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
