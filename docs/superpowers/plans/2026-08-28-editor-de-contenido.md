# Editor de contenido desde /studio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un panel en `/studio/contenido` para que el artista cambie 43 textos
editoriales de la tienda sin tocar código, con un mecanismo `content(key,
fallback)` en el web que resuelve overrides guardados en Postgres.

**Architecture:** una tabla nueva `content_overrides` (clave → texto) con un
`ContentService` de solo-SQL-crudo (mismo estilo que `AdminService`), un
endpoint público `GET /content` que la tienda consulta una vez por
request, y tres endpoints `/admin/content` para el panel. En el web, un
helper `content()` para Server Components y un `ContentProvider` +
`useContent()` para los pocos componentes cliente que muestran alguno de
estos 43 textos.

**Tech Stack:** NestJS + TypeORM (SQL crudo vía `DataSource`, sin entidad
nueva — sigue el patrón de `AdminService`/`ExchangeRateService`, no el de
`Piece`/`Drop`) + Postgres; Next.js App Router (Server Components +
`fetch` con `next.tags`, un Context de React para el resto).

**Spec:** `docs/superpowers/specs/2026-08-28-editor-de-contenido-design.md`

## Global Constraints

- Código en inglés, producto (textos de interfaz, incluidas las 43 claves)
  en español.
- Las 43 claves nunca se siembran: sin overrides, `GET /content` devuelve
  `{}` y cada pantalla se ve exactamente igual que hoy (el `fallback` de
  cada `content(key, fallback)` es el texto que ya existe en el código).
- `/admin/content/*` exige `AccountGuard` + `AdminGuard`, igual que el
  resto de `/admin/*`. `GET /content` es público, sin guard.
- Ninguna de las 43 claves lleva una parte dinámica interpolada (fecha,
  título, número de horas): esos 3 textos (`checkout.signature.checkboxLabel`,
  el cuerpo de `watch.closed`, el cuerpo de `watch.intro`) quedan fuera del
  editor y siguen hardcodeados, tal como quedó decidido tras el spec.
- **Desviación del spec, decidida durante este plan:** el spec listaba
  `checkout.emailNotice.body` como un solo texto, pero en el código real
  ese párrafo termina en una oración con un `<Link>` interactivo
  (`¿Ya tienes cuenta? <Link href="/entrar?next=/checkout">Entra</Link>
  para ver tus pedidos anteriores.`). Un `<textarea>` de texto plano no
  puede contener ese enlace sin arriesgarse a que el artista lo borre por
  accidente. La clave editable se acorta a la primera oración
  (`"Ahí te llegan el recibo y, si compras una pieza, el código para
  firmar el contrato."`) y la oración del enlace queda fija en el JSX,
  fuera del editor — ver Task 7.
- **Desviación del spec, decidida durante este plan:** el spec asumía que
  los 43 lugares vivían en Server Components salvo `EphemeralPlayer.tsx`.
  Al revisar el código, `web/app/carrito/page.tsx`, `web/app/checkout/page.tsx`
  y `web/app/checkout/contrato/page.tsx` son en realidad Client Components
  (`'use client'`, leen el carrito de `localStorage`). `content()` es
  `async` y no se puede invocar con `await` dentro de un Client Component.
  Mecanismo elegido: un `ContentProvider` (Context de React) montado una
  sola vez en `RootLayout` con el mapa completo de overrides, y un hook
  `useContent(key, fallback)` que lo lee — ver Task 4. Los Server
  Components siguen usando `content()` con `await` directo, sin el
  Provider.

---

### Task 1: Migración + `content-keys.ts` + `ContentService`

**Files:**
- Create: `api/src/database/migrations/1756200000000-content-overrides.ts`
- Create: `api/src/content/content-keys.ts`
- Create: `api/src/content/content.service.ts`
- Test: `api/test/integration/content.spec.ts`

**Interfaces:**
- Produces: `CONTENT_KEYS: ContentKeyDef[]` donde
  `interface ContentKeyDef { key: string; section: string; defaultValue: string }`.
- Produces: `ContentService` con
  `getOverrides(): Promise<Record<string, string>>`,
  `listForAdmin(): Promise<AdminContentItem[]>` donde
  `interface AdminContentItem { key: string; section: string; defaultValue: string; currentValue: string; hasOverride: boolean }`,
  `setOverride(key: string, value: string, updatedBy: string): Promise<void>`
  (lanza `BadRequestException('UNKNOWN_KEY')` si `key` no está en
  `CONTENT_KEYS`), `resetOverride(key: string): Promise<void>` (mismo
  chequeo de `UNKNOWN_KEY`; borrar algo sin override no es un error).

- [ ] **Step 1: Escribir la migración**

```ts
// api/src/database/migrations/1756200000000-content-overrides.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los textos editoriales que el artista puede cambiar desde /studio sin
 * tocar código. Solo existe una fila por clave que en efecto se cambió —
 * el texto original vive en el código (CONTENT_KEYS), no aquí, así que no
 * hace falta sembrar nada al lanzar esta función.
 */
export class ContentOverrides1756200000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE content_overrides (
        key varchar PRIMARY KEY,
        value text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NOT NULL REFERENCES users(id)
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE content_overrides`);
  }
}
```

- [ ] **Step 2: Correr la migración contra la base de prueba**

Run: `cd api && npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`
Expected: `ContentOverrides1756200000000` aparece en la salida como aplicada.
(Si prefieres verificarlo dentro del test en vez de a mano, el `testDb()`
del Step 4 ya corre las migraciones pendientes por su cuenta.)

- [ ] **Step 3: Escribir `content-keys.ts`**

```ts
// api/src/content/content-keys.ts

/**
 * Los 43 textos editoriales de la tienda. El texto de aquí es el que se
 * usa el día que nadie ha cambiado nada — content_overrides solo guarda
 * las claves que en efecto se cambiaron.
 *
 * Tres textos con una parte dinámica incrustada (el título de la pieza en
 * el checkbox de firma, la fecha en el cierre de ventana, las horas en el
 * aviso antes de reproducir) quedan fuera a propósito: un texto plano no
 * puede sustituirlos sin perder esa parte.
 */
export interface ContentKeyDef {
  key: string;
  section: string;
  defaultValue: string;
}

export const CONTENT_KEYS: ContentKeyDef[] = [
  { key: 'home.empty.body', section: 'Home', defaultValue: 'Aún no hay nada publicado.' },

  { key: 'artist.meta.title', section: 'Artista', defaultValue: 'Toryteler — quién es' },
  { key: 'artist.meta.description', section: 'Artista', defaultValue: 'Quién es el artista detrás de las piezas.' },
  { key: 'artist.role', section: 'Artista', defaultValue: 'Músico y archivista de lo suyo' },
  { key: 'artist.bio.paragraph1', section: 'Artista', defaultValue: 'Grabo desde 2019, casi siempre de noche y casi siempre en cuartos prestados. Lo que hago no cabe en un disco: cabe en las cajas donde guardo lo que sobró.' },
  { key: 'artist.bio.paragraph2', section: 'Artista', defaultValue: 'Esta tienda existe porque me cansé de que esas cajas se quedaran cerradas. Cada pieza que está aquí estuvo antes en un estudio, en un bus o en el piso de mi casa, y tiene una historia que puedo contar entera.' },
  { key: 'artist.bio.paragraph3', section: 'Artista', defaultValue: 'No hay reediciones. Lo que se va, se fue.' },
  { key: 'artist.socials.title', section: 'Artista', defaultValue: 'Dónde encontrarlo' },

  { key: 'site.meta.description', section: 'Marca global', defaultValue: 'Piezas únicas y contenido personal del artista.' },
  { key: 'site.nav.homeLabel', section: 'Marca global', defaultValue: 'La casa de Tory' },

  { key: 'cart.empty.body', section: 'Carrito', defaultValue: 'No tienes nada en el carrito.' },
  { key: 'cart.empty.cta', section: 'Carrito', defaultValue: 'Ver la casa de Tory' },
  { key: 'cart.contractNotice.body', section: 'Carrito', defaultValue: 'Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu cédula a mano.' },

  { key: 'checkout.empty.body', section: 'Checkout', defaultValue: 'No tienes nada en el carrito.' },
  { key: 'checkout.emailNotice.body', section: 'Checkout', defaultValue: 'Ahí te llegan el recibo y, si compras una pieza, el código para firmar el contrato.' },
  { key: 'checkout.signature.note', section: 'Checkout', defaultValue: 'Sin costo. Firmarla toma unos días más antes de que salga el envío.' },
  { key: 'checkout.addressNotice.body', section: 'Checkout', defaultValue: 'En el siguiente paso firmarás el contrato de compraventa. Ten a mano tu cédula.' },

  { key: 'checkout.invalidLink.body', section: 'Contrato', defaultValue: 'Este enlace no lleva a ningún pedido.' },
  { key: 'checkout.contract.intro', section: 'Contrato', defaultValue: 'Estos datos van en el documento que vas a firmar, así que tienen que coincidir con tu cédula.' },
  { key: 'checkout.contract.otpIntro', section: 'Contrato', defaultValue: 'Te enviamos un código de seis dígitos a tu correo. Lee el documento y fírmalo con ese código.' },
  { key: 'checkout.contract.mustOpenNotice', section: 'Contrato', defaultValue: 'Abre el documento para poder confirmarlo.' },
  { key: 'checkout.contract.signBeforePayNotice', section: 'Contrato', defaultValue: 'Firmas antes de pagar. Si el pago no se completa, el contrato queda anulado.' },

  { key: 'checkout.pay.gatewayNotice', section: 'Pagar', defaultValue: 'Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.' },
  { key: 'checkout.pay.securityNotice', section: 'Pagar', defaultValue: 'Los datos de tu tarjeta no pasan por esta tienda.' },

  { key: 'checkout.result.pending.title', section: 'Resultado del pago', defaultValue: 'Confirmando tu pago' },
  { key: 'checkout.result.pending.body', section: 'Resultado del pago', defaultValue: 'La pasarela todavía no nos ha confirmado el cobro. Esto suele tardar segundos; te escribimos al correo en cuanto quede.' },
  { key: 'checkout.result.paid.title', section: 'Resultado del pago', defaultValue: 'Listo' },
  { key: 'checkout.result.paid.body', section: 'Resultado del pago', defaultValue: 'Tu compra quedó confirmada. Te enviamos el correo con el detalle y, si compraste una pieza, el contrato firmado.' },
  { key: 'checkout.result.failed.title', section: 'Resultado del pago', defaultValue: 'El pago no se completó' },
  { key: 'checkout.result.failed.body', section: 'Resultado del pago', defaultValue: 'No te cobramos nada y lo que habías apartado volvió a la tienda. Puedes intentarlo otra vez.' },
  { key: 'checkout.result.expired.title', section: 'Resultado del pago', defaultValue: 'El pedido venció' },
  { key: 'checkout.result.expired.body', section: 'Resultado del pago', defaultValue: 'Pasó demasiado tiempo sin completar el pago, así que soltamos lo que tenías apartado.' },
  { key: 'checkout.result.refunded.title', section: 'Resultado del pago', defaultValue: 'Te devolvimos el dinero' },
  { key: 'checkout.result.refunded.body', section: 'Resultado del pago', defaultValue: 'Alguien se adelantó con lo que compraste, así que reembolsamos el valor completo.' },
  { key: 'checkout.result.notFound.title', section: 'Resultado del pago', defaultValue: 'No encontramos ese pedido' },
  { key: 'checkout.result.notFound.body', section: 'Resultado del pago', defaultValue: 'Puede que sea de otra cuenta. Mira tus pedidos para comprobarlo.' },

  { key: 'piece.detail.includesNote', section: 'Pieza', defaultValue: 'Incluye una nota escrita por el artista y el contrato de compraventa firmado.' },
  { key: 'piece.detail.soldBody', section: 'Pieza', defaultValue: 'Esta pieza ya encontró dueño.' },
  { key: 'piece.detail.notForSaleBody', section: 'Pieza', defaultValue: 'No está a la venta.' },

  { key: 'drop.detail.soldOutBody', section: 'Drop', defaultValue: 'Ya no quedan seats.' },

  { key: 'watch.closed.title', section: 'Reproductor', defaultValue: 'Tu ventana se cerró.' },
  { key: 'watch.intro.title', section: 'Reproductor', defaultValue: 'Antes de reproducir' },
  { key: 'watch.intro.warning', section: 'Reproductor', defaultValue: 'Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez.' },
];

export const CONTENT_KEY_SET = new Set(CONTENT_KEYS.map((k) => k.key));
```

- [ ] **Step 4: Prueba de `ContentService` — escribirla, verla fallar**

```ts
// api/test/integration/content.spec.ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { ContentService } from '../../src/content/content.service';

describe('content overrides', () => {
  let ds: DataSource;
  let content: ContentService;
  let adminId: string;

  beforeAll(async () => {
    ds = await testDb();
    content = new ContentService(ds);
  });

  beforeEach(async () => {
    await truncateAll(ds);
    const [u] = await ds.query(
      `INSERT INTO users (email, is_admin) VALUES ('tory@toryteler.co', true) RETURNING id`,
    );
    adminId = u.id;
  });
  afterAll(async () => { await ds.destroy(); });

  it('sin overrides, el mapa está vacío', async () => {
    expect(await content.getOverrides()).toEqual({});
  });

  it('guarda un override y lo devuelve', async () => {
    await content.setOverride('home.empty.body', 'Todavía nada, vuelve pronto.', adminId);
    expect(await content.getOverrides()).toEqual({
      'home.empty.body': 'Todavía nada, vuelve pronto.',
    });
  });

  it('guardar dos veces la misma clave actualiza, no duplica', async () => {
    await content.setOverride('home.empty.body', 'Primero', adminId);
    await content.setOverride('home.empty.body', 'Segundo', adminId);
    expect(await content.getOverrides()).toEqual({ 'home.empty.body': 'Segundo' });
  });

  it('rechaza una clave que no existe', async () => {
    await expect(content.setOverride('no.existe', 'x', adminId)).rejects.toThrow(/UNKNOWN_KEY/);
  });

  it('listForAdmin trae las 43 con hasOverride correcto', async () => {
    await content.setOverride('home.empty.body', 'Cambiado', adminId);
    const list = await content.listForAdmin();
    expect(list).toHaveLength(43);
    const home = list.find((i) => i.key === 'home.empty.body')!;
    expect(home).toEqual({
      key: 'home.empty.body',
      section: 'Home',
      defaultValue: 'Aún no hay nada publicado.',
      currentValue: 'Cambiado',
      hasOverride: true,
    });
    const untouched = list.find((i) => i.key === 'cart.empty.body')!;
    expect(untouched).toEqual({
      key: 'cart.empty.body',
      section: 'Carrito',
      defaultValue: 'No tienes nada en el carrito.',
      currentValue: 'No tienes nada en el carrito.',
      hasOverride: false,
    });
  });

  it('restablecer borra el override', async () => {
    await content.setOverride('home.empty.body', 'Cambiado', adminId);
    await content.resetOverride('home.empty.body');
    expect(await content.getOverrides()).toEqual({});
  });

  it('restablecer algo que nunca se cambió no falla', async () => {
    await expect(content.resetOverride('home.empty.body')).resolves.toBeUndefined();
  });

  it('restablecer una clave que no existe sí falla', async () => {
    await expect(content.resetOverride('no.existe')).rejects.toThrow(/UNKNOWN_KEY/);
  });
});
```

Run: `cd api && npx jest content.spec -v`
Expected: FAIL — `Cannot find module '../../src/content/content.service'`.

- [ ] **Step 5: Implementar `ContentService`**

```ts
// api/src/content/content.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { returnedRows } from '../database/rows';
import { CONTENT_KEY_SET, CONTENT_KEYS } from './content-keys';

export interface AdminContentItem {
  key: string;
  section: string;
  defaultValue: string;
  currentValue: string;
  hasOverride: boolean;
}

@Injectable()
export class ContentService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** El mapa completo de lo que el artista ha cambiado. Nunca las 43 claves. */
  async getOverrides(): Promise<Record<string, string>> {
    const rows = returnedRows<{ key: string; value: string }>(
      await this.ds.query(`SELECT key, value FROM content_overrides`),
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Las 43 claves conocidas, cada una con su override si lo tiene. */
  async listForAdmin(): Promise<AdminContentItem[]> {
    const overrides = await this.getOverrides();
    return CONTENT_KEYS.map((def) => ({
      key: def.key,
      section: def.section,
      defaultValue: def.defaultValue,
      currentValue: overrides[def.key] ?? def.defaultValue,
      hasOverride: def.key in overrides,
    }));
  }

  async setOverride(key: string, value: string, updatedBy: string): Promise<void> {
    if (!CONTENT_KEY_SET.has(key)) throw new BadRequestException('UNKNOWN_KEY');
    await this.ds.query(
      `INSERT INTO content_overrides (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()`,
      [key, value, updatedBy],
    );
  }

  async resetOverride(key: string): Promise<void> {
    if (!CONTENT_KEY_SET.has(key)) throw new BadRequestException('UNKNOWN_KEY');
    await this.ds.query(`DELETE FROM content_overrides WHERE key = $1`, [key]);
  }
}
```

- [ ] **Step 6: Correr la prueba y verificar que pasa**

Run: `cd api && npx jest content.spec -v`
Expected: 8 tests, todos en verde.

- [ ] **Step 7: Commit**

```bash
git add api/src/database/migrations/1756200000000-content-overrides.ts \
  api/src/content/content-keys.ts api/src/content/content.service.ts \
  api/test/integration/content.spec.ts
git commit -m "feat(api): tabla y servicio de overrides de contenido"
```

---

### Task 2: `ContentController` + `AdminContentController` + wiring

**Files:**
- Create: `api/src/content/content.controller.ts`
- Create: `api/src/content/admin-content.controller.ts`
- Modify: `api/src/app.module.ts`
- Modify: `api/test/integration/wiring.spec.ts`

**Interfaces:**
- Consumes: `ContentService` (Task 1), `AccountGuard`/`AdminGuard` (`api/src/auth/session.guard.ts`, ya existen).
- Produces: `GET /content` (público), `GET /admin/content`, `PUT /admin/content/:key`, `DELETE /admin/content/:key` (los 3 con `AccountGuard, AdminGuard`).

- [ ] **Step 1: Los dos controladores**

```ts
// api/src/content/content.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  overrides() {
    return this.content.getOverrides();
  }
}
```

```ts
// api/src/content/admin-content.controller.ts
import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import type { Request } from 'express';
import { AccountGuard, AdminGuard } from '../auth/session.guard';
import { ContentService } from './content.service';

class UpdateContentDto {
  @IsString() @IsNotEmpty() value!: string;
}

type Authenticated = Request & { user: { id: string } };

/** Los 43 textos editoriales, para el panel de /studio/contenido. */
@Controller('admin/content')
@UseGuards(AccountGuard, AdminGuard)
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list() {
    return this.content.listForAdmin();
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() body: UpdateContentDto,
    @Req() req: Authenticated,
  ) {
    await this.content.setOverride(key, body.value, req.user.id);
    return { ok: true };
  }

  @Delete(':key')
  async reset(@Param('key') key: string) {
    await this.content.resetOverride(key);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Registrar en `app.module.ts`**

Agrega los imports junto a los del resto de `content/` (alfabético con los
existentes) y regístralos en `controllers`/`providers`:

```ts
// api/src/app.module.ts — agregar a los imports existentes
import { AdminContentController } from './content/admin-content.controller';
import { ContentController } from './content/content.controller';
import { ContentService } from './content/content.service';
```

```ts
// api/src/app.module.ts — dentro de controllers: [...]
    AdminController,
    AdminContentController,
    ContentController,
```

```ts
// api/src/app.module.ts — dentro de providers: [...]
    AdminService,
    ContentService,
```

- [ ] **Step 3: Prueba de wiring — escribirla, verla fallar**

Añade al final de `api/test/integration/wiring.spec.ts`, dentro del
`describe('http wiring', ...)` ya existente (usa el `session()` helper y
`ds` que ese archivo ya define):

```ts
  describe('content', () => {
    it('sirve el mapa de overrides sin sesión', async () => {
      await request(app.getHttpServer()).get('/content').expect(200, {});
    });

    it('turna away el panel de admin sin sesión', async () => {
      await request(app.getHttpServer()).get('/admin/content').expect(401);
    });

    it('turna away a quien no es el artista', async () => {
      const { token } = await session();
      await request(app.getHttpServer())
        .get('/admin/content')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('deja al artista guardar, ver y restablecer un texto', async () => {
      const { token } = await session({ admin: true });
      const auth = `Bearer ${token}`;

      await request(app.getHttpServer())
        .put('/admin/content/home.empty.body')
        .set('Authorization', auth)
        .send({ value: 'Todavía nada.' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/content')
        .expect(200, { 'home.empty.body': 'Todavía nada.' });

      const list = await request(app.getHttpServer())
        .get('/admin/content')
        .set('Authorization', auth)
        .expect(200);
      expect(list.body).toHaveLength(43);
      expect(list.body).toContainEqual(
        expect.objectContaining({ key: 'home.empty.body', hasOverride: true }),
      );

      await request(app.getHttpServer())
        .delete('/admin/content/home.empty.body')
        .set('Authorization', auth)
        .expect(200);
      await request(app.getHttpServer()).get('/content').expect(200, {});
    });

    it('rechaza una clave desconocida', async () => {
      const { token } = await session({ admin: true });
      await request(app.getHttpServer())
        .put('/admin/content/no.existe')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'x' })
        .expect(400);
    });
  });
```

Run: `cd api && npx jest wiring.spec -v`
Expected: FAIL — `/content` y `/admin/content` responden 404 (no existen todavía).

- [ ] **Step 4: Correr la prueba completa y verificar que pasa**

Run: `cd api && npx jest -v`
Expected: todas las suites en verde, incluida `content.spec.ts` (Task 1) y
los nuevos casos de `wiring.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add api/src/content/content.controller.ts api/src/content/admin-content.controller.ts \
  api/src/app.module.ts api/test/integration/wiring.spec.ts
git commit -m "feat(api): endpoints públicos y de admin para el contenido"
```

---

### Task 3: `web/lib/content.ts`

**Files:**
- Create: `web/lib/content.ts`
- Test: `web/lib/content.test.ts`

**Interfaces:**
- Produces: `getOverrides(): Promise<Record<string, string>>`,
  `content(key: string, fallback: string): Promise<string>` — usados por
  Server Components (Task 6, 9, 10) directamente con `await`, y por
  `ContentProvider` (Task 4) para poblar el Context que el resto consume.

- [ ] **Step 1: Prueba — escribirla, verla fallar**

```ts
// web/lib/content.test.ts
import { content } from './content';

describe('content', () => {
  const ORIGINAL_ENV = process.env;
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => { process.env = { ...ORIGINAL_ENV }; });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
  });

  it('sin API_URL, siempre devuelve el fallback', async () => {
    delete process.env.API_URL;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });

  it('con override, devuelve el texto guardado', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'home.empty.body': 'Texto nuevo' }),
    }) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto nuevo');
  });

  it('sin override para esa clave, devuelve el fallback', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'otra.clave': 'x' }),
    }) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });

  it('si la API falla, cae al fallback en vez de tronar la página', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });

  it('si la API responde con error, cae al fallback', async () => {
    process.env.API_URL = 'http://api.test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;
    expect(await content('home.empty.body', 'Texto original')).toBe('Texto original');
  });
});
```

Run: `cd web && npx jest content.test -v`
Expected: FAIL — `Cannot find module './content'`.

- [ ] **Step 2: Implementar**

```ts
// web/lib/content.ts

/**
 * Los textos editoriales que el artista puede cambiar desde /studio. Sin
 * API_URL (modo maqueta) o si la API falla, siempre cae al texto que ya
 * vive en el código — el contenido es decorativo, nunca debe tronar una
 * página.
 */
const BASE = process.env.API_URL;

export async function getOverrides(): Promise<Record<string, string>> {
  if (!BASE) return {};
  try {
    const res = await fetch(`${BASE}/content`, { next: { tags: ['content'] } });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function content(key: string, fallback: string): Promise<string> {
  const overrides = await getOverrides();
  return overrides[key] ?? fallback;
}
```

- [ ] **Step 3: Correr la prueba y verificar que pasa**

Run: `cd web && npx jest content.test -v`
Expected: 5 tests, todos en verde.

- [ ] **Step 4: Commit**

```bash
git add web/lib/content.ts web/lib/content.test.ts
git commit -m "feat(web): helper content() con caída al texto original"
```

---

### Task 4: `ContentProvider` / `useContent` + wiring en `RootLayout`

**Files:**
- Create: `web/components/ContentProvider.tsx`
- Modify: `web/app/layout.tsx`

**Interfaces:**
- Consumes: `getOverrides`, `content` (Task 3).
- Produces: `ContentProvider` (componente cliente), `useContent(key: string, fallback: string): string` — lo usan los Client Components de las Tasks 7, 8 y 10 (`EphemeralPlayer.tsx`).

- [ ] **Step 1: `ContentProvider.tsx`**

```tsx
// web/components/ContentProvider.tsx
'use client';

import { createContext, useContext } from 'react';

const ContentContext = createContext<Record<string, string>>({});

/**
 * Monta una sola vez, en RootLayout, con el mapa completo de overrides ya
 * resuelto en el servidor. Los Client Components que muestran uno de los
 * 43 textos editoriales lo leen con useContent en vez de llamar
 * content() (que es async y no se puede await dentro de un componente
 * cliente).
 */
export function ContentProvider(
  { overrides, children }: { overrides: Record<string, string>; children: React.ReactNode },
) {
  return <ContentContext.Provider value={overrides}>{children}</ContentContext.Provider>;
}

export function useContent(key: string, fallback: string): string {
  const overrides = useContext(ContentContext);
  return overrides[key] ?? fallback;
}
```

- [ ] **Step 2: `RootLayout` pasa a ser async y envuelve con el Provider**

`web/app/layout.tsx` actual (relevante):

```tsx
export const metadata: Metadata = {
  title: 'Toryteler',
  description: 'Piezas únicas y contenido personal del artista.',
};
```
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      ...
      <body>
        <header className={styles.header}>
          ...
          <nav className={`${styles.center} label`}>
            <Link href="/">La casa de Tory</Link>
          </nav>
          ...
        </header>
        <PageTransition>{children}</PageTransition>
        <footer className={`${styles.footer} muted label`}>Medellín, Colombia</footer>
      </body>
    </html>
  );
}
```

Reemplázalo por:

```tsx
// web/app/layout.tsx — agregar a los imports
import { content, getOverrides } from '@/lib/content';
import { ContentProvider } from '@/components/ContentProvider';
```

```tsx
// web/app/layout.tsx — metadata pasa a generateMetadata
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Toryteler',
    description: await content(
      'site.meta.description',
      'Piezas únicas y contenido personal del artista.',
    ),
  };
}
```

```tsx
// web/app/layout.tsx — RootLayout
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
```

(`getOverrides()` se pide dos veces por request contando la de `content()`
dentro de `generateMetadata` — el `fetch` extendido de Next.js memoiza
llamadas idénticas dentro del mismo request, así que es una sola llamada
de red real, no dos.)

- [ ] **Step 2: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add web/components/ContentProvider.tsx web/app/layout.tsx
git commit -m "feat(web): ContentProvider para los textos editables en Client Components"
```

---

### Task 5: Panel `/studio/contenido`

**Files:**
- Modify: `web/lib/types.ts`
- Modify: `web/lib/studio-actions.ts`
- Modify: `web/app/studio/layout.tsx`
- Modify: `web/app/studio/studio.module.scss`
- Create: `web/app/studio/contenido/page.tsx`
- Create: `web/components/ContentEditor.tsx`

**Interfaces:**
- Consumes: `AdminContentItem` shape del API (Task 2): `{ key, section, defaultValue, currentValue, hasOverride }`.
- Produces: `ContentItem` (mismo shape, lado web), `updateContent(key, value): Promise<Result<null>>`, `resetContent(key): Promise<Result<null>>`.

- [ ] **Step 1: Tipo en `web/lib/types.ts`**

Agrega, junto a `TeamMember`:

```ts
export interface ContentItem {
  key: string;
  section: string;
  defaultValue: string;
  currentValue: string;
  hasOverride: boolean;
}
```

- [ ] **Step 2: Acciones en `web/lib/studio-actions.ts`**

`revalidateTag` no está importado todavía en ese archivo — agrégalo junto a `revalidatePath`:

```ts
// web/lib/studio-actions.ts — import existente, ampliar
import { revalidatePath, revalidateTag } from 'next/cache';
```

Y al final del archivo:

```ts
/**
 * Cambia uno de los 43 textos editoriales. revalidateTag, no
 * revalidatePath: el contenido se lee desde decenas de rutas a la vez, no
 * una sola.
 */
export async function updateContent(key: string, value: string): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/content/${encodeURIComponent(key)}`, 'PUT', { value });
    revalidateTag('content');
    return null;
  }, false);
}

/** Vuelve al texto original, borrando el override. */
export async function resetContent(key: string): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/content/${encodeURIComponent(key)}`, 'DELETE');
    revalidateTag('content');
    return null;
  }, false);
}
```

- [ ] **Step 3: Nav link en `web/app/studio/layout.tsx`**

```tsx
// web/app/studio/layout.tsx — dentro de <nav>, después de "Equipo"
        <Link href="/studio/equipo">Equipo</Link>
        <Link href="/studio/contenido">Contenido</Link>
```

- [ ] **Step 4: Estilos — una fila por texto en `studio.module.scss`**

Agrega al final del archivo:

```scss
/* ContentEditor */

.contentSection {
  display: grid;
  gap: var(--gutter);
}

.contentItem {
  display: grid;
  gap: calc(var(--unit) * 0.5);

  textarea { min-height: 4.5rem; }
}

.contentActions {
  display: flex;
  gap: var(--unit);
  align-items: center;
}
```

- [ ] **Step 5: `ContentEditor.tsx`**

```tsx
// web/components/ContentEditor.tsx
'use client';

import { useState } from 'react';
import { resetContent, updateContent } from '@/lib/studio-actions';
import { ContentItem } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

export function ContentEditor({ items }: { items: ContentItem[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.key, i.currentValue])),
  );
  const [saved, setSaved] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.key, i.currentValue])),
  );
  const [overridden, setOverridden] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.key, i.hasOverride])),
  );
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bySection = items.reduce<Record<string, ContentItem[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  async function save(key: string) {
    setWorking(key);
    setError(null);

    const result = await updateContent(key, values[key]);
    setWorking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved((s) => ({ ...s, [key]: values[key] }));
    setOverridden((o) => ({ ...o, [key]: true }));
  }

  async function reset(key: string, defaultValue: string) {
    setWorking(key);
    setError(null);

    const result = await resetContent(key);
    setWorking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setValues((v) => ({ ...v, [key]: defaultValue }));
    setSaved((s) => ({ ...s, [key]: defaultValue }));
    setOverridden((o) => ({ ...o, [key]: false }));
  }

  return (
    <div className={styles.listGroup}>
      {error && <p role="alert" className={styles.error}>{error}</p>}

      {Object.entries(bySection).map(([section, sectionItems]) => (
        <fieldset key={section} className={styles.group}>
          <legend>{section}</legend>
          <div className={styles.contentSection}>
            {sectionItems.map((item) => (
              <div key={item.key} className={styles.contentItem}>
                <label htmlFor={item.key} className="label muted">{item.key}</label>
                <textarea
                  id={item.key}
                  value={values[item.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [item.key]: e.target.value }))}
                />
                <div className={styles.contentActions}>
                  <button
                    type="button"
                    onClick={() => save(item.key)}
                    disabled={working === item.key || values[item.key] === saved[item.key]}
                  >
                    {working === item.key ? 'Guardando…' : 'Guardar'}
                  </button>
                  {overridden[item.key] && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => reset(item.key, item.defaultValue)}
                      disabled={working === item.key}
                    >
                      Restablecer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `web/app/studio/contenido/page.tsx`**

```tsx
// web/app/studio/contenido/page.tsx
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { ContentItem } from '@/lib/types';
import { ContentEditor } from '@/components/ContentEditor';
import styles from '../studio.module.scss';

export const metadata: Metadata = { title: 'Contenido — Studio' };
export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const items = await apiGet<ContentItem[]>('/admin/content', true);

  return (
    <div className={styles.published}>
      <h1 className="label muted">Contenido</h1>
      <p className="muted">
        Estos son los textos de la tienda que puedes cambiar sin tocar código. Lo que guardes
        se ve reflejado de inmediato.
      </p>

      <ContentEditor items={items} />
    </div>
  );
}
```

- [ ] **Step 7: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

**Nota:** `updateContent`/`resetContent` no llevan test unitario propio a
propósito — ninguna otra función de `studio-actions.ts` lo tiene hoy
(dependen de `next/headers`/`next/cache` en tiempo de request, sin mocks
establecidos en este repo). Se verifican en la Task 11 (HTTP directo +
manual en el navegador), igual que `createPiece`/`updateDrop`.

- [ ] **Step 8: Commit**

```bash
git add web/lib/types.ts web/lib/studio-actions.ts web/app/studio/layout.tsx \
  web/app/studio/studio.module.scss web/app/studio/contenido/page.tsx \
  web/components/ContentEditor.tsx
git commit -m "feat(web): panel /studio/contenido para editar los 43 textos"
```

---

### Task 6: Home + Artista

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/app/artista/page.tsx`

**Interfaces:**
- Consumes: `content` (Task 3), `ARTIST` (`web/lib/artist.ts`, sin cambios — `role`/`bio` dejan de leerse de ahí en esta página, `name`/`portrait`/`socials`/`email`/`location` siguen igual).

- [ ] **Step 1: `web/app/page.tsx`**

```tsx
// web/app/page.tsx — agregar import
import { content } from '@/lib/content';
```

```tsx
// web/app/page.tsx — dentro de Catalog(), reemplazar
  if (pieces.length === 0 && drops.length === 0) {
    return <p className={styles.empty}>Aún no hay nada publicado.</p>;
  }
```
por:
```tsx
  if (pieces.length === 0 && drops.length === 0) {
    return (
      <p className={styles.empty}>
        {await content('home.empty.body', 'Aún no hay nada publicado.')}
      </p>
    );
  }
```

- [ ] **Step 2: `web/app/artista/page.tsx` — pasa a ser async**

Archivo completo:

```tsx
// web/app/artista/page.tsx
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
```

- [ ] **Step 3: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.tsx web/app/artista/page.tsx
git commit -m "feat(web): home y artista leen su copy de content()"
```

---

### Task 7: Carrito + Checkout

**Files:**
- Modify: `web/app/carrito/page.tsx`
- Modify: `web/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `useContent` (Task 4). Ambos archivos son Client Components — no se puede usar `content()` con `await` aquí, ver Global Constraints.

- [ ] **Step 1: `web/app/carrito/page.tsx`**

```tsx
// web/app/carrito/page.tsx — agregar import
import { useContent } from '@/components/ContentProvider';
```

Dentro de `CartPage`, después de las líneas de `useState`:

```tsx
  const emptyBody = useContent('cart.empty.body', 'No tienes nada en el carrito.');
  const emptyCta = useContent('cart.empty.cta', 'Ver la casa de Tory');
  const contractNotice = useContent(
    'cart.contractNotice.body',
    'Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu cédula a mano.',
  );
```

Reemplaza el bloque de carrito vacío:

```tsx
  if (lines.length === 0) {
    return (
      <div className={styles.cart}>
        <h1 className="label muted">Carrito</h1>
        <p>No tienes nada en el carrito.</p>
        <Link href="/" className="label">Ver la casa de Tory</Link>
      </div>
    );
  }
```
por:
```tsx
  if (lines.length === 0) {
    return (
      <div className={styles.cart}>
        <h1 className="label muted">Carrito</h1>
        <p>{emptyBody}</p>
        <Link href="/" className="label">{emptyCta}</Link>
      </div>
    );
  }
```

Y el aviso de contrato:

```tsx
      {hasPiece && (
        <p className="muted">
          Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu
          cédula a mano.
        </p>
      )}
```
por:
```tsx
      {hasPiece && <p className="muted">{contractNotice}</p>}
```

**Nota:** el `useContent` de `emptyBody`/`emptyCta` corre siempre, incluso
en el `return` temprano de `lines === null` (líneas de hooks antes de
cualquier `return` — no se puede llamar un hook condicionalmente). Colócalos
justo después de los `useState`, antes del primer `if`.

- [ ] **Step 2: `web/app/checkout/page.tsx`**

```tsx
// web/app/checkout/page.tsx — agregar import
import { useContent } from '@/components/ContentProvider';
```

Después de los `useState` existentes:

```tsx
  const emptyBody = useContent('checkout.empty.body', 'No tienes nada en el carrito.');
  const emailNotice = useContent(
    'checkout.emailNotice.body',
    'Ahí te llegan el recibo y, si compras una pieza, el código para firmar el contrato.',
  );
  const signatureNote = useContent(
    'checkout.signature.note',
    'Sin costo. Firmarla toma unos días más antes de que salga el envío.',
  );
  const addressNotice = useContent(
    'checkout.addressNotice.body',
    'En el siguiente paso firmarás el contrato de compraventa. Ten a mano tu cédula.',
  );
```

Carrito vacío:

```tsx
  if (lines.length === 0) {
    return (
      <div className={styles.checkout}>
        <h1 className="label muted">Pagar</h1>
        <p>No tienes nada en el carrito.</p>
      </div>
    );
  }
```
por:
```tsx
  if (lines.length === 0) {
    return (
      <div className={styles.checkout}>
        <h1 className="label muted">Pagar</h1>
        <p>{emptyBody}</p>
      </div>
    );
  }
```

Aviso de correo (recuerda: la oración del enlace queda fija — ver Global
Constraints):

```tsx
            <p className="muted">
              Ahí te llegan el recibo y, si compras una pieza, el código para firmar el
              contrato. ¿Ya tienes cuenta? <Link href="/entrar?next=/checkout">Entra</Link> para
              ver tus pedidos anteriores.
            </p>
```
por:
```tsx
            <p className="muted">
              {emailNotice} ¿Ya tienes cuenta?{' '}
              <Link href="/entrar?next=/checkout">Entra</Link> para ver tus pedidos anteriores.
            </p>
```

Nota de la firma:

```tsx
            <p className="muted">
              Sin costo. Firmarla toma unos días más antes de que salga el envío.
            </p>
```
por:
```tsx
            <p className="muted">{signatureNote}</p>
```

Aviso de dirección:

```tsx
        {needsAddress && (
          <p className="muted">
            En el siguiente paso firmarás el contrato de compraventa. Ten a mano tu cédula.
          </p>
        )}
```
por:
```tsx
        {needsAddress && <p className="muted">{addressNotice}</p>}
```

- [ ] **Step 3: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add web/app/carrito/page.tsx web/app/checkout/page.tsx
git commit -m "feat(web): carrito y checkout leen su copy con useContent"
```

---

### Task 8: Contrato + Pagar

**Files:**
- Modify: `web/app/checkout/contrato/page.tsx`
- Modify: `web/app/checkout/pagar/page.tsx`
- Modify: `web/app/checkout/pagar/Pay.tsx`

**Interfaces:**
- Consumes: `useContent` (`checkout/contrato/page.tsx`, `Pay.tsx` — ambos Client Components), `content` (`checkout/pagar/page.tsx` — Server Component, ya existe de un plan anterior).

- [ ] **Step 1: `web/app/checkout/contrato/page.tsx`**

```tsx
// web/app/checkout/contrato/page.tsx — agregar import
import { useContent } from '@/components/ContentProvider';
```

Dentro de `Contract()`, después de los `useState`:

```tsx
  const invalidLink = useContent('checkout.invalidLink.body', 'Este enlace no lleva a ningún pedido.');
  const intro = useContent(
    'checkout.contract.intro',
    'Estos datos van en el documento que vas a firmar, así que tienen que coincidir con tu cédula.',
  );
  const otpIntro = useContent(
    'checkout.contract.otpIntro',
    'Te enviamos un código de seis dígitos a tu correo. Lee el documento y fírmalo con ese código.',
  );
  const mustOpenNotice = useContent('checkout.contract.mustOpenNotice', 'Abre el documento para poder confirmarlo.');
  const signBeforePayNotice = useContent(
    'checkout.contract.signBeforePayNotice',
    'Firmas antes de pagar. Si el pago no se completa, el contrato queda anulado.',
  );
```

Reemplaza cada texto:

```tsx
  if (!orderId) {
    return (
      <div className={styles.contract}>
        <p>Este enlace no lleva a ningún pedido.</p>
      </div>
    );
  }
```
→ `<p>{invalidLink}</p>`

```tsx
        <p>
          Estos datos van en el documento que vas a firmar, así que tienen que coincidir
          con tu cédula.
        </p>
```
→ `<p>{intro}</p>`

```tsx
      <p>
        Te enviamos un código de seis dígitos a tu correo. Lee el documento y fírmalo con
        ese código.
      </p>
```
→ `<p>{otpIntro}</p>`

```tsx
        {!opened && (
          <p className="muted">Abre el documento para poder confirmarlo.</p>
        )}
```
→ `<p className="muted">{mustOpenNotice}</p>`

```tsx
      <p className="muted">
        Firmas antes de pagar. Si el pago no se completa, el contrato queda anulado.
      </p>
```
→ `<p className="muted">{signBeforePayNotice}</p>`

- [ ] **Step 2: `web/app/checkout/pagar/page.tsx` (Server Component)**

```tsx
// web/app/checkout/pagar/page.tsx — agregar import
import { content } from '@/lib/content';
```

Dentro de `PayPage`, reemplaza el `return` de "sin `orderId`":

```tsx
  if (!orderId) {
    return (
      <div className={styles.pay}>
        <p>Este enlace no lleva a ningún pedido.</p>
      </div>
    );
  }
```
por:
```tsx
  if (!orderId) {
    return (
      <div className={styles.pay}>
        <p>{await content('checkout.invalidLink.body', 'Este enlace no lleva a ningún pedido.')}</p>
      </div>
    );
  }
```

- [ ] **Step 3: `web/app/checkout/pagar/Pay.tsx` (Client Component)**

```tsx
// web/app/checkout/pagar/Pay.tsx — agregar import
import { useContent } from '@/components/ContentProvider';
```

Dentro de `Pay`, después de los `useState`:

```tsx
  const gatewayNotice = useContent(
    'checkout.pay.gatewayNotice',
    'Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.',
  );
  const securityNotice = useContent('checkout.pay.securityNotice', 'Los datos de tu tarjeta no pasan por esta tienda.');
```

```tsx
      <p>Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.</p>
```
→ `<p>{gatewayNotice}</p>`

```tsx
      <p className="muted">Los datos de tu tarjeta no pasan por esta tienda.</p>
```
→ `<p className="muted">{securityNotice}</p>`

- [ ] **Step 4: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add web/app/checkout/contrato/page.tsx web/app/checkout/pagar/page.tsx web/app/checkout/pagar/Pay.tsx
git commit -m "feat(web): contrato y pagar leen su copy editable"
```

---

### Task 9: Resultado del pago

**Files:**
- Modify: `web/app/checkout/resultado/page.tsx`

**Interfaces:**
- Consumes: `content` (Task 3) — Server Component, `await` directo.

- [ ] **Step 1: Reemplazar el mapa `OUTCOMES` estático por uno resuelto en el render**

`web/app/checkout/resultado/page.tsx` hoy define `OUTCOMES` como una
constante a nivel de módulo. Pasa a construirse dentro de `ResultPage`,
con `content()`:

```tsx
// web/app/checkout/resultado/page.tsx — agregar import
import { content } from '@/lib/content';
```

Reemplaza:

```tsx
const OUTCOMES: Record<OrderSummary['status'], { title: string; body: string }> = {
  pending: {
    title: 'Confirmando tu pago',
    body: 'La pasarela todavía no nos ha confirmado el cobro. Esto suele tardar segundos; te escribimos al correo en cuanto quede.',
  },
  paid: {
    title: 'Listo',
    body: 'Tu compra quedó confirmada. Te enviamos el correo con el detalle y, si compraste una pieza, el contrato firmado.',
  },
  failed: {
    title: 'El pago no se completó',
    body: 'No te cobramos nada y lo que habías apartado volvió a la tienda. Puedes intentarlo otra vez.',
  },
  expired: {
    title: 'El pedido venció',
    body: 'Pasó demasiado tiempo sin completar el pago, así que soltamos lo que tenías apartado.',
  },
  refunded: {
    title: 'Te devolvimos el dinero',
    body: 'Alguien se adelantó con lo que compraste, así que reembolsamos el valor completo.',
  },
};
```

por una función que se resuelve con `content()`:

```tsx
async function outcomeFor(status: OrderSummary['status']): Promise<{ title: string; body: string }> {
  switch (status) {
    case 'pending':
      return {
        title: await content('checkout.result.pending.title', 'Confirmando tu pago'),
        body: await content(
          'checkout.result.pending.body',
          'La pasarela todavía no nos ha confirmado el cobro. Esto suele tardar segundos; te escribimos al correo en cuanto quede.',
        ),
      };
    case 'paid':
      return {
        title: await content('checkout.result.paid.title', 'Listo'),
        body: await content(
          'checkout.result.paid.body',
          'Tu compra quedó confirmada. Te enviamos el correo con el detalle y, si compraste una pieza, el contrato firmado.',
        ),
      };
    case 'failed':
      return {
        title: await content('checkout.result.failed.title', 'El pago no se completó'),
        body: await content(
          'checkout.result.failed.body',
          'No te cobramos nada y lo que habías apartado volvió a la tienda. Puedes intentarlo otra vez.',
        ),
      };
    case 'expired':
      return {
        title: await content('checkout.result.expired.title', 'El pedido venció'),
        body: await content(
          'checkout.result.expired.body',
          'Pasó demasiado tiempo sin completar el pago, así que soltamos lo que tenías apartado.',
        ),
      };
    case 'refunded':
      return {
        title: await content('checkout.result.refunded.title', 'Te devolvimos el dinero'),
        body: await content(
          'checkout.result.refunded.body',
          'Alguien se adelantó con lo que compraste, así que reembolsamos el valor completo.',
        ),
      };
  }
}
```

Y en `ResultPage`, donde hoy dice:

```tsx
  if (!order) {
    return (
      <div className={styles.result}>
        <h1 className="label muted">No encontramos ese pedido</h1>
        <p>Puede que sea de otra cuenta. Mira tus pedidos para comprobarlo.</p>
        <Link href="/cuenta" className="label">Ver mis pedidos</Link>
      </div>
    );
  }

  const outcome = OUTCOMES[order.status];
```

reemplázalo por:

```tsx
  if (!order) {
    return (
      <div className={styles.result}>
        <h1 className="label muted">
          {await content('checkout.result.notFound.title', 'No encontramos ese pedido')}
        </h1>
        <p>
          {await content(
            'checkout.result.notFound.body',
            'Puede que sea de otra cuenta. Mira tus pedidos para comprobarlo.',
          )}
        </p>
        <Link href="/cuenta" className="label">Ver mis pedidos</Link>
      </div>
    );
  }

  const outcome = await outcomeFor(order.status);
```

- [ ] **Step 2: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add web/app/checkout/resultado/page.tsx
git commit -m "feat(web): resultado del pago lee sus 12 textos de content()"
```

---

### Task 10: Pieza + Drop + Reproductor efímero

**Files:**
- Modify: `web/app/piezas/[slug]/page.tsx`
- Modify: `web/app/drops/[slug]/page.tsx`
- Modify: `web/components/EphemeralPlayer.tsx`

**Interfaces:**
- Consumes: `content` (Task 3) para las dos páginas (Server Components); `useContent` (Task 4) para `EphemeralPlayer.tsx` (Client Component).

- [ ] **Step 1: `web/app/piezas/[slug]/page.tsx`**

```tsx
// web/app/piezas/[slug]/page.tsx — agregar import
import { content } from '@/lib/content';
```

Dentro de `PiecePage`, después de `if (!piece) notFound();`:

```tsx
  const [includesNote, soldBody, notForSaleBody] = await Promise.all([
    content(
      'piece.detail.includesNote',
      'Incluye una nota escrita por el artista y el contrato de compraventa firmado.',
    ),
    content('piece.detail.soldBody', 'Esta pieza ya encontró dueño.'),
    content('piece.detail.notForSaleBody', 'No está a la venta.'),
  ]);
```

```tsx
        <p className={`${styles.paragraph} muted`}>
          Incluye una nota escrita por el artista y el contrato de compraventa firmado.
        </p>
```
→ `<p className={`${styles.paragraph} muted`}>{includesNote}</p>`

```tsx
        ) : (
          <p className="label muted">
            {piece.stock === 0 && piece.soldAt ? 'Esta pieza ya encontró dueño.' : 'No está a la venta.'}
          </p>
        )}
```
→
```tsx
        ) : (
          <p className="label muted">
            {piece.stock === 0 && piece.soldAt ? soldBody : notForSaleBody}
          </p>
        )}
```

- [ ] **Step 2: `web/app/drops/[slug]/page.tsx`**

```tsx
// web/app/drops/[slug]/page.tsx — agregar import
import { content } from '@/lib/content';
```

Dentro de `DropPage`, después de `if (!drop) notFound();`:

```tsx
  const soldOutBody = await content('drop.detail.soldOutBody', 'Ya no quedan seats.');
```

```tsx
        {drop.soldOut ? (
          <p className="label muted">Ya no quedan seats.</p>
        ) : (
```
→
```tsx
        {drop.soldOut ? (
          <p className="label muted">{soldOutBody}</p>
        ) : (
```

- [ ] **Step 3: `web/components/EphemeralPlayer.tsx`**

```tsx
// web/components/EphemeralPlayer.tsx — agregar import
import { useContent } from '@/components/ContentProvider';
```

Dentro de `EphemeralPlayer`, después de los `useState`/`useCallback`
existentes (antes del primer `if (closed)`):

```tsx
  const closedTitle = useContent('watch.closed.title', 'Tu ventana se cerró.');
  const introTitle = useContent('watch.intro.title', 'Antes de reproducir');
  const introWarning = useContent(
    'watch.intro.warning',
    'Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez.',
  );
```

```tsx
        <p className="title">Tu ventana se cerró.</p>
```
→ `<p className="title">{closedTitle}</p>`

```tsx
        <p className="title">Antes de reproducir</p>
```
→ `<p className="title">{introTitle}</p>`

```tsx
        <p>Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez.</p>
```
→ `<p>{introWarning}</p>`

(`watch.closed.body` y `watch.intro.body`, con la fecha y las horas
incrustadas, quedan hardcodeados — no se tocan.)

- [ ] **Step 4: Verificar en seco**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add web/app/piezas/\[slug\]/page.tsx web/app/drops/\[slug\]/page.tsx web/components/EphemeralPlayer.tsx
git commit -m "feat(web): pieza, drop y reproductor leen su copy editable"
```

---

### Task 11: Verificación final de punta a punta

**Files:** ninguno nuevo — corre todo lo anterior junto.

- [ ] **Step 1: Suite completa de la API**

```bash
cd api
docker compose -f ../docker-compose.test.yml up -d
npm run build
npx jest
```
Expected: build sin errores; toda la suite en verde (incluye los 8 tests
de `content.spec.ts` y los 5 nuevos de `wiring.spec.ts`).

- [ ] **Step 2: Suite completa del front**

```bash
cd web
npx tsc --noEmit
npx jest
```
Expected: ambos en verde (incluye los 5 tests de `content.test.ts`).

- [ ] **Step 3: Migración contra una base de desarrollo real**

```bash
cd ..
docker compose up -d
cd api
npm run seed:fresh
```
Expected: siembra sin errores; `content_overrides` existe y está vacía
(`SELECT count(*) FROM content_overrides` = 0).

- [ ] **Step 4: Verificación del flujo por HTTP**

Con la API corriendo (`npm run start:dev`) y sin necesidad de navegador:

```bash
curl -s http://localhost:3000/content
# Expected: {}

curl -s -X POST http://localhost:3000/auth/magic-link -H 'Content-Type: application/json' \
  -d '{"email":"tory@toryteler.co"}'
# (o usa una sesión de admin ya existente en tu base de desarrollo)
```

Con un token de admin real (`Authorization: Bearer <token>`):

```bash
curl -s http://localhost:3000/admin/content -H "Authorization: Bearer $TOKEN" | head -c 300
# Expected: arreglo de 43 objetos, cada uno con hasOverride: false

curl -s -X PUT http://localhost:3000/admin/content/home.empty.body \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"value":"Probando el editor."}'

curl -s http://localhost:3000/content
# Expected: {"home.empty.body":"Probando el editor."}
```

- [ ] **Step 5: Prueba manual en el navegador**

Con `API_URL=http://localhost:3000` en `web/.env.local` y `npm run dev` en
`web/`: abrir `/`, confirmar el texto sigue igual al de siempre; entrar a
`/studio/contenido`, cambiar el texto de "Aún no hay nada publicado.",
guardar, volver a `/` (con el catálogo vacío) y confirmar que se ve el
texto nuevo. Restablecerlo desde el panel y confirmar que vuelve al
original.

- [ ] **Step 6: Commit final (si hubo ajustes de la verificación)**

```bash
git add -A
git commit -m "chore: ajustes tras la verificación de punta a punta"
```
