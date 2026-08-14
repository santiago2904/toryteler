import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Tema } from '@/components/Tema';
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
 * Corre antes del primer pintado: sin esto, quien eligió un tema distinto al
 * del sistema ve un fogonazo del tema equivocado en cada carga.
 */
const TEMA_SIN_PARPADEO = `
try {
  var t = localStorage.getItem('tema');
  if (t === 'claro' || t === 'oscuro') document.documentElement.dataset.tema = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SIN_PARPADEO }} />
      </head>
      <body>
        <header className={estilos.cabecera}>
          <Link href="/" className="mayusculas">Toryteler</Link>
          <nav className={`${estilos.nav} mayusculas`}>
            <Link href="/cuenta">Cuenta</Link>
            <Tema />
          </nav>
        </header>
        <main className="aparece">{children}</main>
        <footer className={`${estilos.pie} tenue mayusculas`}>Medellín, Colombia</footer>
      </body>
    </html>
  );
}
