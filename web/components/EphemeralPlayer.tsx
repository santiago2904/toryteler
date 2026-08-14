'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { formatDate, timeLeft } from '@/lib/format';
import { openPlayback } from '@/lib/playback-actions';
import styles from './EphemeralPlayer.module.scss';

interface Props {
  entitlementId: string;
  title: string;
  posterImage: string | null;
  posterUrl: string | null;
  dropSlug: string;
  windowHours: number;
  viewerEmail: string;
  /** From the API. The mock lets the window be opened here to see the states. */
  firstPlayedAt: string | null;
  expiresAt: string | null;
}

/** lazy: opening the window is stored in the browser so the three states can be
 *  walked through without an API. The real endpoint is POST /entitlements/:id/play. */
const MOCK_KEY = (id: string) => `mock-play:${id}`;

export function EphemeralPlayer({
  entitlementId, title, posterImage, posterUrl, dropSlug, windowHours, viewerEmail,
  firstPlayedAt, expiresAt,
}: Props) {
  // The real state comes from the server, so the right screen renders on the
  // first paint. Only the simulated opening lives in the browser, and that
  // disappears with the mock.
  const [openedAt, setOpenedAt] = useState<number | null>(
    firstPlayedAt ? new Date(firstPlayedAt).getTime() : null,
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // The URL is requested, never handed over up front: a page rendered for
  // someone who has not opened their window must not contain it.
  const requestPlayback = useCallback(async () => {
    const { videoUrl: url, error } = await openPlayback(entitlementId, dropSlug);
    if (url) setVideoUrl(url);
    else if (error) setPlaybackError(error);
  }, [entitlementId, dropSlug]);

  useEffect(() => {
    if (firstPlayedAt) return;
    const stored = localStorage.getItem(MOCK_KEY(entitlementId));
    if (stored) setOpenedAt(Number(stored));
  }, [entitlementId, firstPlayedAt]);

  // Already inside the window on arrival: ask for the video straight away.
  useEffect(() => {
    if (openedAt !== null && videoUrl === null) void requestPlayback();
  }, [openedAt, videoUrl, requestPlayback]);

  // The countdown has to move on its own: a static number reads as decoration.
  useEffect(() => {
    if (openedAt === null) return;
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [openedAt]);

  async function play() {
    const now = Date.now();
    localStorage.setItem(MOCK_KEY(entitlementId), String(now));
    setOpenedAt(now);
    await requestPlayback();
  }

  const closesAt = expiresAt
    ? new Date(expiresAt).getTime()
    : openedAt !== null
      ? openedAt + windowHours * 3600_000
      : null;

  const closed = closesAt !== null && closesAt <= Date.now();

  if (closed) {
    return (
      <section className={styles.notice}>
        <h1 className="label muted">{title}</h1>
        <p className="title">Tu ventana se cerró.</p>
        <p>
          Lo viste el {formatDate(new Date(openedAt!).toISOString())}. Este video no vuelve a
          abrirse: era una sola vez.
        </p>
        <Link href="/cuenta" className="label">Volver a mi cuenta</Link>
      </section>
    );
  }

  if (openedAt === null) {
    return (
      <section className={styles.notice}>
        <h1 className="label muted">{title}</h1>
        <p className="title">Antes de reproducir</p>
        <p>
          Al darle play se abre tu ventana de {windowHours} horas. Dentro de ese tiempo puedes
          salir y volver las veces que quieras, desde el teléfono o el computador.
        </p>
        <p>Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez.</p>
        <button type="button" onClick={() => void play()}>Entiendo, reproducir</button>
      </section>
    );
  }

  return (
    <section className={styles.player}>
      <div className={styles.frame}>
        {videoUrl ? (
          <video
            src={videoUrl}
            poster={posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
            // Neither of these stops anything: they remove the obvious download
            // button. Screen recording is impossible to prevent and we say so.
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            className={styles.video}
          />
        ) : (
          <>
            {posterImage && (
              <ProductImage publicId={posterImage} alt={title} fit="contain" priority />
            )}
            <div className={styles.placeholder}>
              <span className="label">{playbackError ?? 'Cargando…'}</span>
            </div>
          </>
        )}

        {/* Watermark: it does not stop a screen recording, it makes sharing one
            traceable. It is presented as exactly that. */}
        <span className={styles.watermark} aria-hidden="true">{viewerEmail}</span>
      </div>

      <div className={styles.meta}>
        <span className="label">{title}</span>
        <span className="label muted">Se cierra en {timeLeft(new Date(closesAt!).toISOString())}</span>
      </div>
    </section>
  );
}
