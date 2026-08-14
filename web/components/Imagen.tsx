import Image from 'next/image';

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD;

/**
 * La proporción la fija el contenedor, no la imagen: así el layout nunca salta
 * mientras carga. Sin cuenta de Cloudinary configurada, dibuja un marcador con
 * esa misma proporción para poder maquetar sin fotos.
 */
export function Imagen({
  publicId,
  alt,
  priority = false,
  proporcion = '1 / 1',
}: {
  publicId: string;
  alt: string;
  priority?: boolean;
  proporcion?: string;
}) {
  if (!CLOUD) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{
          width: '100%',
          aspectRatio: proporcion,
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
    <div style={{ position: 'relative', width: '100%', aspectRatio: proporcion }}>
      <Image
        src={`https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${publicId}`}
        alt={alt}
        fill
        priority={priority}
        style={{ objectFit: 'cover' }}
        sizes="(max-width: 640px) 100vw, 50vw"
      />
    </div>
  );
}
