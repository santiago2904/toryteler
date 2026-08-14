import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BotonCarrito } from '@/components/BotonCarrito';
import { apiGet } from '@/lib/api';
import { PieceDetail } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { Precio } from '@/components/Precio';
import { EstadoPieza } from '@/components/EstadoPieza';
import estilos from './page.module.scss';

async function cargar(slug: string): Promise<PieceDetail | null> {
  try {
    return await apiGet<PieceDetail>(`/pieces/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const pieza = await cargar(slug);
  if (!pieza) return { title: 'Pieza no encontrada' };
  return {
    title: `${pieza.title} — Toryteler`,
    description: pieza.description ?? undefined,
  };
}

export default async function Pieza({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pieza = await cargar(slug);
  if (!pieza) notFound();

  return (
    <article className={estilos.pieza}>
      <div className={estilos.imagenes}>
        {pieza.images.map((id, i) => (
          <Imagen
            key={id}
            publicId={id}
            alt={`${pieza.title} — imagen ${i + 1}`}
            priority={i === 0}
            encuadre="completa"
          />
        ))}
      </div>

      <div className={estilos.ficha}>
        <h1 className="titulo">{pieza.title}</h1>

        <div className={estilos.datos}>
          <Precio cop={pieza.priceCop} />
          <EstadoPieza stock={pieza.stock} soldAt={pieza.soldAt} />
        </div>

        {pieza.description && <p className={estilos.parrafo}>{pieza.description}</p>}

        {pieza.story && (
          <section className={estilos.procedencia}>
            <h2 className="mayusculas tenue">Procedencia</h2>
            <p className={estilos.parrafo}>{pieza.story}</p>
          </section>
        )}

        <p className={`${estilos.parrafo} tenue`}>
          Incluye una nota escrita por el artista y el contrato de compraventa firmado.
        </p>

        {pieza.available ? (
          <div className={estilos.accion}>
            <BotonCarrito
              linea={{
                kind: 'piece',
                slug: pieza.slug,
                title: pieza.title,
                image: pieza.images[0] ?? null,
                priceCop: pieza.priceCop,
              }}
            />
          </div>
        ) : (
          <p className="mayusculas tenue">
            {pieza.stock === 0 && pieza.soldAt ? 'Esta pieza ya encontró dueño.' : 'No está a la venta.'}
          </p>
        )}
      </div>
    </article>
  );
}
