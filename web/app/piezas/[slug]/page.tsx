import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AddToCart } from '@/components/AddToCart';
import { apiGet } from '@/lib/api';
import { content } from '@/lib/content';
import { PieceDetail } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { Price } from '@/components/Price';
import { PieceStatus } from '@/components/PieceStatus';
import styles from './page.module.scss';

async function load(slug: string): Promise<PieceDetail | null> {
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
  const piece = await load(slug);
  if (!piece) return { title: 'Pieza no encontrada' };
  return {
    title: `${piece.title} — Toryteler`,
    description: piece.description ?? undefined,
  };
}

export default async function PiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const piece = await load(slug);
  if (!piece) notFound();

  const [includesNote, soldBody, notForSaleBody] = await Promise.all([
    content(
      'piece.detail.includesNote',
      'Incluye una nota escrita por el artista y el contrato de compraventa firmado.',
    ),
    content('piece.detail.soldBody', 'Esta pieza ya encontró dueño.'),
    content('piece.detail.notForSaleBody', 'No está a la venta.'),
  ]);

  return (
    <article className={styles.piece}>
      <div className={styles.images}>
        {piece.images.map((id, i) => (
          <ProductImage
            key={id}
            publicId={id}
            alt={`${piece.title} — imagen ${i + 1}`}
            priority={i === 0}
            fit="contain"
          />
        ))}
      </div>

      <div className={styles.details}>
        <h1 className="title">{piece.title}</h1>

        <div className={styles.meta}>
          <Price usdCents={piece.priceUsdCents} />
          <PieceStatus stock={piece.stock} soldAt={piece.soldAt} />
        </div>

        {piece.description && <p className={styles.paragraph}>{piece.description}</p>}

        {piece.story && (
          <section className={styles.provenance}>
            <h2 className="label muted">Procedencia</h2>
            <p className={styles.paragraph}>{piece.story}</p>
          </section>
        )}

        <p className={`${styles.paragraph} muted`}>{includesNote}</p>

        {piece.available ? (
          <div className={styles.action}>
            <AddToCart
              line={{
                kind: 'piece',
                slug: piece.slug,
                title: piece.title,
                image: piece.images[0] ?? null,
                priceUsdCents: piece.priceUsdCents,
              }}
            />
          </div>
        ) : (
          <p className="label muted">
            {piece.stock === 0 && piece.soldAt ? soldBody : notForSaleBody}
          </p>
        )}
      </div>
    </article>
  );
}
