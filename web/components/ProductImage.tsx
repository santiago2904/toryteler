import Image from 'next/image';

// The cloud name travels in every image URL: it is public by design. It ships
// as a default so a fresh deploy shows photos with no configuration; the
// environment variable still wins when defined.
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? 'dtiuqixet';

/** Widest image we ever serve. A phone photo arrives at 4000px nobody needs. */
const MAX_WIDTH = 1400;

type Fit = 'cover' | 'contain';

/**
 * Two framings, because a thumbnail and a detail photo do not want the same
 * thing:
 *
 * - `cover`: fixed ratio, the photo fills the frame. For the grid, where
 *   regularity matters more than seeing the whole piece.
 * - `contain`: the photo fits without cropping or upscaling. For the detail
 *   view, which receives phone and Osmo footage in wildly different ratios.
 *
 * Either way the space exists before the image loads: the layout never jumps.
 */
export function ProductImage({
  publicId,
  alt,
  priority = false,
  fit = 'cover',
  ratio = '1 / 1',
}: {
  publicId: string;
  alt: string;
  priority?: boolean;
  fit?: Fit;
  ratio?: string;
}) {
  const whole = fit === 'contain';
  const frame: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: whole ? '4 / 5' : ratio,
    maxHeight: whole ? '78vh' : undefined,
  };

  if (!CLOUD) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{ ...frame, border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}
      >
        <span className="label muted">{publicId}</span>
      </div>
    );
  }

  // c_limit shrinks an oversized photo but never enlarges a small one: it is
  // shown small rather than stretched and dirty.
  const src = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,c_limit,w_${MAX_WIDTH}/${publicId}`;

  return (
    <div style={frame}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        style={{ objectFit: whole ? 'contain' : 'cover', objectPosition: 'center' }}
        sizes={whole ? '(max-width: 900px) 100vw, 34rem' : '(max-width: 640px) 100vw, 33vw'}
      />
    </div>
  );
}
