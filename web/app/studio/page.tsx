import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { DropDetail, PieceSummary } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { formatPrice } from '@/lib/format';
import styles from './studio.module.scss';

export const metadata: Metadata = { title: 'Publicado — Studio' };

export default async function PublishedPage() {
  const [pieces, videos] = await Promise.all([
    apiGet<PieceSummary[]>('/pieces'),
    apiGet<DropDetail[]>('/drops'),
  ]);

  return (
    <div className={styles.published}>
      <div className={styles.actions}>
        <h1 className="label muted">
          {pieces.length} pieces · {videos.length} videos
        </h1>
        <div className={styles.buttons}>
          <Link href="/studio/nuevo/pieza"><button type="button">Nueva pieza</button></Link>
          <Link href="/studio/nuevo/video"><button type="button">Nuevo video</button></Link>
        </div>
      </div>

      <section className={styles.listGroup}>
        <h2 className="label muted">Piezas</h2>
        <ul className={styles.orderList}>
          {pieces.map((piece) => (
            <li key={piece.slug} className={styles.item}>
              <div className={styles.thumb}>
                {piece.images[0] && <ProductImage publicId={piece.images[0]} alt={piece.title} />}
              </div>

              <div className={styles.meta}>
                <Link href={`/piezas/${piece.slug}`} className="label">{piece.title}</Link>
                <span>{formatPrice(piece.priceCop)}</span>
                <span className="label muted">
                  {piece.stock === 0
                    ? 'Agotada'
                    : piece.stock === 1
                      ? 'Última unidad'
                      : `${piece.stock} unidades`}
                </span>
              </div>

              <div className={styles.manage}>
                <button type="button" className="link-button" disabled>Editar</button>
                <button type="button" className="link-button" disabled>Despublicar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.listGroup}>
        <h2 className="label muted">Videos</h2>
        <ul className={styles.orderList}>
          {videos.map((video) => (
            <li key={video.slug} className={styles.item}>
              <div className={styles.thumb}>
                {video.posterImage && <ProductImage publicId={video.posterImage} alt={video.title} />}
              </div>

              <div className={styles.meta}>
                <Link href={`/drops/${video.slug}`} className="label">{video.title}</Link>
                <span>{formatPrice(video.priceCop)}</span>
                <span className="label muted">
                  {video.soldOut
                    ? 'Agotado'
                    : video.capacity === null
                      ? 'Sin límite de cupos'
                      : `${video.remaining} de ${video.capacity} cupos`}
                  {' · '}
                  windowHours de {video.viewWindowHours} h
                </span>
              </div>

              <div className={styles.manage}>
                <button type="button" className="link-button" disabled>Editar</button>
                <button type="button" className="link-button" disabled>Despublicar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
