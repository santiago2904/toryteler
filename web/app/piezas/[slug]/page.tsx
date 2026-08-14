import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
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
          <EstadoPieza available={pieza.available} soldAt={pieza.soldAt} />
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
          <Link href={`/checkout?pieza=${pieza.slug}`} className={estilos.accion}>
            <button type="button">Comprar</button>
          </Link>
        ) : (
          <p className="mayusculas tenue">Esta pieza ya encontró dueño.</p>
        )}
      </div>
    </article>
  );
}
