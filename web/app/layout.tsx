import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Tema } from '@/components/Tema';
import { Zoom } from '@/components/Zoom';
import { Carrito } from '@/components/Carrito';
import { TransicionPagina } from '@/components/TransicionPagina';
import './globals.scss';
import estilos from './layout.module.scss';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--fuente-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Toryteler',
  description: 'Piezas únicas y contenido personal del artista.',
};

/**
 * Corre antes del primer pintado: sin esto, quien eligió un tema o una
 * densidad distintos a los de por defecto ve un fogonazo del estado equivocado.
 */
const PREFERENCIAS_SIN_PARPADEO = `
try {
  var t = localStorage.getItem('tema');
  if (t === 'claro' || t === 'oscuro') document.documentElement.dataset.tema = t;
  var z = localStorage.getItem('zoom');
  if (z === 'cerca' || z === 'lejos') document.documentElement.dataset.zoom = z;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCIAS_SIN_PARPADEO }} />
      </head>
      <body>
        <header className={estilos.cabecera}>
          <div className={estilos.izquierda}>
            <Zoom />
          </div>

          <nav className={`${estilos.centro} mayusculas`}>
            <Link href="/">La casa de Tory</Link>
          </nav>

          <div className={`${estilos.derecha} mayusculas`}>
            <Link href="/artista">Toryteler</Link>
            <Link href="/cuenta">Cuenta</Link>
            <Tema />
            <Carrito />
          </div>
        </header>

        <TransicionPagina>{children}</TransicionPagina>

        <footer className={`${estilos.pie} tenue mayusculas`}>Medellín, Colombia</footer>
      </body>
    </html>
  );
}
