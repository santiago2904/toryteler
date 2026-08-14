import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { AdminDrop, AdminPiece } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { StudioItemActions } from '@/components/StudioItemActions';
import { formatPrice } from '@/lib/format';
import styles from './studio.module.scss';

export const metadata: Metadata = { title: 'Publicado — Studio' };

/** The list changes the moment anything is saved. */
export const dynamic = 'force-dynamic';

export default async function PublishedPage({
  searchParams,
}: {
  searchParams: Promise<{ procesando?: string }>;
}) {
  const { procesando } = await searchParams;

  // The admin endpoints and not the public ones: a draft is invisible to the
  // shop by design, so saving one and never seeing it again would be the
  // obvious bug of doing this the easy way.
  const [pieces, videos] = await Promise.all([
    apiGet<AdminPiece[]>('/admin/pieces', true),
    apiGet<AdminDrop[]>('/admin/drops', true),
  ]);

  const drafts = [...pieces, ...videos].filter((item) => item.status !== 'available').length;

  return (
    <div className={styles.published}>
      {/* The video was saved but Cloudflare had not finished with it. Said here
          because publishing it now would sell a seat to a black screen. */}
      {procesando && (
        <p className={styles.notice}>
          El video quedó guardado, pero Cloudflare todavía lo está procesando. Espera unos
          minutos antes de publicarlo.
        </p>
      )}

      <div className={styles.actions}>
        <h1 className="label muted">
          {pieces.length} piezas · {videos.length} videos
          {drafts > 0 && ` · ${drafts} sin publicar`}
        </h1>
        <div className={styles.buttons}>
          <Link href="/studio/nuevo/pieza"><button type="button">Nueva pieza</button></Link>
          <Link href="/studio/nuevo/video"><button type="button">Nuevo video</button></Link>
        </div>
      </div>

      <section className={styles.listGroup}>
        <h2 className="label muted">Piezas</h2>
        <ul>
          {pieces.map((piece) => (
            <li key={piece.slug} className={styles.item}>
              <div className={styles.thumb}>
                {piece.images[0] && <ProductImage publicId={piece.images[0]} alt={piece.title} />}
              </div>

              <div className={styles.meta}>
                <Link
                  href={piece.status === 'available' ? `/piezas/${piece.slug}` : `/studio/pieza/${piece.slug}`}
                  className="label"
                >
                  {piece.title}
                </Link>
                <span>{formatPrice(piece.priceCop)}</span>
                <span className="label muted">
                  {piece.status !== 'available' && 'Sin publicar · '}
                  {piece.stock === 0
                    ? 'Agotada'
                    : piece.stock === 1
                      ? 'Última unidad'
                      : `${piece.stock} unidades`}
                  {piece.sold > 0 && ` · ${piece.sold} vendida${piece.sold === 1 ? '' : 's'}`}
                </span>
              </div>

              <StudioItemActions
                kind="piece"
                id={piece.id}
                slug={piece.slug}
                title={piece.title}
                listed={piece.status === 'available'}
                left={piece.stock}
                sold={piece.sold}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.listGroup}>
        <h2 className="label muted">Videos</h2>
        <ul>
          {videos.map((video) => (
            <li key={video.slug} className={styles.item}>
              <div className={styles.thumb}>
                {video.posterImage && (
                  <ProductImage publicId={video.posterImage} alt={video.title} />
                )}
              </div>

              <div className={styles.meta}>
                <Link
                  href={video.status === 'available' ? `/drops/${video.slug}` : `/studio/video/${video.slug}`}
                  className="label"
                >
                  {video.title}
                </Link>
                <span>{formatPrice(video.priceCop)}</span>
                <span className="label muted">
                  {video.status !== 'available' && 'Sin publicar · '}
                  {video.capacity === null
                    ? 'Sin límite de cupos'
                    : video.sold >= video.capacity
                      ? 'Agotado'
                      : `${video.capacity - video.sold} de ${video.capacity} cupos`}
                  {' · '}
                  ventana de {video.viewWindowHours} h
                </span>
              </div>

              <StudioItemActions
                kind="video"
                id={video.id}
                slug={video.slug}
                title={video.title}
                listed={video.status === 'available'}
                left={video.capacity === null ? null : video.capacity - video.sold}
                sold={video.sold}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
