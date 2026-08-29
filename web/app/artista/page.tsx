import type { Metadata } from 'next';
import { ProductImage } from '@/components/ProductImage';
import { content } from '@/lib/content';
import { ARTIST } from '@/lib/artist';
import styles from './page.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await content('artist.meta.title', 'Toryteler — quién es'),
    description: await content('artist.meta.description', 'Quién es el artista detrás de las piezas.'),
  };
}

export default async function ArtistPage() {
  const [role, paragraph1, paragraph2, paragraph3, socialsTitle] = await Promise.all([
    content('artist.role', ARTIST.role),
    content('artist.bio.paragraph1', ARTIST.bio[0]),
    content('artist.bio.paragraph2', ARTIST.bio[1]),
    content('artist.bio.paragraph3', ARTIST.bio[2]),
    content('artist.socials.title', 'Dónde encontrarlo'),
  ]);

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
        <p className="label muted">{role}</p>

        <p className={styles.paragraph}>{paragraph1}</p>
        <p className={styles.paragraph}>{paragraph2}</p>
        <p className={styles.paragraph}>{paragraph3}</p>

        <section className={styles.block}>
          <h2 className="label muted">{socialsTitle}</h2>
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
