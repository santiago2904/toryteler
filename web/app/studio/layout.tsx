import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { Profile } from '@/lib/types';
import styles from './studio.module.scss';

/**
 * The studio is the artist's, and this is where that is enforced on the web.
 *
 * A layout rather than a check inside each page: a new screen under /studio
 * inherits the guard instead of having to remember it. The API guards its own
 * endpoints too — this is not the only lock, it is the one that keeps the
 * panel from being drawn at all.
 *
 * Someone signed in who is not the artist gets a 404, not a "forbidden". The
 * second answer tells them there is a panel here worth finding a way into.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // No session at all: apiGet sends them to sign in.
  const profile = await apiGet<Profile>('/me', true);
  if (!profile.isAdmin) notFound();

  return (
    <div className={styles.frame}>
      <div className={styles.notice}>
        <p className="label">Los videos todavía no se pueden crear aquí</p>
        <p className="muted">
          Las piezas sí: guardar, editar, publicar y despublicar funcionan y afectan a la
          tienda de verdad. Para los videos falta conectar la subida del archivo, así que
          ese formulario aún no guarda.
        </p>
      </div>

      <nav className={`${styles.nav} label`}>
        <Link href="/studio">Publicado</Link>
        <Link href="/studio/pedidos">Pedidos</Link>
      </nav>

      {children}
    </div>
  );
}
