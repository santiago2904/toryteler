'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  poster?: string;
  className?: string;
  onError?: (message: string) => void;
}

/**
 * A <video> that also plays HLS.
 *
 * Cloudflare Stream serves a manifest, and only Safari plays one natively —
 * everywhere else the tag stays black with no error worth reading. hls.js
 * fills that gap, and it is imported inside the effect so the browsers that
 * do not need it never download it, and neither does any other screen.
 *
 * Adaptive streaming is also the reason not to serve a plain MP4: a file is a
 * file, and one that plays is one that can be kept.
 */
export function HlsVideo({ src, poster, className, onError }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    const isHls = src.includes('.m3u8');
    const nativeHls = element.canPlayType('application/vnd.apple.mpegurl') !== '';

    // Safari, or an ordinary file: the tag handles it.
    if (!isHls || nativeHls) {
      element.src = src;
      return;
    }

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    void (async () => {
      const { default: Hls } = await import('hls.js');
      if (cancelled || !Hls.isSupported()) {
        if (!cancelled) {
          setFailed(true);
          onError?.('Tu navegador no puede reproducir este video.');
        }
        return;
      }

      const hls = new Hls({ enableWorker: true });
      instance = hls;
      hls.loadSource(src);
      hls.attachMedia(element);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        // Only fatal ones matter: hls.js recovers from the rest by itself, and
        // reporting those would blame the network for a hiccup nobody saw.
        if (!data.fatal) return;
        setFailed(true);
        onError?.('Se interrumpió la reproducción. Vuelve a intentarlo.');
      });
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [src, onError]);

  return (
    <video
      ref={video}
      poster={poster}
      controls
      autoPlay
      playsInline
      // Neither of these stops anything: they remove the obvious download
      // button. Screen recording is impossible to prevent and we say so.
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      className={className}
      aria-invalid={failed || undefined}
    />
  );
}
