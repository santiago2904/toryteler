import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AddToCart } from '@/components/AddToCart';
import { apiGet } from '@/lib/api';
import { content } from '@/lib/content';
import { DropDetail } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { Price } from '@/components/Price';
import { DropStatus } from '@/components/DropStatus';
import styles from './page.module.scss';

async function load(slug: string): Promise<DropDetail | null> {
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
  const drop = await load(slug);
  if (!drop) return { title: 'No encontrado' };
  return {
    title: `${drop.title} — Toryteler`,
    description: drop.description ?? undefined,
  };
}

export default async function DropPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const drop = await load(slug);
  if (!drop) notFound();

  const soldOutBody = await content('drop.detail.soldOutBody', 'Ya no quedan seats.');

  const hours = drop.viewWindowHours;

  return (
    <article className={styles.drop}>
      {drop.posterImage && (
        <div className={styles.poster}>
          <ProductImage publicId={drop.posterImage} alt={drop.title} priority fit="contain" />
        </div>
      )}

      <div className={styles.details}>
        <p className="label muted">Video</p>
        <h1 className="title">{drop.title}</h1>

        <div className={styles.meta}>
          <Price usdCents={drop.priceUsdCents} />
          <DropStatus remaining={drop.remaining} soldOut={drop.soldOut} />
        </div>

        {drop.description && <p className={styles.paragraph}>{drop.description}</p>}

        {/* Las condiciones son la mitad del producto: no pueden estar en letra
            pequeña ni después del pago. */}
        <section className={styles.terms}>
          <h2 className="label muted">Cómo funciona</h2>
          <ul className={styles.list}>
            {drop.capacity !== null && (
              <li>Solo {drop.capacity} personas pueden comprarlo. Cuando se acabe, se acabó.</li>
            )}
            <li>
              Se ve una sola vez. Al darle play se abre una ventana de {hours} horas y dentro de
              ella puedes salir y volver las veces que quieras.
            </li>
            <li>Cuando la ventana se cierra, el video no vuelve a abrirse para ti.</li>
            <li>No se puede descargar ni regalar.</li>
          </ul>
        </section>

        {drop.soldOut ? (
          <p className="label muted">{soldOutBody}</p>
        ) : (
          <div className={styles.action}>
            <AddToCart
              line={{
                kind: 'drop',
                slug: drop.slug,
                title: drop.title,
                image: drop.posterImage,
                priceUsdCents: drop.priceUsdCents,
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
