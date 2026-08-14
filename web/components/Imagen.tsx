import Image from 'next/image';

// El nombre de la cuenta viaja en cada URL de imagen: es público por diseño.
// Va como valor por defecto para que un despliegue nuevo muestre las fotos sin
// configurar nada; la variable sigue mandando si se define.
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? 'dtiuqixet';

/** Ancho máximo que servimos. Una foto de celular trae 4000 px que nadie necesita. */
const ANCHO_MAXIMO = 1400;

type Encuadre = 'recorte' | 'completa';

/**
 * Dos encuadres, porque una miniatura y una foto de detalle no quieren lo mismo:
 *
 * - `recorte`: proporción fija y la foto llena el marco. Para la rejilla, donde
 *   la regularidad importa más que ver la pieza entera.
 * - `completa`: la foto entra sin recortarse ni ampliarse. Para el detalle,
 *   donde llega material de cámara de celular u Osmo con proporciones dispares.
 *
 * En ambos casos el hueco existe antes de que cargue la imagen: el layout
 * nunca salta.
 */
export function Imagen({
  publicId,
  alt,
  priority = false,
  encuadre = 'recorte',
  proporcion = '1 / 1',
}: {
  publicId: string;
  alt: string;
  priority?: boolean;
  encuadre?: Encuadre;
  proporcion?: string;
}) {
  const completa = encuadre === 'completa';
  const marco: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: completa ? '4 / 5' : proporcion,
    maxHeight: completa ? '78vh' : undefined,
  };

  if (!CLOUD) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{ ...marco, border: '1px solid var(--linea)', display: 'grid', placeItems: 'center' }}
      >
        <span className="mayusculas tenue">{publicId}</span>
      </div>
    );
  }

  // c_limit reduce si la foto es más grande, pero nunca la amplía:
  // una imagen pequeña se muestra pequeña en vez de estirada y sucia.
  const src = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,c_limit,w_${ANCHO_MAXIMO}/${publicId}`;

  return (
    <div style={marco}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        style={{ objectFit: completa ? 'contain' : 'cover', objectPosition: 'center' }}
        sizes={completa ? '(max-width: 900px) 100vw, 34rem' : '(max-width: 640px) 100vw, 33vw'}
      />
    </div>
  );
}
