# Web pública y panel /studio — Plan de implementación (Fase 1, plan 2 de 2)

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDO: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Goal:** Construir la web pública de la tienda —catálogo, procedencia, checkout con firma, visionado efímero— y el panel del artista en `/studio`, sobre la API del plan 1.

**Arquitectura:** Una sola app Next.js (App Router). Las páginas de catálogo y procedencia se renderizan en el servidor para que carguen instantáneas y compartan bien en redes. La sesión es una cookie `httpOnly` first-party: el navegador nunca habla directo con la API, sino con Route Handlers de Next que reenvían la petición añadiendo la cookie. Eso evita CORS con credenciales, `SameSite=None` y toda la fragilidad de cookies entre dominios.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, CSS Modules, Cloudinary (`next/image`), Cloudflare Stream Player.

**Spec:** `docs/superpowers/specs/2026-08-13-tienda-artista-design.md`
**Plan previo:** `docs/superpowers/plans/2026-08-13-api-nucleo.md` — este plan consume sus endpoints y tipos.

## Restricciones globales

- Node 20 LTS. TypeScript `strict`. App Router, no Pages Router.
- **Idioma: español únicamente.** Todo el texto de interfaz, errores y correos en español, con acentuación correcta.
- **CSS Modules**, sin framework de utilidades. La paleta y la tipografía se definen una sola vez como variables CSS en `app/globals.css` y nadie declara colores fuera de ahí.
- **Radio de borde: 0 en todo el proyecto.** Sin `box-shadow`, sin gradientes, sin translucidez. La profundidad se construye con líneas de 1 px y con inversión de color, nunca con sombra.
- Una sola familia tipográfica (Inter Variable), dos pesos. Navegación de máximo tres entradas.
- **El estado se comunica con palabras, no con color:** `AGOTADO`, `VISTO 13 AGO 2026`, `QUEDAN 12`.
- Accesibilidad no negociable: contraste AA, foco visible, navegación completa por teclado, `alt` en cada imagen, ningún control que dependa solo del color.
- **Texto mínimo de 12 px, y solo para etiquetas cortas en mayúsculas.** El cuerpo nunca baja de 16 px en móvil (por debajo, iOS hace zoom automático en los formularios).
- Precios siempre formateados con `Intl.NumberFormat('es-CO')` y sufijo `COP`. Nunca decimales.
- El navegador nunca llama a la API directamente: siempre vía Route Handler de Next bajo `/api/`.
- Ninguna llave secreta en código de cliente. `NEXT_PUBLIC_*` solo para valores realmente públicos.
- Sin pruebas automatizadas de UI en fase 1 (decisión del spec §13). Cada tarea cierra con una **verificación manual ejecutable**. La lógica pura sí lleva pruebas unitarias.

---

## Estructura de archivos

```
web/
  app/
    layout.tsx                       marco: tipografía, navegación, pie
    globals.css                      variables de color y tipografía — única fuente
    page.tsx                         catálogo
    page.module.css
    piezas/[slug]/page.tsx           detalle y procedencia de la pieza
    piezas/[slug]/page.module.css
    drops/[slug]/page.tsx            detalle del drop
    checkout/page.tsx                datos del comprador
    checkout/contrato/page.tsx       lectura, consentimiento y firma OTP
    checkout/resultado/page.tsx      retorno desde Wompi
    cuenta/page.tsx                  pedidos y accesos
    ver/[entitlementId]/page.tsx     visionado efímero
    entrar/page.tsx                  solicitud de magic link
    auth/verify/route.ts             canje del enlace, fija la cookie
    api/[...path]/route.ts           proxy a la API con la cookie de sesión
    studio/layout.tsx                marco del panel (verifica rol)
    studio/page.tsx                  piezas y drops
    studio/pedidos/page.tsx          pedidos y contratos
  components/
    Precio.tsx                       formato COP en un solo lugar
    EstadoPieza.tsx                  AGOTADO / DISPONIBLE / RESERVADA
    Imagen.tsx                       envoltorio de next/image con Cloudinary
    ReproductorEfimero.tsx           player + marca de agua + cuenta regresiva
  lib/
    api.ts                           cliente tipado del servidor
    tipos.ts                         tipos compartidos con la API
    formato.ts                       precio, fecha, tiempo restante
    formato.test.ts
  next.config.ts
  .env.local.example
```

Cada página vive con su `.module.css` al lado: lo que cambia junto, junto. Los componentes compartidos son cuatro, y existen porque los usan al menos dos páginas.

---

## Lenguaje visual

Estilo base: **monocromo minimalista**, en su variante oscura. La referencia es la sobriedad de yeezy.com, no el lujo decorativo: nada de serifas de revista, nada de vidrio esmerilado, ningún color de acento.

**La paleta es la ausencia de paleta.** Dos tonos y dos grises, sin excepciones.

| Rol | Valor | Uso |
|---|---|---|
| Fondo | `#0A0A0A` | Todo el sitio |
| Tinta | `#EDEDED` | Texto principal |
| Tenue | `#8A8A8A` | Texto secundario y estados pasados — 5.4:1 sobre el fondo |
| Línea | `#242424` | Divisiones de una sola unidad de grosor |

**Por qué no es negro puro sobre blanco puro.** `#FFFFFF` sobre `#000000` da 21:1, pero produce halación: el texto parece vibrar y cansa en pantallas OLED, que es donde va a mirarse esto. `#EDEDED` sobre `#0A0A0A` da **16.9:1** —muy por encima de AAA— sin la fatiga. Es la diferencia entre austero y agresivo.

**Tipografía: Inter Variable, y nada más.** Una sola familia con dos pesos (400 y 500). La jerarquía no se construye con familias distintas ni con negritas: se construye con **tamaño y con espaciado entre letras**.

| Rol | Tamaño | Peso | Tracking |
|---|---|---|---|
| Etiqueta / navegación / estado | `0.75rem` (12 px) | 500 | `0.16em` |
| Cuerpo | `1rem` (16 px) | 400 | normal |
| Título de pieza | `clamp(2.5rem, 9vw, 7rem)` | 400 | `-0.03em` |

Esa tensión —lo diminuto y muy espaciado contra lo enorme y muy junto— es de donde sale el aire de misterio. No hay tamaños intermedios: si algo no es una etiqueta ni un cuerpo ni un título, no debería existir.

**Ritmo espacial:** múltiplos de 8 px, con saltos deliberadamente grandes. El vacío es el material principal; una sección respira con 6 rem, no con 2.

**Movimiento:** una sola transición en todo el sitio, `opacity 400ms ease-out`, para que el contenido aparezca en vez de aterrizar. Nada se mueve, nada rebota, nada escala. Bajo `prefers-reduced-motion` desaparece por completo.

**Estados, siempre en palabras y en mayúsculas espaciadas:**

| Situación | Texto | Tono |
|---|---|---|
| Pieza disponible | `DISPONIBLE` | Tinta |
| Pieza vendida | `VENDIDA · 13 AGO 2026` | Tenue |
| Drop con cupo | `QUEDAN 12` | Tinta |
| Drop sin cupo | `AGOTADO` | Tenue |
| Acceso sin abrir | `SIN ABRIR` | Tinta |
| Acceso en curso | `QUEDAN 3 H 20 MIN` | Tinta |
| Acceso consumido | `VISTO 13 AGO 2026` | Tenue |

El contraste entre tinta y tenue **acompaña** al texto; nunca lo sustituye. Alguien que no distinga los dos grises lee exactamente la misma información.

---

## Tarea 1: Esqueleto, lenguaje visual y cliente de API

**Archivos:**
- Crear: `web/` completo vía `create-next-app`
- Crear: `web/app/globals.css`, `web/app/layout.tsx`, `web/lib/tipos.ts`, `web/lib/api.ts`, `web/lib/formato.ts`, `web/lib/formato.test.ts`
- Crear: `web/components/Precio.tsx`, `web/.env.local.example`

**Interfaces:**
- Produce: `apiGet<T>(path: string): Promise<T>` y `apiSend<T>(path, method, body, opts)` desde `lib/api.ts`; tipos `PieceSummary`, `PieceDetail`, `DropDetail`, `OrderSummary`, `EntitlementSummary` en `lib/tipos.ts` (espejo exacto de las tareas 11 y 12 del plan 1); `formatearPrecio(cop: number): string`, `formatearFecha(iso: string): string`, `tiempoRestante(hasta: string): string` en `lib/formato.ts`.

- [ ] **Paso 1: Crear la app**

```bash
cd /Users/sapalacioa/Documents/Development/Personal/toryteler
npx create-next-app@latest web --typescript --app --no-tailwind --no-src-dir --eslint --import-alias "@/*"
cd web && npm i -D jest ts-jest @types/jest
```

- [ ] **Paso 2: Definir el lenguaje visual, una sola vez**

`web/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

:root {
  /* Dos tonos y dos grises. No hay más colores en el proyecto. */
  --fondo: #0a0a0a;
  --tinta: #ededed;   /* 16.9:1 sobre el fondo — AAA sin la halación del blanco puro */
  --tenue: #8a8a8a;   /* 5.4:1 sobre el fondo — AA para texto secundario */
  --linea: #242424;

  --fuente: 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif;

  --etiqueta: 0.75rem;
  --cuerpo: 1rem;
  --titulo: clamp(2.5rem, 9vw, 7rem);

  --tracking-etiqueta: 0.16em;
  --tracking-titulo: -0.03em;

  --u: 8px;                /* toda medida es múltiplo de esto */
  --margen: calc(var(--u) * 3);
  --respiro: calc(var(--u) * 12);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { color-scheme: dark; }

body {
  background: var(--fondo);
  color: var(--tinta);
  font-family: var(--fuente);
  font-size: var(--cuerpo);
  font-weight: 400;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

a { color: inherit; text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 0.3em; }

/* El foco es obligatorio y visible: la navegación por teclado no se negocia. */
:focus-visible { outline: 1px solid var(--tinta); outline-offset: 4px; }

/* Inversión, no relleno de color: el botón es el negativo de la página. */
button {
  font: inherit;
  font-size: var(--etiqueta);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: var(--tracking-etiqueta);
  background: var(--tinta);
  color: var(--fondo);
  border: 1px solid var(--tinta);
  border-radius: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  min-height: 44px;              /* área táctil mínima */
  cursor: pointer;
}
button:hover { background: var(--fondo); color: var(--tinta); }
button:disabled {
  background: transparent;
  color: var(--tenue);
  border-color: var(--linea);
  cursor: not-allowed;
}

input, textarea, select {
  font: inherit;
  font-size: var(--cuerpo);      /* 16px evita el zoom automático de iOS */
  width: 100%;
  min-height: 44px;
  padding: calc(var(--u) * 1.5);
  border: 1px solid var(--linea);
  border-radius: 0;
  background: transparent;
  color: var(--tinta);
}
input:focus, textarea:focus { border-color: var(--tinta); }

label { font-size: var(--etiqueta); color: var(--tenue); }

h1, h2 { font-weight: 400; letter-spacing: var(--tracking-titulo); line-height: 1.05; }

::selection { background: var(--tinta); color: var(--fondo); }

.mayusculas {
  font-size: var(--etiqueta);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: var(--tracking-etiqueta);
}
.tenue { color: var(--tenue); }

.titulo { font-size: var(--titulo); }

/* Única animación del sitio: el contenido aparece, no aterriza. */
.aparece { animation: aparecer 400ms ease-out both; }

@keyframes aparecer { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Cuatro valores de color, tres tamaños de texto, una animación. No existe `border-radius`, `box-shadow` ni un solo color de acento en todo el proyecto. Si algo no es etiqueta, cuerpo o título, no debería existir.

- [ ] **Paso 3: Marco de la aplicación**

`web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import estilos from './layout.module.css';

export const metadata: Metadata = {
  title: 'Toryteler',
  description: 'Piezas únicas y contenido personal del artista.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
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
```

`web/app/layout.module.css`:

```css
.cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--margen);
}

.pie {
  padding: var(--respiro) var(--margen) var(--margen);
}
```

- [ ] **Paso 4: Escribir la prueba de formato que falla**

`web/lib/formato.test.ts`:

```ts
import { formatearPrecio, formatearFecha, tiempoRestante } from './formato';

describe('formato', () => {
  it('formatea pesos sin decimales y con separador de miles', () => {
    expect(formatearPrecio(500000)).toBe('$500.000 COP');
    expect(formatearPrecio(4000)).toBe('$4.000 COP');
  });

  it('formatea la fecha en español y en mayúsculas', () => {
    expect(formatearFecha('2026-08-13T15:04:00Z')).toBe('13 AGO 2026');
  });

  it('describe el tiempo restante en horas y minutos', () => {
    const enDosHoras = new Date(Date.now() + 2 * 3600_000 + 30 * 60_000).toISOString();
    expect(tiempoRestante(enDosHoras)).toBe('2 h 30 min');
  });

  it('reporta vencido cuando ya pasó', () => {
    expect(tiempoRestante(new Date(Date.now() - 1000).toISOString())).toBe('vencido');
  });
});
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que falla**

Ejecutar: `cd web && npx jest lib/formato.test.ts`
Esperado: FALLA — no existe `lib/formato.ts`.

- [ ] **Paso 6: Implementar formato, tipos y cliente**

`web/lib/formato.ts`:

```ts
const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

export function formatearPrecio(cop: number): string {
  return `$${PESOS.format(cop)} COP`;
}

export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function tiempoRestante(hasta: string): string {
  const ms = new Date(hasta).getTime() - Date.now();
  if (ms <= 0) return 'vencido';
  const horas = Math.floor(ms / 3600_000);
  const minutos = Math.floor((ms % 3600_000) / 60_000);
  return horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
}
```

`web/lib/tipos.ts` — espejo exacto de lo que devuelve la API:

```ts
export interface PieceSummary {
  slug: string; title: string; priceCop: number; images: string[]; available: boolean;
}
export interface PieceDetail extends PieceSummary {
  id: string; description: string | null; story: string | null; soldAt: string | null;
}
export interface DropDetail {
  id: string; slug: string; title: string; description: string | null;
  priceCop: number; posterImage: string | null;
  capacity: number | null; remaining: number | null; soldOut: boolean;
  viewWindowHours: number;
}
export interface OrderSummary {
  id: string; reference: string; status: string; totalCop: number;
  createdAt: string; trackingNumber: string | null;
}
export interface EntitlementSummary {
  id: string; dropSlug: string; dropTitle: string;
  firstPlayedAt: string | null; expiresAt: string | null;
  state: 'unopened' | 'open' | 'consumed';
}
```

`web/lib/api.ts` — se usa solo en el servidor (Server Components y Route Handlers):

```ts
import { cookies } from 'next/headers';

const BASE = process.env.API_URL!;

export async function apiGet<T>(path: string, autenticado = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (autenticado) {
    const sesion = (await cookies()).get('session')?.value;
    if (sesion) headers.Authorization = `Bearer ${sesion}`;
  }
  const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`API_${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  const sesion = (await cookies()).get('session')?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sesion) headers.Authorization = `Bearer ${sesion}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`API_${res.status}:${detalle}`);
  }
  return res.json() as Promise<T>;
}
```

`web/components/Precio.tsx`:

```tsx
import { formatearPrecio } from '@/lib/formato';

export function Precio({ cop }: { cop: number }) {
  return <span className="mayusculas">{formatearPrecio(cop)}</span>;
}
```

`web/.env.local.example`:

```
API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

`web/jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};
```

- [ ] **Paso 7: Ejecutar la prueba y verificar que pasa**

Ejecutar: `cd web && npx jest lib/formato.test.ts`
Esperado: PASA — 4 pruebas.

- [ ] **Paso 8: Verificación manual**

Ejecutar: `cd web && npm run dev -- -p 3001` y abrir `http://localhost:3001`.

Esperado:
1. Pantalla casi negra (`#0A0A0A`), con «TORYTELER» arriba a la izquierda en letra pequeña muy espaciada, «CUENTA» a la derecha y «MEDELLÍN, COLOMBIA» abajo en gris.
2. Al navegar con Tab, cada enlace muestra un contorno claro de 1 px separado del texto.
3. Seleccionar texto con el cursor lo muestra invertido: fondo claro, letra oscura.
4. En las herramientas del navegador, verificar que ningún elemento tiene `border-radius` ni `box-shadow`.
5. Con «reducir movimiento» activado en el sistema, el contenido aparece de inmediato, sin desvanecido.

- [ ] **Paso 9: Commit**

```bash
git add web
git commit -m "feat(web): esqueleto Next.js, lenguaje visual y cliente de API"
```

---

## Tarea 2: Catálogo y página de pieza

**Archivos:**
- Crear: `web/app/page.tsx`, `web/app/page.module.css`
- Crear: `web/app/piezas/[slug]/page.tsx`, `web/app/piezas/[slug]/page.module.css`
- Crear: `web/components/Imagen.tsx`, `web/components/EstadoPieza.tsx`
- Modificar: `web/next.config.ts`

**Interfaces:**
- Consume: `apiGet`, `PieceSummary`, `PieceDetail`, `Precio`.
- Produce: rutas `/` y `/piezas/[slug]`; `<Imagen publicId alt priority />`; `<EstadoPieza available soldAt />`.

- [ ] **Paso 1: Permitir imágenes de Cloudinary**

`web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

export default config;
```

- [ ] **Paso 2: Componentes de imagen y estado**

`web/components/Imagen.tsx`:

```tsx
import Image from 'next/image';

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? 'demo';

export function Imagen({ publicId, alt, priority = false }: {
  publicId: string; alt: string; priority?: boolean;
}) {
  const src = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${publicId}`;
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={1600}
      priority={priority}
      style={{ width: '100%', height: 'auto' }}
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  );
}
```

`web/components/EstadoPieza.tsx`:

```tsx
import { formatearFecha } from '@/lib/formato';

export function EstadoPieza({ available, soldAt }: { available: boolean; soldAt: string | null }) {
  // El estado se dice con palabras, nunca con un punto de color.
  if (available) return <span className="mayusculas">Disponible</span>;
  return (
    <span className="mayusculas tenue">
      Vendida{soldAt ? ` · ${formatearFecha(soldAt)}` : ''}
    </span>
  );
}
```

- [ ] **Paso 3: Catálogo**

`web/app/page.tsx`:

```tsx
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { PieceSummary } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { Precio } from '@/components/Precio';
import { EstadoPieza } from '@/components/EstadoPieza';
import estilos from './page.module.css';

export const revalidate = 30;

export default async function Catalogo() {
  const piezas = await apiGet<PieceSummary[]>('/pieces');

  if (piezas.length === 0) {
    return <p className={estilos.vacio}>Aún no hay piezas publicadas.</p>;
  }

  return (
    <ul className={estilos.rejilla}>
      {piezas.map((pieza, i) => (
        <li key={pieza.slug}>
          <Link href={`/piezas/${pieza.slug}`}>
            {pieza.images[0] && (
              <Imagen publicId={pieza.images[0]} alt={pieza.title} priority={i < 2} />
            )}
            <div className={estilos.pie}>
              <span className="mayusculas">{pieza.title}</span>
              <Precio cop={pieza.priceCop} />
              <EstadoPieza available={pieza.available} soldAt={null} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`web/app/page.module.css`:

```css
.rejilla {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--respiro) var(--margen);
  padding: var(--margen);
}

.pie {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
  padding-top: var(--margen);
}

.vacio { padding: var(--respiro) var(--margen); }

@media (max-width: 640px) {
  .rejilla { grid-template-columns: 1fr; gap: calc(var(--u) * 8); }
}
```

- [ ] **Paso 4: Página de pieza con procedencia**

`web/app/piezas/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { PieceDetail } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { Precio } from '@/components/Precio';
import { EstadoPieza } from '@/components/EstadoPieza';
import estilos from './page.module.css';

async function cargar(slug: string): Promise<PieceDetail | null> {
  try { return await apiGet<PieceDetail>(`/pieces/${slug}`); }
  catch { return null; }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const pieza = await cargar(slug);
  if (!pieza) return { title: 'Pieza no encontrada' };
  return {
    title: `${pieza.title} — Toryteler`,
    description: pieza.description ?? undefined,
    openGraph: { title: pieza.title, images: pieza.images.slice(0, 1) },
  };
}

export default async function Pieza({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pieza = await cargar(slug);
  if (!pieza) notFound();

  return (
    <article className={estilos.pieza}>
      <div className={estilos.imagenes}>
        {pieza.images.map((id, i) => (
          <Imagen key={id} publicId={id} alt={`${pieza.title} — imagen ${i + 1}`} priority={i === 0} />
        ))}
      </div>

      <div className={estilos.ficha}>
        <h1 className="titulo">{pieza.title}</h1>
        <Precio cop={pieza.priceCop} />
        <EstadoPieza available={pieza.available} soldAt={pieza.soldAt} />

        {pieza.description && <p className={estilos.parrafo}>{pieza.description}</p>}

        {pieza.story && (
          <section className={estilos.procedencia}>
            <h2 className="mayusculas tenue">Procedencia</h2>
            <p className={estilos.parrafo}>{pieza.story}</p>
          </section>
        )}

        <p className={`${estilos.parrafo} tenue`}>
          Incluye una nota escrita por el artista y el contrato de compraventa firmado.
        </p>

        {pieza.available ? (
          <Link href={`/checkout?pieza=${pieza.slug}`}>
            <button type="button">Comprar</button>
          </Link>
        ) : (
          <p className="mayusculas tenue">Esta pieza ya encontró dueño.</p>
        )}
      </div>
    </article>
  );
}
```

`web/app/piezas/[slug]/page.module.css`:

```css
.pieza {
  display: grid;
  grid-template-columns: 1fr 22rem;
  gap: 3rem;
  padding: 1.5rem;
  align-items: start;
}

.imagenes { display: flex; flex-direction: column; gap: 1.5rem; }

.ficha {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.parrafo { max-width: 34ch; }

.procedencia {
  border-top: 1px solid var(--linea);
  padding-top: 1rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (max-width: 900px) {
  .pieza { grid-template-columns: 1fr; }
  .ficha { position: static; }
}
```

- [ ] **Paso 5: Verificación manual**

Con la API corriendo y al menos dos piezas publicadas (una disponible, una vendida):
1. Abrir `http://localhost:3001` → se ven las piezas en rejilla, cada una con título, precio y estado en palabras.
2. Clic en una pieza → la ficha muestra procedencia y el botón «Comprar».
3. Abrir una pieza vendida → no hay botón, dice «Esta pieza ya encontró dueño».
4. Abrir `http://localhost:3001/piezas/no-existe` → página 404.
5. Reducir la ventana a 500 px → una sola columna, sin desbordes horizontales.
6. Navegar toda la página con Tab → todos los enlaces y el botón reciben foco visible.

- [ ] **Paso 6: Commit**

```bash
git add web
git commit -m "feat(web): catálogo y página de pieza con procedencia"
```

---

## Tarea 3: Sesión por magic link

**Archivos:**
- Crear: `web/app/entrar/page.tsx`, `web/app/auth/verify/route.ts`, `web/app/api/[...path]/route.ts`
- Crear: `web/lib/sesion.ts`

**Interfaces:**
- Consume: endpoints `POST /auth/magic-link` y `GET /auth/verify` del plan 1.
- Produce: cookie `session` (`httpOnly`, `sameSite=lax`, `secure` en producción); `obtenerUsuario(): Promise<{ id: string } | null>` en `lib/sesion.ts`; proxy `/api/*` que reenvía a la API añadiendo la cabecera de autorización.

- [ ] **Paso 1: Proxy hacia la API**

`web/app/api/[...path]/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const BASE = process.env.API_URL!;

async function reenviar(req: NextRequest, path: string[]) {
  const sesion = (await cookies()).get('session')?.value;
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (sesion) headers.set('Authorization', `Bearer ${sesion}`);
  const idem = req.headers.get('idempotency-key');
  if (idem) headers.set('Idempotency-Key', idem);

  const cuerpo = req.method === 'GET' ? undefined : await req.text();
  const url = `${BASE}/${path.join('/')}${req.nextUrl.search}`;
  const res = await fetch(url, { method: req.method, headers, body: cuerpo });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
```

El navegador solo conoce `/api/...` de su propio dominio. La cookie nunca cruza dominios y no hay CORS con credenciales que configurar.

- [ ] **Paso 2: Página de entrada**

`web/app/entrar/page.tsx`:

```tsx
'use client';

import { useState } from 'react';

export default function Entrar() {
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo }),
    });
    if (res.ok) setEnviado(true);
    else setError('No pudimos enviar el enlace. Revisa el correo e inténtalo de nuevo.');
  }

  if (enviado) {
    return (
      <section style={{ padding: '4rem 1.5rem', maxWidth: '34ch' }}>
        <h1 className="mayusculas">Revisa tu correo</h1>
        <p>Te enviamos un enlace a {correo}. Vence en 20 minutos.</p>
      </section>
    );
  }

  return (
    <form onSubmit={enviar} style={{ padding: '4rem 1.5rem', maxWidth: '28rem', display: 'grid', gap: '1rem' }}>
      <h1 className="mayusculas">Entrar</h1>
      <label htmlFor="correo">Correo electrónico</label>
      <input
        id="correo" type="email" required autoComplete="email"
        value={correo} onChange={(e) => setCorreo(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Enviar enlace</button>
    </form>
  );
}
```

- [ ] **Paso 3: Canje del enlace**

`web/app/auth/verify/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/entrar', req.url));

  const res = await fetch(`${process.env.API_URL}/auth/verify?token=${token}`);
  if (!res.ok) {
    return NextResponse.redirect(new URL('/entrar?error=enlace-invalido', req.url));
  }
  const { sessionToken } = await res.json();

  const destino = req.nextUrl.searchParams.get('destino') ?? '/cuenta';
  const respuesta = NextResponse.redirect(new URL(destino, req.url));
  respuesta.cookies.set('session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return respuesta;
}
```

`web/lib/sesion.ts`:

```ts
import { cookies } from 'next/headers';

export async function haySesion(): Promise<boolean> {
  return Boolean((await cookies()).get('session')?.value);
}
```

- [ ] **Paso 4: Verificación manual**

1. Abrir `/entrar`, escribir un correo y enviar → aparece «Revisa tu correo».
2. Tomar el enlace del correo (o de `magic_links` en la base) y abrirlo → redirige a `/cuenta` y la cookie `session` existe, marcada `HttpOnly` en las herramientas del navegador.
3. Abrir el mismo enlace otra vez → redirige a `/entrar?error=enlace-invalido`.
4. Confirmar en la pestaña de red que ninguna petición sale hacia el dominio de la API: todas van a `/api/...`.

- [ ] **Paso 5: Commit**

```bash
git add web
git commit -m "feat(web): sesión por magic link con cookie first-party y proxy de API"
```

---

## Tarea 4: Checkout — datos del comprador

**Archivos:**
- Crear: `web/app/checkout/page.tsx`, `web/app/checkout/checkout.module.css`

**Interfaces:**
- Consume: `POST /orders` (con `Idempotency-Key`), `GET /pieces/:slug`, `GET /drops/:slug`.
- Produce: ruta `/checkout?pieza=<slug>` o `/checkout?drop=<slug>`; al enviar, navega a `/checkout/contrato?order=<id>` para piezas físicas o directo a `/checkout/pagar?order=<id>` para pedidos solo digitales.

- [ ] **Paso 1: Formulario de datos**

`web/app/checkout/page.tsx`:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import estilos from './checkout.module.css';

const METODOS = [
  { valor: 'PSE', etiqueta: 'PSE' },
  { valor: 'CARD', etiqueta: 'Tarjeta' },
  { valor: 'NEQUI', etiqueta: 'Nequi' },
] as const;

export default function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const pieza = params.get('pieza');
  const drop = params.get('drop');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Una sola clave por intento de checkout: el doble clic no crea dos pedidos.
  const [claveIdempotencia] = useState(() => crypto.randomUUID());

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const datos = new FormData(e.currentTarget);
    const cuerpo = {
      pieceIds: pieza ? [pieza] : [],
      dropIds: drop ? [drop] : [],
      paymentMethod: datos.get('metodo'),
      shippingAddress: pieza ? {
        line1: String(datos.get('direccion')),
        city: String(datos.get('ciudad')),
        phone: String(datos.get('telefono')),
      } : undefined,
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': claveIdempotencia },
      body: JSON.stringify(cuerpo),
    });

    if (res.status === 401) { router.push('/entrar'); return; }
    if (res.status === 409) {
      setError('Alguien más está comprando esta pieza en este momento. Es única, así que puede que ya no esté disponible.');
      setEnviando(false);
      return;
    }
    if (!res.ok) {
      setError('No pudimos crear tu pedido. Inténtalo de nuevo.');
      setEnviando(false);
      return;
    }

    const orden = await res.json();
    router.push(pieza ? `/checkout/contrato?order=${orden.id}` : `/checkout/pagar?order=${orden.id}`);
  }

  return (
    <form onSubmit={enviar} className={estilos.formulario}>
      <h1 className="mayusculas">Tus datos</h1>

      {pieza && (
        <>
          <label htmlFor="direccion">Dirección de entrega</label>
          <input id="direccion" name="direccion" required autoComplete="street-address" />

          <label htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" name="ciudad" required autoComplete="address-level2" />

          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" required inputMode="tel" autoComplete="tel" />
        </>
      )}

      <fieldset className={estilos.metodos}>
        <legend className="mayusculas">Método de pago</legend>
        {METODOS.map((m, i) => (
          <label key={m.valor} className={estilos.metodo}>
            <input type="radio" name="metodo" value={m.valor} defaultChecked={i === 0} />
            {m.etiqueta}
          </label>
        ))}
      </fieldset>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Un momento…' : 'Continuar'}
      </button>
    </form>
  );
}
```

`web/app/checkout/checkout.module.css`:

```css
.formulario {
  padding: 4rem 1.5rem;
  max-width: 30rem;
  display: grid;
  gap: 0.75rem;
}

.metodos { border: 1px solid var(--linea); padding: 1rem; display: grid; gap: 0.5rem; }

.metodo { display: flex; align-items: center; gap: 0.5rem; }
.metodo input { width: auto; }
```

- [ ] **Paso 2: Verificación manual**

1. Desde una pieza disponible, clic en «Comprar» → llega a `/checkout?pieza=...` con los campos de envío visibles.
2. Enviar sin sesión → redirige a `/entrar`.
3. Con sesión, enviar → navega a `/checkout/contrato?order=...` y la pieza queda `reserved` en la base.
4. Abrir el checkout de un drop (`/checkout?drop=...`) → no aparecen campos de envío.
5. Hacer doble clic rápido en «Continuar» → se crea un solo pedido (verificar `SELECT count(*) FROM orders`).

- [ ] **Paso 3: Commit**

```bash
git add web
git commit -m "feat(web): checkout con datos de envío y clave de idempotencia"
```

---

## Tarea 5: Contrato, lectura obligatoria y firma

**Archivos:**
- Crear: `web/app/checkout/contrato/page.tsx`, `web/app/checkout/contrato/contrato.module.css`

**Interfaces:**
- Consume: `POST /orders/:id/contract` (prepara y devuelve `{ contractId, pdfUrl, documentHash, otpChallengeId }`) y `POST /orders/:id/sign`.
- Produce: ruta `/checkout/contrato?order=<id>`; al firmar navega a `/checkout/pagar?order=<id>`.

- [ ] **Paso 1: Pantalla de firma**

`web/app/checkout/contrato/page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import estilos from './contrato.module.css';

interface Preparado {
  contractId: string; pdfUrl: string; documentHash: string; otpChallengeId: string;
}

export default function Contrato() {
  const router = useRouter();
  const orderId = useSearchParams().get('order')!;
  const marco = useRef<HTMLDivElement>(null);

  const [paso, setPaso] = useState<'datos' | 'lectura' | 'codigo'>('datos');
  const [preparado, setPreparado] = useState<Preparado | null>(null);
  const [leidoHastaElFinal, setLeido] = useState(false);
  const [consiente, setConsiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clave] = useState(() => crypto.randomUUID());

  async function preparar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const datos = new FormData(e.currentTarget);
    const res = await fetch(`/api/orders/${orderId}/contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': clave },
      body: JSON.stringify({
        fullName: datos.get('nombre'),
        documentId: datos.get('cedula'),
        phone: datos.get('telefono'),
      }),
    });
    if (!res.ok) { setError('No pudimos generar tu contrato. Inténtalo de nuevo.'); return; }
    setPreparado(await res.json());
    setPaso('lectura');
  }

  // La lectura completa es evidencia: se registra que tuvo el documento entero delante.
  useEffect(() => {
    const el = marco.current;
    if (!el || paso !== 'lectura') return;
    const alDesplazar = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLeido(true);
    };
    el.addEventListener('scroll', alDesplazar);
    alDesplazar();
    return () => el.removeEventListener('scroll', alDesplazar);
  }, [paso]);

  async function firmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const codigo = new FormData(e.currentTarget).get('codigo');
    const res = await fetch(`/api/orders/${orderId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: preparado!.contractId,
        otpChallengeId: preparado!.otpChallengeId,
        code: codigo,
        consentTextVersion: 'v1',
        scrolledToEnd: true,
      }),
    });
    if (!res.ok) { setError('El código no es válido o ya venció. Revisa tu correo.'); return; }
    router.push(`/checkout/pagar?order=${orderId}`);
  }

  if (paso === 'datos') {
    return (
      <form onSubmit={preparar} className={estilos.formulario}>
        <h1 className="mayusculas">Datos para el contrato</h1>
        <p className="tenue">Aparecerán en el contrato de compraventa que vas a firmar.</p>

        <label htmlFor="nombre">Nombre completo</label>
        <input id="nombre" name="nombre" required autoComplete="name" />

        <label htmlFor="cedula">Cédula</label>
        <input id="cedula" name="cedula" required inputMode="numeric" />

        <label htmlFor="telefono">Teléfono</label>
        <input id="telefono" name="telefono" required inputMode="tel" autoComplete="tel" />

        {error && <p role="alert">{error}</p>}
        <button type="submit">Generar contrato</button>
      </form>
    );
  }

  return (
    <form onSubmit={firmar} className={estilos.formulario}>
      <h1 className="mayusculas">Contrato de compraventa</h1>

      <div ref={marco} className={estilos.documento} tabIndex={0} aria-label="Contrato de compraventa">
        <iframe src={preparado!.pdfUrl} title="Contrato de compraventa" className={estilos.pdf} />
      </div>

      <a href={preparado!.pdfUrl} target="_blank" rel="noopener noreferrer" className="tenue">
        Abrir el contrato en otra pestaña
      </a>

      {!leidoHastaElFinal && (
        <p className="tenue">Desplázate hasta el final del documento para continuar.</p>
      )}

      <label className={estilos.consentimiento}>
        <input
          type="checkbox" checked={consiente} disabled={!leidoHastaElFinal}
          onChange={(e) => setConsiente(e.target.checked)}
        />
        Leí el contrato y acepto su contenido. Entiendo que mi firma electrónica
        tiene plena validez conforme a la Ley 527 de 1999.
      </label>

      {consiente && (
        <>
          <label htmlFor="codigo">Código enviado a tu correo</label>
          <input id="codigo" name="codigo" required inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
        </>
      )}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={!consiente}>Firmar y continuar al pago</button>
    </form>
  );
}
```

`web/app/checkout/contrato/contrato.module.css`:

```css
.formulario { padding: 4rem 1.5rem; max-width: 44rem; display: grid; gap: 0.75rem; }

.documento {
  height: 60vh;
  overflow-y: auto;
  border: 1px solid var(--linea);
}

.pdf { width: 100%; height: 150vh; border: 0; }

.consentimiento {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  border-top: 1px solid var(--linea);
  padding-top: 1rem;
}
.consentimiento input { width: auto; margin-top: 0.2rem; }
```

- [ ] **Paso 2: Verificación manual**

1. Llegar desde el checkout con un pedido que tenga pieza física → aparece el formulario de nombre y cédula.
2. Enviar → se muestra el PDF y llega el código al correo.
3. Antes de desplazar hasta el final: la casilla de consentimiento está deshabilitada y se lee la indicación.
4. Desplazar hasta el final → la casilla se habilita; al marcarla aparece el campo del código.
5. Escribir un código incorrecto → mensaje de error, sin avanzar, y el contrato sigue en `draft`.
6. Escribir el código correcto → navega al pago y el contrato queda `signed_pending_payment` con `evidence` completo en la base.

- [ ] **Paso 3: Commit**

```bash
git add web
git commit -m "feat(web): lectura obligatoria del contrato y firma con código"
```

---

## Tarea 6: Pago y resultado

**Archivos:**
- Crear: `web/app/checkout/pagar/page.tsx`, `web/app/checkout/resultado/page.tsx`

**Interfaces:**
- Consume: `POST /orders/:id/pay` → `{ checkoutUrl: string }`; `GET /me/orders`.
- Produce: rutas `/checkout/pagar?order=<id>` (redirige a Wompi) y `/checkout/resultado?order=<id>`.

- [ ] **Paso 1: Redirección a Wompi**

`web/app/checkout/pagar/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { apiSend } from '@/lib/api';

export default async function Pagar({
  searchParams,
}: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  if (!order) redirect('/');

  const { checkoutUrl } = await apiSend<{ checkoutUrl: string }>(
    `/orders/${order}/pay`, 'POST', {},
  );
  redirect(checkoutUrl);
}
```

- [ ] **Paso 2: Página de resultado**

`web/app/checkout/resultado/page.tsx`:

```tsx
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { OrderSummary } from '@/lib/tipos';

const MENSAJES: Record<string, { titulo: string; cuerpo: string }> = {
  paid: {
    titulo: 'Compra confirmada',
    cuerpo: 'Te enviamos el contrato firmado por correo. Pronto tendrás noticias del envío.',
  },
  pending: {
    titulo: 'Estamos confirmando tu pago',
    cuerpo: 'Con PSE esto puede tardar unos minutos. Te avisamos por correo apenas se confirme.',
  },
  failed: {
    titulo: 'El pago no se completó',
    cuerpo: 'No se hizo ningún cobro. Puedes intentarlo de nuevo si la pieza sigue disponible.',
  },
  expired: {
    titulo: 'El pedido venció',
    cuerpo: 'No se hizo ningún cobro. Puedes empezar de nuevo desde la pieza.',
  },
  refunded: {
    titulo: 'Te reembolsamos la compra',
    cuerpo: 'La pieza fue vendida antes de que se confirmara tu pago. El reembolso ya está en curso.',
  },
};

export default async function Resultado({
  searchParams,
}: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const pedidos = await apiGet<OrderSummary[]>('/me/orders', true);
  const pedido = pedidos.find((p) => p.id === order);

  const mensaje = MENSAJES[pedido?.status ?? 'pending'] ?? MENSAJES.pending;

  return (
    <section style={{ padding: '6rem 1.5rem', maxWidth: '34ch', display: 'grid', gap: '1rem' }}>
      <h1 className="mayusculas">{mensaje.titulo}</h1>
      <p>{mensaje.cuerpo}</p>
      {pedido && <p className="tenue mayusculas">Pedido {pedido.reference}</p>}
      <Link href="/cuenta" className="mayusculas">Ver mi cuenta</Link>
    </section>
  );
}
```

- [ ] **Paso 3: Verificación manual (sandbox de Wompi)**

1. Firmar el contrato y llegar a `/checkout/pagar` → redirige al checkout de Wompi con el monto correcto en centavos.
2. Pagar con una tarjeta de prueba aprobada del sandbox → vuelve a `/checkout/resultado` y, tras llegar el webhook, muestra «Compra confirmada».
3. Pagar con una tarjeta declinada → muestra «El pago no se completó» y la pieza vuelve a estar disponible en el catálogo.
4. Abrir el resultado antes de que llegue el webhook → muestra «Estamos confirmando tu pago».

- [ ] **Paso 4: Commit**

```bash
git add web
git commit -m "feat(web): redirección a Wompi y página de resultado del pedido"
```

---

## Tarea 7: Cuenta — pedidos y accesos

**Archivos:**
- Crear: `web/app/cuenta/page.tsx`, `web/app/cuenta/cuenta.module.css`

**Interfaces:**
- Consume: `GET /me/orders`, `GET /me/entitlements`.
- Produce: ruta `/cuenta`.

- [ ] **Paso 1: Página de cuenta**

`web/app/cuenta/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { haySesion } from '@/lib/sesion';
import { EntitlementSummary, OrderSummary } from '@/lib/tipos';
import { formatearFecha, formatearPrecio, tiempoRestante } from '@/lib/formato';
import estilos from './cuenta.module.css';

const ESTADO_PEDIDO: Record<string, string> = {
  pending: 'Confirmando pago',
  paid: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Vencido',
  refunded: 'Reembolsado',
};

function textoAcceso(e: EntitlementSummary): string {
  if (e.state === 'unopened') return 'Sin abrir';
  if (e.state === 'open') return `Abierto · quedan ${tiempoRestante(e.expiresAt!)}`;
  return `Visto ${formatearFecha(e.firstPlayedAt!)}`;
}

export default async function Cuenta() {
  if (!(await haySesion())) redirect('/entrar');

  const [pedidos, accesos] = await Promise.all([
    apiGet<OrderSummary[]>('/me/orders', true),
    apiGet<EntitlementSummary[]>('/me/entitlements', true),
  ]);

  return (
    <div className={estilos.cuenta}>
      <section>
        <h1 className="mayusculas">Pedidos</h1>
        {pedidos.length === 0 && <p className="tenue">Todavía no tienes pedidos.</p>}
        <ul className={estilos.lista}>
          {pedidos.map((p) => (
            <li key={p.id} className={estilos.fila}>
              <span className="mayusculas">{p.reference}</span>
              <span>{formatearPrecio(p.totalCop)}</span>
              <span className="mayusculas tenue">{ESTADO_PEDIDO[p.status] ?? p.status}</span>
              {p.trackingNumber && <span className="tenue">Guía {p.trackingNumber}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h1 className="mayusculas">Accesos</h1>
        {accesos.length === 0 && <p className="tenue">Todavía no tienes accesos.</p>}
        <ul className={estilos.lista}>
          {accesos.map((a) => (
            <li key={a.id} className={estilos.fila}>
              <span className="mayusculas">{a.dropTitle}</span>
              <span className="tenue mayusculas">{textoAcceso(a)}</span>
              {a.state !== 'consumed' && (
                <Link href={`/ver/${a.id}`} className="mayusculas">
                  {a.state === 'unopened' ? 'Abrir' : 'Continuar'}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

`web/app/cuenta/cuenta.module.css`:

```css
.cuenta { padding: 4rem 1.5rem; display: grid; gap: 4rem; max-width: 48rem; }

.lista { list-style: none; margin-top: 1rem; }

.fila {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--linea);
}
```

- [ ] **Paso 2: Verificación manual**

1. Sin sesión, abrir `/cuenta` → redirige a `/entrar`.
2. Con sesión y un pedido pagado → aparece con estado «Pagado».
3. Con un acceso sin abrir → dice «Sin abrir» y ofrece «Abrir».
4. Con un acceso ya abierto → dice «Abierto · quedan X h Y min» y ofrece «Continuar».
5. Con un acceso vencido → dice «Visto 13 AGO 2026» y no ofrece enlace.

- [ ] **Paso 3: Commit**

```bash
git add web
git commit -m "feat(web): cuenta con pedidos y estado de los accesos"
```

---

## Tarea 8: Visionado efímero

**Archivos:**
- Crear: `web/app/ver/[entitlementId]/page.tsx`, `web/app/ver/[entitlementId]/ver.module.css`
- Crear: `web/components/ReproductorEfimero.tsx`

**Interfaces:**
- Consume: `POST /entitlements/:id/play` → `{ token, expiresAt }`; `GET /me/entitlements`.
- Produce: ruta `/ver/[entitlementId]` con advertencia previa, reproductor y marca de agua.

- [ ] **Paso 1: Reproductor**

`web/components/ReproductorEfimero.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { tiempoRestante } from '@/lib/formato';

export function ReproductorEfimero({
  token, expiresAt, correo,
}: { token: string; expiresAt: string; correo: string }) {
  const [restante, setRestante] = useState(() => tiempoRestante(expiresAt));

  useEffect(() => {
    const id = setInterval(() => setRestante(tiempoRestante(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div style={{ position: 'relative' }}>
      <iframe
        src={`https://iframe.videodelivery.net/${token}`}
        title="Video del artista"
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
        allowFullScreen
        style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }}
      />
      {/* Marca de agua: no impide grabar, hace rastreable el compartir. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', right: '1rem', bottom: '1rem',
          color: 'rgba(255,255,255,0.55)', fontSize: '0.6875rem',
          pointerEvents: 'none', letterSpacing: '0.08em',
        }}
      >
        {correo}
      </span>
      <p className="mayusculas tenue" style={{ paddingTop: '0.75rem' }}>
        Tu ventana se cierra en {restante}
      </p>
    </div>
  );
}
```

- [ ] **Paso 2: Página con advertencia previa**

`web/app/ver/[entitlementId]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ReproductorEfimero } from '@/components/ReproductorEfimero';
import estilos from './ver.module.css';

export default function Ver() {
  const { entitlementId } = useParams<{ entitlementId: string }>();
  const [sesion, setSesion] = useState<{ token: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [correo, setCorreo] = useState('');

  async function abrir() {
    setAbriendo(true);
    setError(null);
    const res = await fetch(`/api/entitlements/${entitlementId}/play`, { method: 'POST' });
    if (res.status === 403) {
      setError('Tu ventana ya se cerró. Este video no vuelve a abrirse.');
      setAbriendo(false);
      return;
    }
    if (!res.ok) {
      setError('No pudimos abrir el video. Inténtalo de nuevo.');
      setAbriendo(false);
      return;
    }
    const datos = await res.json();
    setSesion({ token: datos.token, expiresAt: datos.expiresAt });
    setCorreo(datos.viewerEmail ?? '');
  }

  if (sesion) {
    return (
      <section className={estilos.ver}>
        <ReproductorEfimero token={sesion.token} expiresAt={sesion.expiresAt} correo={correo} />
      </section>
    );
  }

  return (
    <section className={estilos.aviso}>
      <h1 className="mayusculas">Antes de reproducir</h1>
      <p>
        Al darle play se abre tu ventana de 24 horas. Dentro de ese tiempo puedes
        salir y volver las veces que quieras, incluso desde otro dispositivo.
      </p>
      <p>Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={abrir} disabled={abriendo}>
        {abriendo ? 'Abriendo…' : 'Entiendo, reproducir'}
      </button>
    </section>
  );
}
```

`web/app/ver/[entitlementId]/ver.module.css`:

```css
.aviso {
  padding: 6rem 1.5rem;
  max-width: 40ch;
  display: grid;
  gap: 1rem;
}

.ver { padding: 1.5rem; max-width: 68rem; margin: 0 auto; }
```

- [ ] **Paso 3: Añadir el correo del espectador a la respuesta de la API**

En `api/src/playback/playback.service.ts`, ampliar el retorno de `play` para incluir el correo, que la marca de agua necesita:

```ts
  ): Promise<{ token: string; expiresAt: Date; viewerEmail: string }> {
```

y antes del `return`:

```ts
    const [viewer] = await this.ds.query(`SELECT email FROM users WHERE id=$1`, [userId]);
    return { token, expiresAt: new Date(ent.expires_at), viewerEmail: viewer.email };
```

Actualizar en `api/test/integration/playback.spec.ts` la primera aserción:

```ts
    expect(res.token).toBe('signed-token-abc');
    expect(res.viewerEmail).toContain('@');
```

Ejecutar: `cd api && npx jest test/integration/playback.spec.ts`
Esperado: PASA — 6 pruebas.

- [ ] **Paso 4: Verificación manual**

1. Abrir `/ver/<id>` de un acceso sin abrir → se ve la advertencia, no el video.
2. Pulsar «Entiendo, reproducir» → aparece el reproductor, la marca de agua con el correo y «Tu ventana se cierra en 23 h 59 min».
3. Recargar la página y volver a entrar → el video sigue disponible y el contador refleja el tiempo real transcurrido.
4. Forzar el vencimiento en la base (`UPDATE entitlements SET expires_at = now() - interval '1 minute'`) y recargar → al pulsar reproducir, el mensaje dice que la ventana ya se cerró.
5. Abrir el `/ver/<id>` de otra persona → error, sin filtrar el video.

- [ ] **Paso 5: Commit**

```bash
git add web api
git commit -m "feat(web): visionado efímero con advertencia previa y marca de agua"
```

---

## Tarea 9: Studio — publicar piezas y drops

**Archivos:**
- Crear: `web/app/studio/layout.tsx`, `web/app/studio/page.tsx`, `web/app/studio/studio.module.css`

**Interfaces:**
- Consume: `POST /admin/pieces`, `PATCH /admin/pieces/:id/publish`, `POST /admin/drops`, `PATCH /admin/drops/:id/publish`, `PATCH /admin/drops/:id/capacity`.
- Produce: rutas `/studio` (protegida por rol admin).

- [ ] **Paso 1: Marco protegido**

`web/app/studio/layout.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // Si la API responde 403, esta persona no es el artista.
  try {
    await apiGet<unknown[]>('/admin/orders', true);
  } catch {
    redirect('/');
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <nav className="mayusculas" style={{ display: 'flex', gap: '1.5rem', paddingBottom: '2rem' }}>
        <Link href="/studio">Piezas y drops</Link>
        <Link href="/studio/pedidos">Pedidos</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Paso 2: Formularios de publicación**

`web/app/studio/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import estilos from './studio.module.css';

const COMISION_FIJA = 900;
const COMISION_PORCENTAJE = 0.0265;

function neto(precio: number): { recibe: number; porcentaje: number } {
  const comision = Math.round(precio * COMISION_PORCENTAJE) + COMISION_FIJA;
  const recibe = Math.max(0, precio - comision);
  return { recibe, porcentaje: precio > 0 ? Math.round((comision / precio) * 100) : 0 };
}

export default function Studio() {
  const [precioDrop, setPrecioDrop] = useState(15000);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function crearPieza(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/pieces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: d.get('slug'),
        title: d.get('titulo'),
        description: d.get('descripcion'),
        story: d.get('historia'),
        personalNote: d.get('nota'),
        priceCop: Number(d.get('precio')),
        images: String(d.get('imagenes')).split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    setMensaje(res.ok ? 'Pieza creada en borrador.' : 'No se pudo crear la pieza.');
  }

  async function crearDrop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const capacidadTexto = String(d.get('capacidad')).trim();
    const res = await fetch('/api/admin/drops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: d.get('slug'),
        title: d.get('titulo'),
        description: d.get('descripcion'),
        priceCop: Number(d.get('precio')),
        videoAssetId: d.get('video'),
        capacity: capacidadTexto === '' ? null : Number(capacidadTexto),
        viewWindowHours: Number(d.get('ventana')),
      }),
    });
    setMensaje(res.ok ? 'Drop creado en borrador.' : 'No se pudo crear el drop.');
  }

  const n = neto(precioDrop);

  return (
    <div className={estilos.studio}>
      {mensaje && <p role="status" className="mayusculas">{mensaje}</p>}

      <form onSubmit={crearPieza} className={estilos.formulario}>
        <h2 className="mayusculas">Nueva pieza</h2>
        <label htmlFor="p-slug">Identificador en la URL</label>
        <input id="p-slug" name="slug" required pattern="[a-z0-9-]+" />
        <label htmlFor="p-titulo">Título</label>
        <input id="p-titulo" name="titulo" required />
        <label htmlFor="p-desc">Descripción</label>
        <textarea id="p-desc" name="descripcion" rows={3} />
        <label htmlFor="p-hist">Procedencia</label>
        <textarea id="p-hist" name="historia" rows={4} />
        <label htmlFor="p-nota">Nota personal para quien la compre</label>
        <textarea id="p-nota" name="nota" rows={3} />
        <label htmlFor="p-precio">Precio en pesos</label>
        <input id="p-precio" name="precio" type="number" min={1} required />
        <label htmlFor="p-img">Imágenes de Cloudinary, separadas por coma</label>
        <input id="p-img" name="imagenes" required />
        <button type="submit">Crear en borrador</button>
      </form>

      <form onSubmit={crearDrop} className={estilos.formulario}>
        <h2 className="mayusculas">Nuevo drop</h2>
        <label htmlFor="d-slug">Identificador en la URL</label>
        <input id="d-slug" name="slug" required pattern="[a-z0-9-]+" />
        <label htmlFor="d-titulo">Título</label>
        <input id="d-titulo" name="titulo" required />
        <label htmlFor="d-desc">Descripción</label>
        <textarea id="d-desc" name="descripcion" rows={3} />
        <label htmlFor="d-video">Identificador del video en Cloudflare Stream</label>
        <input id="d-video" name="video" required />

        <label htmlFor="d-precio">Precio en pesos</label>
        <input
          id="d-precio" name="precio" type="number" min={1} required
          value={precioDrop} onChange={(e) => setPrecioDrop(Number(e.target.value))}
        />
        {/* Información en el punto de decisión, no una restricción. */}
        <p className="tenue">
          Recibes aproximadamente ${n.recibe.toLocaleString('es-CO')} COP
          ({n.porcentaje}% se va en comisión).
          {precioDrop < 15000 && ' Desde $15.000 COP la comisión baja a cerca del 8%.'}
        </p>

        <label htmlFor="d-cap">Cupos (vacío = sin límite)</label>
        <input id="d-cap" name="capacidad" type="number" min={1} />
        <label htmlFor="d-ventana">Horas de la ventana de visionado</label>
        <input id="d-ventana" name="ventana" type="number" min={1} defaultValue={24} required />
        <button type="submit">Crear en borrador</button>
      </form>
    </div>
  );
}
```

`web/app/studio/studio.module.css`:

```css
.studio {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  gap: 3rem;
  max-width: 64rem;
}

.formulario { display: grid; gap: 0.5rem; align-content: start; }
```

- [ ] **Paso 3: Verificación manual**

1. Con un usuario sin `is_admin`, abrir `/studio` → redirige a la portada.
2. Marcar `is_admin = true` en la base para tu usuario y recargar → se ve el panel.
3. Crear una pieza → aparece en la base con `status='draft'` y no sale en el catálogo público.
4. En el formulario de drop, escribir 4000 en el precio → el texto dice que recibes cerca de $2.194 y sugiere $15.000. Escribir 15000 → el porcentaje baja.
5. Dejar el campo de cupos vacío → se crea el drop con `capacity NULL`.

- [ ] **Paso 4: Commit**

```bash
git add web
git commit -m "feat(web): studio para crear piezas y drops con guía de comisión"
```

---

## Tarea 10: Studio — pedidos y contratos

**Archivos:**
- Crear: `web/app/studio/pedidos/page.tsx`, `web/app/studio/pedidos/pedidos.module.css`

**Interfaces:**
- Consume: `GET /admin/orders`, `POST /admin/orders/:id/ship`, `GET /admin/contracts`.
- Produce: ruta `/studio/pedidos`.

- [ ] **Paso 1: Listado y marcado de envío**

`web/app/studio/pedidos/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { formatearFecha, formatearPrecio } from '@/lib/formato';
import estilos from './pedidos.module.css';

interface PedidoAdmin {
  id: string; reference: string; status: string; total_cop: number;
  created_at: string; tracking_number: string | null;
  shipping_address: { line1?: string; city?: string; phone?: string } | null;
  email: string; full_name: string | null;
}
interface ContratoAdmin {
  id: string; pdf_url: string; status: string; signed_at: string | null;
  reference: string; full_name: string | null; document_id: string | null;
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [contratos, setContratos] = useState<ContratoAdmin[]>([]);

  async function cargar() {
    const [p, c] = await Promise.all([
      fetch('/api/admin/orders').then((r) => r.json()),
      fetch('/api/admin/contracts').then((r) => r.json()),
    ]);
    setPedidos(p);
    setContratos(c);
  }

  useEffect(() => { void cargar(); }, []);

  async function marcarEnviado(id: string, guia: string) {
    await fetch(`/api/admin/orders/${id}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber: guia }),
    });
    await cargar();
  }

  return (
    <div className={estilos.pagina}>
      <section>
        <h2 className="mayusculas">Pedidos</h2>
        <ul className={estilos.lista}>
          {pedidos.map((p) => (
            <li key={p.id} className={estilos.pedido}>
              <div>
                <span className="mayusculas">{p.reference}</span>{' '}
                <span className="tenue">{formatearFecha(p.created_at)}</span>
              </div>
              <div>{p.full_name ?? p.email} · {formatearPrecio(p.total_cop)}</div>
              <div className="mayusculas tenue">{p.status}</div>
              {p.shipping_address && (
                <div className="tenue">
                  {p.shipping_address.line1}, {p.shipping_address.city} · {p.shipping_address.phone}
                </div>
              )}
              {p.status === 'paid' && !p.tracking_number && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const guia = String(new FormData(e.currentTarget).get('guia'));
                    void marcarEnviado(p.id, guia);
                  }}
                  className={estilos.envio}
                >
                  <label htmlFor={`guia-${p.id}`} className="tenue">Número de guía</label>
                  <input id={`guia-${p.id}`} name="guia" required />
                  <button type="submit">Marcar enviado</button>
                </form>
              )}
              {p.tracking_number && <div className="tenue">Guía {p.tracking_number}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mayusculas">Contratos</h2>
        <ul className={estilos.lista}>
          {contratos.map((c) => (
            <li key={c.id} className={estilos.pedido}>
              <span className="mayusculas">{c.reference}</span>
              <span>{c.full_name} · {c.document_id}</span>
              <span className="mayusculas tenue">
                {c.status}{c.signed_at ? ` · ${formatearFecha(c.signed_at)}` : ''}
              </span>
              <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="mayusculas">
                Descargar
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

`web/app/studio/pedidos/pedidos.module.css`:

```css
.pagina { display: grid; gap: 4rem; max-width: 56rem; }

.lista { list-style: none; margin-top: 1rem; }

.pedido {
  display: grid;
  gap: 0.25rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--linea);
}

.envio { display: flex; gap: 0.5rem; align-items: end; padding-top: 0.5rem; }
.envio input { max-width: 16rem; }
```

- [ ] **Paso 2: Verificación manual**

1. Abrir `/studio/pedidos` con un pedido pagado → aparece con la dirección completa y el formulario de guía.
2. Escribir una guía y enviar → la lista se recarga y muestra «Guía …», sin el formulario.
3. Un pedido `pending` no muestra formulario de envío.
4. En contratos, clic en «Descargar» → abre el PDF firmado en otra pestaña.

- [ ] **Paso 3: Verificación de extremo a extremo**

Recorrido completo, con la API y la web corriendo contra el sandbox de Wompi:

1. Desde `/studio`, crear una pieza y publicarla.
2. En una ventana de incógnito, entrar con otro correo, abrir el catálogo y comprar la pieza.
3. Firmar el contrato con el código del correo.
4. Pagar con tarjeta aprobada del sandbox.
5. Verificar en `/cuenta` que el pedido dice «Pagado».
6. Verificar en `/studio/pedidos` que aparece la dirección y el contrato firmado.
7. Marcar enviado con una guía y confirmar que la guía se ve en `/cuenta`.
8. Volver al catálogo y confirmar que la pieza aparece como vendida y ya no tiene botón de compra.

- [ ] **Paso 4: Commit**

```bash
git add web
git commit -m "feat(web): studio de pedidos, envíos y contratos firmados"
```

---

## Autorrevisión

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| §7 flujo de compra con firma | 4, 5, 6 |
| §8 visionado efímero | 8 |
| §10 panel del artista | 9, 10 |
| §11 principios de interfaz | 1 (paleta, tipografía, foco), 2 (estado en palabras), todas |
| §2 guía de comisión sin restricción | 9 |
| §12 casos borde visibles al usuario | 6 (pendiente, fallido, reembolsado), 8 (ventana cerrada) |

**Consistencia de tipos verificada:** `lib/tipos.ts` reproduce literalmente `PieceSummary`, `PieceDetail`, `DropDetail`, `OrderSummary` y `EntitlementSummary` de las tareas 11 y 12 del plan 1. La tarea 8 modifica la firma de `PlaybackService.play` en la API para incluir `viewerEmail` y actualiza su prueba en el mismo paso — es el único punto donde este plan toca código del plan 1, y queda declarado.

**Deuda declarada:** el `layout.tsx` de `/studio` detecta el rol admin llamando a `/admin/orders` y capturando el fallo. Funciona y no requiere endpoint nuevo, pero si el panel crece conviene un `GET /me` que devuelva `isAdmin`.
