'use client';

import { useEffect, useState } from 'react';
import { framePreview } from '@/lib/studio-actions';
import styles from './PosterPicker.module.scss';

interface Props {
  uid: string;
  durationSeconds: number | null;
  seconds: number;
  onChange: (seconds: number) => void;
}

/**
 * Picks the frame that becomes the video's cover.
 *
 * The frame is fetched through the API and not from Cloudflare directly: the
 * video is protected, so its thumbnails answer 401, and giving the browser a
 * signed URL for them would be giving it a key to the video.
 *
 * The image arrives as a data URI. It is one frame, a few kilobytes, and it
 * spares a second authenticated route just to serve bytes.
 */
export function PosterPicker({ uid, durationSeconds, seconds, onChange }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Dragging the slider would otherwise ask for a frame per pixel.
    const timer = setTimeout(async () => {
      const result = await framePreview(uid, seconds);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) { setImage(result.data); setError(null); }
      else setError(result.error);
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [uid, seconds]);

  const max = Math.max(1, Math.floor(durationSeconds ?? 60));

  return (
    <div className={styles.picker}>
      <div className={styles.frame} data-loading={loading || undefined}>
        {image && <img src={image} alt={`Fotograma del segundo ${seconds}`} />}
        {!image && <span className="label muted">{error ?? 'Cargando…'}</span>}
      </div>

      <label htmlFor="momento" className="label muted">
        Momento del video: {seconds}s de {max}s
      </label>
      <input
        id="momento"
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(seconds, max)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
