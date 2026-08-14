import Link from 'next/link';
import estilos from './studio.module.scss';

/**
 * lazy: sin control de acceso todavía. La API aún no existe, así que aquí no
 * hay nada que proteger —ningún formulario guarda nada—, pero antes de que
 * exista un endpoint real esta ruta necesita el guard de rol del plan 1.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={estilos.marco}>
      <div className={estilos.aviso}>
        <p className="mayusculas">Maqueta · nada de lo que hagas aquí se guarda</p>
      </div>

      <nav className={`${estilos.nav} mayusculas`}>
        <Link href="/studio">Publicar</Link>
        <Link href="/studio/pedidos">Pedidos</Link>
      </nav>

      {children}
    </div>
  );
}
