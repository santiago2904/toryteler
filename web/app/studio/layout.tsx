import Link from 'next/link';
import styles from './studio.module.scss';

/**
 * lazy: no access control yet. The API does not exist, so there is nothing to
 * protect here — no form saves anything — but before the first real endpoint
 * this route needs the role guard from plan 1.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.notice}>
        <p className="label">Vista previa del panel</p>
        <p className="muted">
          Todavía no está conectado a la tienda: puedes recorrerlo y ver cómo queda, pero
          ningún botón guarda, publica ni borra nada. Los controles que aún no funcionan
          aparecen apagados.
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
