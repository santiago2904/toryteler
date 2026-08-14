import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <header className={estilos.cabecera}>
          <Link href="/" className="mayusculas">Toryteler</Link>
          <nav className="mayusculas">
            <Link href="/cuenta">Cuenta</Link>
          </nav>
        </header>
        <main className="aparece">{children}</main>
        <footer className={`${estilos.pie} tenue mayusculas`}>Medellín, Colombia</footer>
      </body>
    </html>
  );
}
