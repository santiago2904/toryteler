import Link from 'next/link';
import estilos from './studio.module.scss';

/**
 * lazy: sin control de acceso todavía. La API aún no existe, así que aquí no
 * hay nada que proteger —ningún formulario guarda nada—, pero antes del primer
 * endpoint real esta ruta necesita el guard de rol del plan 1.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={estilos.marco}>
      <div className={estilos.aviso}>
        <p className="mayusculas">Vista previa del panel</p>
        <p className="tenue">
          Todavía no está conectado a la tienda: puedes recorrerlo y ver cómo queda, pero
          ningún botón guarda, publica ni borra nada. Los controles que aún no funcionan
          aparecen apagados.
        </p>
      </div>

      <nav className={`${estilos.nav} mayusculas`}>
        <Link href="/studio">Publicado</Link>
        <Link href="/studio/pedidos">Pedidos</Link>
      </nav>

      {children}
    </div>
  );
}
