import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ZoomToggle } from '@/components/ZoomToggle';
import { CartLink } from '@/components/CartLink';
import { PageTransition } from '@/components/PageTransition';
import { content, getOverrides } from '@/lib/content';
import { ContentProvider } from '@/components/ContentProvider';
import './globals.scss';
import styles from './layout.module.scss';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Toryteler',
    description: await content(
      'site.meta.description',
      'Piezas únicas y contenido personal del artista.',
    ),
  };
}

/**
 * Runs before the first paint: without this, anyone whose theme or density
 * differs from the default sees a flash of the wrong state on every load.
 */
const PREFERENCES_BEFORE_PAINT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  var z = localStorage.getItem('zoom');
  if (z === 'in' || z === 'out') document.documentElement.dataset.zoom = z;
} catch (e) {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [overrides, homeLabel] = await Promise.all([
    getOverrides(),
    content('site.nav.homeLabel', 'La casa de Tory'),
  ]);

  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BEFORE_PAINT }} />
      </head>
      <body>
        <ContentProvider overrides={overrides}>
          <header className={styles.header}>
            <div className={styles.left}>
              <ZoomToggle />
            </div>

            <nav className={`${styles.center} label`}>
              <Link href="/">{homeLabel}</Link>
            </nav>

            <div className={`${styles.right} label`}>
              <Link href="/artista">Toryteler</Link>
              <Link href="/cuenta">Cuenta</Link>
              <ThemeToggle />
              <CartLink />
            </div>
          </header>

          <PageTransition>{children}</PageTransition>

          <footer className={`${styles.footer} muted label`}>Medellín, Colombia</footer>
        </ContentProvider>
      </body>
    </html>
  );
}
