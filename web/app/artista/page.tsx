import type { Metadata } from 'next';
import { ProductImage } from '@/components/ProductImage';
import { ARTIST } from '@/lib/artist';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Toryteler — quién es',
  description: 'Quién es el artista detrás de las piezas.',
};

export default function ArtistPage() {
  return (
    <article className={styles.artist}>
      <div className={styles.portrait}>
        <ProductImage
          publicId={ARTIST.portrait}
          alt={`Retrato de ${ARTIST.name}`}
          priority
          fit="contain"
        />
      </div>

      <div className={styles.text}>
        <h1 className="title">{ARTIST.name}</h1>
        <p className="label muted">{ARTIST.role}</p>

        {ARTIST.bio.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className={styles.paragraph}>{paragraph}</p>
        ))}

        <section className={styles.block}>
          <h2 className="label muted">Dónde encontrarlo</h2>
          <ul className={styles.socials}>
            {ARTIST.socials.map((social) => (
              <li key={social.name}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label"
                >
                  {social.name}
                </a>{' '}
                <span className="muted">{social.handle}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.block}>
          <h2 className="label muted">Contacto</h2>
          <p>
            <a href={`mailto:${ARTIST.email}`}>{ARTIST.email}</a>
          </p>
          <p className="muted">{ARTIST.location}</p>
        </section>
      </div>
    </article>
  );
}
