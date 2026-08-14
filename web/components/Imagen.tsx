import Image from 'next/image';

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD;

/**
 * Sin cuenta de Cloudinary configurada, dibuja un marcador con la proporción
 * correcta: así el layout se ve real antes de tener fotos.
 */
export function Imagen({ publicId, alt, priority = false }: {
  publicId: string; alt: string; priority?: boolean;
}) {
  if (!CLOUD) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{
          width: '100%',
          aspectRatio: '3 / 4',
          border: '1px solid var(--linea)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span className="mayusculas tenue">{publicId}</span>
      </div>
    );
  }

  return (
    <Image
      src={`https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${publicId}`}
      alt={alt}
      width={1200}
      height={1600}
      priority={priority}
      style={{ width: '100%', height: 'auto' }}
      sizes="(max-width: 640px) 100vw, 50vw"
    />
  );
}
