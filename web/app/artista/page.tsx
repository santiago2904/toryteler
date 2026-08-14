import type { Metadata } from 'next';
import { Imagen } from '@/components/Imagen';
import { ARTISTA } from '@/lib/artista';
import estilos from './page.module.scss';

export const metadata: Metadata = {
  title: 'Toryteler — quién es',
  description: 'Quién es el artista detrás de las piezas.',
};

export default function Artista() {
  return (
    <article className={estilos.artista}>
      <div className={estilos.retrato}>
        <Imagen
          publicId={ARTISTA.retrato}
          alt={`Retrato de ${ARTISTA.nombre}`}
          priority
          encuadre="completa"
        />
      </div>

      <div className={estilos.texto}>
        <h1 className="titulo">{ARTISTA.nombre}</h1>
        <p className="mayusculas tenue">{ARTISTA.oficio}</p>

        {ARTISTA.bio.map((parrafo) => (
          <p key={parrafo.slice(0, 24)} className={estilos.parrafo}>{parrafo}</p>
        ))}

        <section className={estilos.bloque}>
          <h2 className="mayusculas tenue">Dónde encontrarlo</h2>
          <ul className={estilos.redes}>
            {ARTISTA.redes.map((red) => (
              <li key={red.nombre}>
                <a
                  href={red.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mayusculas"
                >
                  {red.nombre}
                </a>{' '}
                <span className="tenue">{red.usuario}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={estilos.bloque}>
          <h2 className="mayusculas tenue">Contacto</h2>
          <p>
            <a href={`mailto:${ARTISTA.correo}`}>{ARTISTA.correo}</a>
          </p>
          <p className="tenue">{ARTISTA.ubicacion}</p>
        </section>
      </div>
    </article>
  );
}
