import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { DropDetail, PieceSummary } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { Price } from '@/components/Price';
import { PieceStatus } from '@/components/PieceStatus';
import { DropStatus } from '@/components/DropStatus';
import styles from './page.module.scss';

export const revalidate = 30;

export default async function Catalog() {
  const [pieces, drops] = await Promise.all([
    apiGet<PieceSummary[]>('/pieces'),
    apiGet<DropDetail[]>('/drops'),
  ]);

  if (pieces.length === 0 && drops.length === 0) {
    return <p className={styles.empty}>Aún no hay nada publicado.</p>;
  }

  return (
    <>
      {/* Videos go on top, in their own strip: there are few of them, they are
          bought differently and they run out. Mixed into the grid they would
          simply disappear. */}
      {drops.length > 0 && (
        <section className={styles.strip}>
          <h2 className="label muted">Videos</h2>
          <ul className={styles.drops}>
            {drops.map((drop) => (
              <li key={drop.slug}>
                <Link href={`/drops/${drop.slug}`} className={styles.drop}>
                  {drop.posterImage && (
                    <div className={styles.thumb}>
                      <ProductImage publicId={drop.posterImage} alt={drop.title} />
                    </div>
                  )}
                  <div className={styles.dropMeta}>
                    <span className="label">{drop.title}</span>
                    <Price usdCents={drop.priceUsdCents} />
                    <DropStatus remaining={drop.remaining} soldOut={drop.soldOut} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className={styles.grid}>
        {pieces.map((piece, i) => (
          <li key={piece.slug}>
            <Link href={`/piezas/${piece.slug}`}>
              {piece.images[0] && (
                // The name goes on the photo alone, not the card: wrapping the
                // title and price too would make the browser scale that text as
                // if it were an image, leaving it stretched and blurry.
                <div style={{ viewTransitionName: `pieza-${piece.slug}` }}>
                  <ProductImage publicId={piece.images[0]} alt={piece.title} priority={i < 2} />
                </div>
              )}
              <div className={styles.footer}>
                <span className="label">{piece.title}</span>
                <Price usdCents={piece.priceUsdCents} />
                {piece.stock !== 1 && <PieceStatus stock={piece.stock} soldAt={null} />}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
