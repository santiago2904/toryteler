# Precios en USD, cobro en pesos a la TRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El artista fija precio en dólares; el comprador ve dólares en toda
la tienda; al crear el pedido, la API convierte a pesos con la TRM oficial
del día y congela ese monto — Wompi sigue cobrando exactamente como siempre.

**Architecture:** `pieces.price_cop`/`drops.price_cop` se renombran a
`price_usd_cents` (única fuente de verdad del precio). `orders.total_cop` y
`order_items.unit_price_cop` no se renombran — siguen siendo lo que
`WompiGateway`/`PaymentsService` ya leen — pero ahora los llena
`OrdersService.create()` convirtiendo con un `ExchangeRateService` nuevo, que
pide la TRM a `datos.gov.co` y la cachea 24 h. Dos columnas nuevas,
nulas a propósito (`orders.total_usd_cents`,
`order_items.unit_price_usd_cents`), guardan el lado en dólares para
mostrarlo después. Nada en `PaymentGateway`, `WompiGateway`,
`PaymentsService` o `ReconciliationService` cambia.

**Tech Stack:** NestJS + TypeORM + Postgres (API), Next.js App Router
(web). Sin dependencias nuevas — `ExchangeRateService` usa `fetch` global,
igual que `WompiGateway` ya hace contra la API de Wompi.

**Spec:** `docs/superpowers/specs/2026-08-27-precios-usd-cobro-trm-design.md`
(y, para lo que no cambia, `docs/superpowers/specs/2026-08-13-tienda-artista-design.md`)

## Global Constraints

- Código en inglés, producto en español (identificadores/comentarios en
  inglés; copy de interfaz en español).
- Los precios se releen de la base, nunca del cliente (invariante ya
  documentado; sigue aplicando también a `price_usd_cents`).
- Todo estado peligroso vive en Postgres, protegido por constraints.
- `orders.total_cop`/`order_items.unit_price_cop` mantienen su nombre y su
  tipo (`integer NOT NULL CHECK (... > 0)`) — son lo que Wompi cobra de
  verdad; ninguna tarea de este plan los toca en su semántica de "pesos
  reales cobrados".
- `orders.total_usd_cents`/`order_items.unit_price_usd_cents` son
  `integer NULL` — informativos, nunca leídos por lógica de pago.
- Fuente de la tasa: `GET https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1` → `[{ "valor": "3144.28", ... }]`. Sin llave.

---

## Task 1: Migración — columnas de moneda

**Files:**
- Create: `api/src/database/migrations/1756100000000-currency-usd.ts`
- Modify: `api/src/pieces/piece.entity.ts:14`
- Modify: `api/src/drops/drop.entity.ts:11`
- Modify: `api/src/orders/order.entity.ts` (agrega columna, no renombra ninguna existente)
- Modify: `api/src/orders/order-item.entity.ts` (agrega columna, no renombra ninguna existente)
- Test: `api/test/integration/schema.spec.ts`

**Interfaces:**
- Produce: columnas `pieces.price_usd_cents`, `drops.price_usd_cents`
  (antes `price_cop`), `orders.total_usd_cents` (nueva, nullable),
  `order_items.unit_price_usd_cents` (nueva, nullable). `orders.total_cop`
  y `order_items.unit_price_cop` sin cambios de nombre ni de tipo.

- [ ] **Step 1: Escribir la migración**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El precio de catálogo pasa a fijarse en dólares — pieces.price_cop y
 * drops.price_cop se renombran a price_usd_cents. orders.total_cop y
 * order_items.unit_price_cop NO se tocan: siguen siendo lo que Wompi cobra
 * de verdad, congelado en pesos al crear el pedido (ver
 * OrdersService.create). Lo que sí se agrega es el lado en dólares de esos
 * dos, para poder mostrarlo después — nulo a propósito: nada que mueve
 * dinero los lee nunca, así que no hace falta retrocompletar cada fixture
 * de prueba que inserta un pedido por SQL directo.
 */
export class CurrencyUsd1756100000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE pieces RENAME COLUMN price_cop TO price_usd_cents`);
    await q.query(`ALTER TABLE pieces RENAME CONSTRAINT pieces_price_cop_check TO pieces_price_usd_cents_check`);

    await q.query(`ALTER TABLE drops RENAME COLUMN price_cop TO price_usd_cents`);
    await q.query(`ALTER TABLE drops RENAME CONSTRAINT drops_price_cop_check TO drops_price_usd_cents_check`);

    await q.query(`
      ALTER TABLE orders ADD COLUMN total_usd_cents integer
        CHECK (total_usd_cents IS NULL OR total_usd_cents > 0)`);
    await q.query(`
      ALTER TABLE order_items ADD COLUMN unit_price_usd_cents integer
        CHECK (unit_price_usd_cents IS NULL OR unit_price_usd_cents > 0)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE order_items DROP COLUMN unit_price_usd_cents`);
    await q.query(`ALTER TABLE orders DROP COLUMN total_usd_cents`);

    await q.query(`ALTER TABLE drops RENAME CONSTRAINT drops_price_usd_cents_check TO drops_price_cop_check`);
    await q.query(`ALTER TABLE drops RENAME COLUMN price_usd_cents TO price_cop`);

    await q.query(`ALTER TABLE pieces RENAME CONSTRAINT pieces_price_usd_cents_check TO pieces_price_cop_check`);
    await q.query(`ALTER TABLE pieces RENAME COLUMN price_usd_cents TO price_cop`);
  }
}
```

- [ ] **Step 2: Actualizar las entidades TypeORM**

`api/src/pieces/piece.entity.ts:14`, cambiar:
```ts
@Column({ type: 'int', name: 'price_cop' }) priceCop!: number;
```
por:
```ts
@Column({ type: 'int', name: 'price_usd_cents' }) priceUsdCents!: number;
```

`api/src/drops/drop.entity.ts:11`, mismo cambio (`priceCop`/`price_cop` → `priceUsdCents`/`price_usd_cents`).

`api/src/orders/order.entity.ts`, junto a la columna `totalCop` existente, agregar:
```ts
@Column({ type: 'int', name: 'total_usd_cents', nullable: true }) totalUsdCents!: number | null;
```

`api/src/orders/order-item.entity.ts`, junto a `unitPriceCop`, agregar:
```ts
@Column({ type: 'int', name: 'unit_price_usd_cents', nullable: true }) unitPriceUsdCents!: number | null;
```

- [ ] **Step 3: Correr la migración contra la base de pruebas y verificar**

```bash
cd api
docker compose -f ../docker-compose.test.yml up -d
npx jest schema
```
Expected: PASS. Confirmar a mano el nombre de columna:
```bash
docker exec -i $(docker ps --filter "name=db-test" --format "{{.Names}}") \
  psql -U toryteler -d toryteler_test -c "\d pieces" | grep price
```
Expected: `price_usd_cents | integer`.

- [ ] **Step 4: Commit**

```bash
git add api/src/database/migrations/1756100000000-currency-usd.ts \
  api/src/pieces/piece.entity.ts api/src/drops/drop.entity.ts \
  api/src/orders/order.entity.ts api/src/orders/order-item.entity.ts
git commit -m "feat(api): renombrar price_cop a price_usd_cents, agregar columnas usd_cents a orders"
```

---

## Task 2: `ExchangeRateService`

**Files:**
- Create: `api/src/payments/exchange-rate.service.ts`
- Test: `api/test/integration/exchange-rate.spec.ts`
- Modify: `api/src/app.module.ts` (registrar el provider)

**Interfaces:**
- Produce: `class ExchangeRateService { async copPerUsd(): Promise<number> }`,
  lanza `ServiceUnavailableException('EXCHANGE_RATE_UNAVAILABLE')` si nunca
  hubo una tasa cacheada y la consulta falla.

- [ ] **Step 1: Escribir la prueba, con un `fetch` de prueba**

```ts
// api/test/integration/exchange-rate.spec.ts
import { ExchangeRateService } from '../../src/payments/exchange-rate.service';

describe('exchange rate', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  function respondWith(body: unknown, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it('reads the rate from the response', async () => {
    respondWith([{ valor: '3144.28' }]);
    const svc = new ExchangeRateService();
    expect(await svc.copPerUsd()).toBeCloseTo(3144.28);
  });

  it('caches it: a second call within the TTL does not fetch again', async () => {
    respondWith([{ valor: '4000' }]);
    const svc = new ExchangeRateService();
    await svc.copPerUsd();
    global.fetch = jest.fn(); // if called again, the assertion below fails
    expect(await svc.copPerUsd()).toBe(4000);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the last cached rate when the query fails', async () => {
    respondWith([{ valor: '3500' }]);
    const svc = new ExchangeRateService();
    await svc.copPerUsd();
    respondWith({}, false);
    expect(await svc.copPerUsd()).toBe(3500);
  });

  it('refuses to invent a rate when there is no cache and the query fails', async () => {
    respondWith({}, false);
    const svc = new ExchangeRateService();
    await expect(svc.copPerUsd()).rejects.toThrow(/EXCHANGE_RATE_UNAVAILABLE/);
  });

  it('refuses a malformed response the same way', async () => {
    respondWith([{ valor: 'no-es-un-numero' }]);
    const svc = new ExchangeRateService();
    await expect(svc.copPerUsd()).rejects.toThrow(/EXCHANGE_RATE_UNAVAILABLE/);
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `cd api && npx jest exchange-rate`
Expected: FAIL — `Cannot find module '../../src/payments/exchange-rate.service'`.

- [ ] **Step 3: Implementar**

```ts
// api/src/payments/exchange-rate.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * Cuántos pesos vale un dólar, según la TRM oficial de Banco de la
 * República (datos.gov.co, sin llave). Se pide una vez al crear un pedido
 * — nunca se recalcula después, así un pedido ya creado no cambia de
 * precio a mitad de camino.
 *
 * lazy: caché en memoria de proceso — basta con una instancia de Railway.
 * Si el día que haya más de una esto reaparece como inconsistencia, mover
 * a un valor compartido (Postgres o similar).
 */
@Injectable()
export class ExchangeRateService {
  private cached: { copPerUsd: number; fetchedAt: number } | null = null;
  private readonly TTL_MS = 24 * 3_600_000; // la TRM se publica un día hábil por día

  async copPerUsd(): Promise<number> {
    if (this.cached && Date.now() - this.cached.fetchedAt < this.TTL_MS) {
      return this.cached.copPerUsd;
    }

    try {
      const res = await fetch(
        'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1',
      );
      if (!res.ok) throw new Error(`TRM_QUERY_FAILED_${res.status}`);

      const [row] = (await res.json()) as { valor?: string }[];
      const rate = Number.parseFloat(row?.valor ?? '');
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('TRM_MALFORMED_RESPONSE');

      this.cached = { copPerUsd: rate, fetchedAt: Date.now() };
      return rate;
    } catch {
      // Una TRM de ayer sigue siendo una tasa real; inventar una no lo es.
      if (this.cached) return this.cached.copPerUsd;
      throw new ServiceUnavailableException('EXCHANGE_RATE_UNAVAILABLE');
    }
  }
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `cd api && npx jest exchange-rate`
Expected: PASS, 5 pruebas.

- [ ] **Step 5: Registrar el provider**

En `api/src/app.module.ts`: agregar el import
`import { ExchangeRateService } from './payments/exchange-rate.service';`
junto a los demás imports de `./payments/...`, y `ExchangeRateService` a la
lista `providers: [...]`, junto a `PaymentGateway`/`ReconciliationService`.

- [ ] **Step 6: Commit**

```bash
git add api/src/payments/exchange-rate.service.ts \
  api/test/integration/exchange-rate.spec.ts api/src/app.module.ts
git commit -m "feat(api): ExchangeRateService, TRM oficial cacheada 24h"
```

---

## Task 3: `OrdersService.create()` congela el precio en pesos

**Files:**
- Modify: `api/src/orders/orders.service.ts`
- Test: `api/test/integration/create-order.spec.ts`

**Interfaces:**
- Consume: `ExchangeRateService.copPerUsd(): Promise<number>` (Task 2).
- Produce: `CreatedOrder` gana `totalUsdCents: number`. Sin cambios en la
  firma pública de `create()`.

**Antes** (`api/src/orders/orders.service.ts:48-133`, resumido a lo que cambia):
```ts
const pieces = ... `SELECT id, slug, price_cop FROM pieces ...` ...
const drops = ... `SELECT id, slug, price_cop FROM drops ...` ...
...
const totalCop =
  pieces.reduce((sum, p) => sum + p.price_cop, 0) +
  drops.reduce((sum, d) => sum + d.price_cop, 0);
...
`INSERT INTO orders (user_id, total_cop, payment_method, shipping_address, reference)
 VALUES ($1, $2, $3, $4, $5) RETURNING id, reference, total_cop`,
[userId, totalCop, ...]
...
`INSERT INTO order_items (order_id, piece_id, unit_price_cop, wants_signature)
 VALUES ($1, $2, $3, $4)`,
[order.id, piece.id, piece.price_cop, signed.has(piece.slug)],
...
`INSERT INTO order_items (order_id, drop_id, unit_price_cop) VALUES ($1, $2, $3)`,
[order.id, drop.id, drop.price_cop],
...
return { id: order.id, reference: order.reference, totalCop: order.total_cop };
```

- [ ] **Step 1: Escribir la prueba, con un `ExchangeRateService` de prueba**

```ts
// añadir a api/test/integration/create-order.spec.ts, junto a las demás describe()
describe('freezing the peso price', () => {
  it('converts at the rate given by ExchangeRateService and freezes both figures', async () => {
    const rate = { copPerUsd: async () => 4000 };
    const withRate = new OrdersService(ds, new PiecesService(ds), rate as never);

    const slug = await newPiece(24000); // $240.00
    const order = await withRate.create(await newUser(), {
      pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    });

    const [row] = await ds.query(
      `SELECT total_cop, total_usd_cents FROM orders WHERE id = $1`, [order.id]);
    expect(row.total_usd_cents).toBe(24000);
    expect(row.total_cop).toBe(960000); // 240.00 * 4000

    const [item] = await ds.query(
      `SELECT unit_price_cop, unit_price_usd_cents FROM order_items WHERE order_id = $1`, [order.id]);
    expect(item.unit_price_usd_cents).toBe(24000);
    expect(item.unit_price_cop).toBe(960000);
  });

  it('refuses to create an order when no rate is available', async () => {
    const rate = { copPerUsd: async () => { throw new Error('EXCHANGE_RATE_UNAVAILABLE'); } };
    const withRate = new OrdersService(ds, new PiecesService(ds), rate as never);

    const slug = await newPiece(24000);
    await expect(withRate.create(await newUser(), {
      pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
    })).rejects.toThrow(/EXCHANGE_RATE_UNAVAILABLE/);

    // Nothing was taken: a failed conversion must not park a unit.
    const [piece] = await ds.query(`SELECT stock FROM pieces WHERE slug = $1`, [slug]);
    expect(piece.stock).toBe(1);
  });
});
```

También hay que actualizar el `beforeAll` del archivo (que construye
`orders = new OrdersService(ds, new PiecesService(ds))`) para pasarle un
`ExchangeRateService` de prueba con una tasa fija, y `newPiece`/`newDrop`
(que hoy insertan `price_cop`) para usar `price_usd_cents`:

```ts
// api/test/integration/create-order.spec.ts — reemplazar en beforeAll:
orders = new OrdersService(ds, new PiecesService(ds), { copPerUsd: async () => 4000 } as never);

// y en newPiece / newDrop, cambiar la columna:
const newPiece = async (priceUsdCents = 5000, stock = 1, status = 'available'): Promise<string> => {
  const slug = `p-${Math.random().toString(36).slice(2)}`;
  await ds.query(
    `INSERT INTO pieces (slug, title, price_usd_cents, stock, status, published_at)
     VALUES ($1, 'P', $2, $3, $4, now())`, [slug, priceUsdCents, stock, status]);
  return slug;
};

const newDrop = async (priceUsdCents = 250): Promise<string> => {
  const slug = `d-${Math.random().toString(36).slice(2)}`;
  await ds.query(
    `INSERT INTO drops (slug, title, price_usd_cents, video_asset_id, capacity, status, published_at)
     VALUES ($1, 'D', $2, 'vid', 50, 'available', now())`, [slug, priceUsdCents]);
  return slug;
};
```

Todas las aserciones existentes del archivo que comparaban un `totalCop`
contra un valor en pesos (p. ej. `expect(order.totalCop).toBe(525000)` en
"adds up the total from database prices") pasan a esperar el resultado **ya
convertido a la tasa fija de prueba (4000)** — por ejemplo, una pieza de
`500000` se vuelve `newPiece(12500)` ($125.00) y un drop de `25000` se
vuelve `newDrop(625)` ($6.25); el total esperado sigue siendo `525000`
porque `12500/100*4000 + 625/100*4000 = 500000 + 25000 = 525000` — mismo
resultado en pesos, ahora expresado en dólares como entrada.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `cd api && npx jest create-order`
Expected: FAIL — `OrdersService` no acepta un tercer argumento todavía.

- [ ] **Step 3: Implementar**

`api/src/orders/orders.service.ts`, constructor:
```ts
constructor(
  @InjectDataSource() private readonly ds: DataSource,
  private readonly pieces: PiecesService,
  private readonly rates: ExchangeRateService,
) {}
```
(agregar `import { ExchangeRateService } from '../payments/exchange-rate.service';`)

Reemplazar las consultas de piezas/drops (`price_cop` → `price_usd_cents`):
```ts
const pieces = input.pieceSlugs.length
  ? returnedRows<{ id: string; slug: string; price_usd_cents: number }>(
      await this.ds.query(
        `SELECT id, slug, price_usd_cents FROM pieces
          WHERE slug = ANY($1) AND status = 'available'`,
        [input.pieceSlugs],
      ),
    )
  : [];
if (pieces.length !== input.pieceSlugs.length) throw new ConflictException('PIECE_UNAVAILABLE');

const drops = input.dropSlugs.length
  ? returnedRows<{ id: string; slug: string; price_usd_cents: number }>(
      await this.ds.query(
        `SELECT id, slug, price_usd_cents FROM drops
          WHERE slug = ANY($1) AND status = 'available'`,
        [input.dropSlugs],
      ),
    )
  : [];
if (drops.length !== input.dropSlugs.length) throw new ConflictException('DROP_UNAVAILABLE');
```

Después de validar drops/piezas y antes de tomar stock, congelar la tasa
**una sola vez** para todo el pedido:
```ts
const copPerUsd = await this.rates.copPerUsd();
const toCop = (usdCents: number) => Math.round((usdCents / 100) * copPerUsd);
```

Reemplazar el cálculo del total y los INSERT:
```ts
const totalUsdCents =
  pieces.reduce((sum, p) => sum + p.price_usd_cents, 0) +
  drops.reduce((sum, d) => sum + d.price_usd_cents, 0);
// Se suma lo ya redondeado por línea, no se redondea la suma: así el total
// coincide con lo que un comprador vería sumando las líneas a mano.
const totalCop =
  pieces.reduce((sum, p) => sum + toCop(p.price_usd_cents), 0) +
  drops.reduce((sum, d) => sum + toCop(d.price_usd_cents), 0);

return await this.ds.transaction(async (m) => {
  const order = firstRow<{ id: string; reference: string; total_cop: number; total_usd_cents: number }>(
    await m.query(
      `INSERT INTO orders (user_id, total_cop, total_usd_cents, payment_method, shipping_address, reference)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, reference, total_cop, total_usd_cents`,
      [
        userId,
        totalCop,
        totalUsdCents,
        input.paymentMethod,
        input.shippingAddress ?? null,
        `ord_${randomBytes(12).toString('hex')}`,
      ],
    ),
  );
  if (!order) throw new Error('ORDER_INSERT_FAILED');

  const signed = new Set(input.signedPieceSlugs ?? []);
  for (const piece of pieces) {
    await m.query(
      `INSERT INTO order_items (order_id, piece_id, unit_price_cop, unit_price_usd_cents, wants_signature)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.id, piece.id, toCop(piece.price_usd_cents), piece.price_usd_cents, signed.has(piece.slug)],
    );
  }
  for (const drop of drops) {
    await m.query(
      `INSERT INTO order_items (order_id, drop_id, unit_price_cop, unit_price_usd_cents)
       VALUES ($1, $2, $3, $4)`,
      [order.id, drop.id, toCop(drop.price_usd_cents), drop.price_usd_cents],
    );
  }

  return {
    id: order.id, reference: order.reference,
    totalCop: order.total_cop, totalUsdCents: order.total_usd_cents!,
  };
});
```

`CreatedOrder` (arriba del archivo) gana el campo:
```ts
export interface CreatedOrder {
  id: string;
  reference: string;
  totalCop: number;
  totalUsdCents: number;
}
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `cd api && npx jest create-order`
Expected: PASS, todas.

- [ ] **Step 5: `AccountService` devuelve el lado en dólares**

`api/src/orders/account.service.ts` — `OrderSummary` (tipo compartido con
el front, en `api/src/orders/account.service.ts` y espejado en
`web/lib/types.ts`) gana `totalUsdCents: number | null`. `OrderRow`
(línea 75-84) gana `total_usd_cents: number | null`, y los dos `SELECT`
que hoy traen `o.total_cop` (líneas 133 y 190) agregan `o.total_usd_cents`:

```ts
// orders(), línea 133
`SELECT o.id, o.reference, o.status, o.total_cop, o.total_usd_cents, o.created_at,
        o.tracking_carrier, o.tracking_number,
        c.id AS contract_id
   FROM orders o
   ...`
```
```ts
// orderById(), línea 190
`SELECT o.id, o.user_id, o.reference, o.status, o.total_cop, o.total_usd_cents, o.created_at,
        ...`
```
Y en el mapeo a `OrderSummary` (líneas 172 y 224):
```ts
totalCop: o.total_cop,
totalUsdCents: o.total_usd_cents,
```

Es `null` solo para pedidos creados antes de esta tarea (la columna nace
nula, Task 1) — todo pedido nuevo lo trae siempre, por el Step 3 de esta
misma tarea.

- [ ] **Step 6: Prueba**

```ts
// añadir a api/test/integration/create-order.spec.ts, en el describe "freezing the peso price"
it('AccountService.orderById reads the frozen dollar figure back', async () => {
  const rate = { copPerUsd: async () => 4000 };
  const withRate = new OrdersService(ds, new PiecesService(ds), rate as never);
  const account = new AccountService(ds);

  const slug = await newPiece(5000); // $50.00
  const userId = await newUser();
  const created = await withRate.create(userId, {
    pieceSlugs: [slug], dropSlugs: [], paymentMethod: 'CARD', shippingAddress: address,
  });

  const found = await account.orderById(created.id);
  expect(found!.totalUsdCents).toBe(5000);
  expect(found!.totalCop).toBe(200000);
});
```
(agregar `import { AccountService } from '../../src/orders/account.service';`
al inicio del archivo).

Run: `cd api && npx jest create-order`
Expected: PASS.

- [ ] **Step 7: `wiring.spec.ts` no debe llamar a la red de verdad**

`wiring.spec.ts` levanta el `AppModule` completo y ya hace varios
`POST /orders` (y la Task 6 le agrega otro). Sin sobreescribir el
provider, cada uno de esos dispararía una llamada real a `datos.gov.co` —
lenta, y una prueba que depende de que una API externa esté arriba no es
una prueba, es una apuesta. Se sobreescribe con una tasa fija:

```ts
// wiring.spec.ts — imports
import { ExchangeRateService } from '../../src/payments/exchange-rate.service';
```
```ts
// wiring.spec.ts — dentro de beforeAll, antes de moduleRef.compile()
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(ExchangeRateService)
  .useValue({ copPerUsd: async () => 4000 })
  .compile();
```

- [ ] **Step 8: Correr `wiring.spec.ts` y confirmar que no hace red**

Run: `cd api && npx jest wiring`
Expected: PASS, y en un tiempo comparable al de antes de esta tarea (si
tarda notablemente más, algo sigue llamando a la red de verdad).

- [ ] **Step 9: Commit**

```bash
git add api/src/orders/orders.service.ts api/src/orders/account.service.ts \
  api/test/integration/create-order.spec.ts api/test/integration/wiring.spec.ts
git commit -m "feat(api): congelar el precio en pesos a la TRM al crear el pedido"
```

---

## Task 4: Renombrar `price_cop` en el resto de la API

Tarea mecánica: todo lugar que lee o escribe el precio de una **pieza o
video** (no de un pedido) cambia `price_cop`/`priceCop` por
`price_usd_cents`/`priceUsdCents`. Ningún `total_cop`/`unit_price_cop` de
`orders`/`order_items` se toca aquí — esos ya se resolvieron en la Task 3 y
significan "lo cobrado", no "el precio de catálogo".

**Files:**
- Modify: `api/src/pieces/pieces.service.ts` (líneas 10, 30, 48, 64, 85)
- Modify: `api/src/drops/drops.service.ts` (líneas 18, 31, 38, 158)
- Modify: `api/src/admin/admin.service.ts` (líneas 19, 31, 69, 77, 90, 98, 122, 130, 143, 150, 238, 242, 253, 260, 264, 273, 290, 300, 309, 322)
- Modify: `api/src/contracts/contracts.service.ts` (líneas 48, 53 — `unit_price_cop` sigue igual; se agrega leer `unit_price_usd_cents` también, ver Step 3)
- Modify: `api/src/contracts/contract-pdf.service.ts`
- Modify: `api/src/database/seed.ts`

**Interfaces:**
- Produce: `ContractData` (contract-pdf.service.ts) gana `priceUsdCents: number | null` junto al ya existente `priceCop`.

- [ ] **Step 1: `pieces.service.ts` y `drops.service.ts`**

En ambos archivos, reemplazar cada `price_cop` (SQL) por `price_usd_cents`,
y cada `priceCop` (TypeScript, en la interfaz pública y en el `SELECT`/mapeo
de retorno) por `priceUsdCents`. Son cuatro sitios por archivo: la interfaz
de detalle (`PieceDetail`/`DropDetail`), la fila interna
(`PieceRow`/`DropRow` o equivalente), la columna en el `SELECT`, y la
asignación al construir la respuesta.

- [ ] **Step 2: `admin.service.ts`**

Mismo reemplazo (`price_cop`→`price_usd_cents`, `priceCop`→`priceUsdCents`)
en: `AdminPiece`, `AdminDrop`, `NewPiece`, `NewDrop`, `PIECE_FIELDS`,
`DROP_FIELDS` (el mapa que traduce nombre de campo TS a columna SQL —
cambia tanto la clave como el valor:
`priceCop: 'price_cop'` → `priceUsdCents: 'price_usd_cents'`), los
`INSERT INTO pieces`/`INSERT INTO drops` de `createPiece`/`createDrop`, y
los `SELECT` + mapeo de `listPieces`, `listDrops`, `findPiece`, `findDrop`.

`AdminOrder.totalCop`/`total_cop` (línea 53, 339, 347, 384) **no cambia** —
es el total del pedido, no el precio de catálogo.

- [ ] **Step 3: `contracts.service.ts` y `contract-pdf.service.ts`**

`contracts.service.ts` (método `prepare`, líneas ~45-63): el `SELECT` que
hoy trae `oi.unit_price_cop` gana también `oi.unit_price_usd_cents`:
```ts
const row = firstRow<{
  order_id: string; reference: string; user_id: string; email: string;
  piece_id: string; title: string; description: string;
  unit_price_cop: number; unit_price_usd_cents: number | null;
}>(
  await this.ds.query(
    `SELECT o.id AS order_id, o.reference, o.user_id, u.email,
            p.id AS piece_id, p.title, coalesce(p.description, '') AS description,
            oi.unit_price_cop, oi.unit_price_usd_cents
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id AND oi.piece_id IS NOT NULL
       JOIN pieces p ON p.id = oi.piece_id
       JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
      LIMIT 1`,
    [orderId],
  ),
);
```
Y donde se arma `ContractData` para `this.pdf.render(...)`, agregar
`priceUsdCents: row.unit_price_usd_cents`.

`contract-pdf.service.ts`:
```ts
export interface ContractData {
  reference: string;
  pieceTitle: string;
  pieceDescription: string;
  priceCop: number;
  priceUsdCents: number | null;
  buyerName: string;
  buyerDocument: string;
  buyerEmail: string;
  consentTextVersion: string;
}
```
Y donde se dibuja el precio (línea ~48-71):
```ts
const cop = new Intl.NumberFormat('es-CO').format(data.priceCop);
const figure = data.priceUsdCents !== null
  ? `$${(data.priceUsdCents / 100).toFixed(2)} USD ($${cop} COP)`
  : `$${cop} COP`; // pedido antiguo, sin registro en dólares
```
y `layout.figure(figure);` en vez de `` layout.figure(`$${money} COP`); ``.
(`priceUsdCents` es nulo solo para pedidos creados antes de esta tarea —
todo pedido nuevo lo trae siempre, por la Task 3.)

- [ ] **Step 4: `seed.ts`**

Reemplazar `price_cop`/`priceCop` por `price_usd_cents`/`priceUsdCents` en
las constantes `PIECES`/`DROPS` (líneas ~196 y las análogas de cada pieza) y
en los `INSERT`/`UPDATE` de `pieces`/`drops` (líneas 210-259). Los valores
literales de precio en `PIECES`/`DROPS` se dividen entre 100 (de pesos
"nominales" a centavos de dólar de ejemplo — es dato de muestra, no importa
que no sea una conversión real): p. ej. `priceCop: 2400000` pasa a
`priceUsdCents: 24000`.

Los `INSERT INTO orders`/`INSERT INTO order_items` de `fillSeats`,
`createOrder` y `grant` (líneas 319-426) **no cambian de columna** —
siguen escribiendo `total_cop`/`unit_price_cop` tal cual, y como
`total_usd_cents`/`unit_price_usd_cents` son nulos por diseño (Task 1), no
hace falta llenarlos aquí. Los literales que hoy leen `price_cop`/`priceCop`
de las piezas/drops seed (líneas 320, 343, 354, 375, 381, 388, 414, 417) se
renombran a `price_usd_cents`/`priceUsdCents`, y los montos fijos de esas
funciones (`25000` en `fillSeats`, `2400000` y `925000` en
`giveBuyerHistory`) se dividen entre 100 igual que los de arriba —
`lazy: montos de ejemplo, no convertidos a una tasa real; nadie transa
dinero de verdad contra datos de siembra`.

- [ ] **Step 5: Verificar**

```bash
cd api
npm run build
npx jest
```
Expected: build sin errores; toda la suite en verde (las pruebas que
insertan `price_cop`/`priceCop` directamente se resuelven en la Task 5).

- [ ] **Step 6: Commit**

```bash
git add api/src/pieces/pieces.service.ts api/src/drops/drops.service.ts \
  api/src/admin/admin.service.ts api/src/contracts/contracts.service.ts \
  api/src/contracts/contract-pdf.service.ts api/src/database/seed.ts
git commit -m "refactor(api): price_cop -> price_usd_cents en piezas y videos"
```

---

## Task 5: Renombrar `price_cop` en las pruebas existentes

**Files:**
- Modify: `api/test/integration/admin.spec.ts`
- Modify: `api/test/integration/contract-pdf.spec.ts`
- Modify: `api/test/integration/contract-signing.spec.ts`
- Modify: `api/test/integration/drop-capacity.spec.ts`
- Modify: `api/test/integration/piece-stock.spec.ts`
- Modify: `api/test/integration/playback.spec.ts`
- Modify: `api/test/integration/public-read.spec.ts`
- Modify: `api/test/integration/wiring.spec.ts`

(`create-order.spec.ts` y `schema.spec.ts` ya se resolvieron en las Tasks 1
y 3. `payment-settlement.spec.ts`/`reconciliation.spec.ts` no tocan
`price_cop`/`priceCop` en ningún punto — usan `total_cop`, que no cambió.)

En cada archivo de la lista: todo `INSERT INTO pieces (..., price_cop, ...)`
o `INSERT INTO drops (..., price_cop, ...)` pasa a `price_usd_cents`; toda
aserción sobre un campo `priceCop`/`price_cop` en la respuesta de un
endpoint pasa a `priceUsdCents`/`price_usd_cents`. Los valores numéricos
usados no necesitan cambiar (siguen siendo números de prueba válidos,
ahora interpretados como centavos de dólar en vez de pesos) salvo que la
prueba misma calcule algo a partir de ellos — en ese caso, el cálculo sigue
siendo correcto porque opera sobre el mismo número, solo cambió qué
representa.

- [ ] **Step 1: Aplicar el reemplazo en los ocho archivos**

Por archivo: `grep -n "price_cop\|priceCop" api/test/integration/<archivo>`
para ubicar cada ocurrencia, y reemplazarla por su equivalente en
`price_usd_cents`/`priceUsdCents`.

- [ ] **Step 2: Correr la suite completa**

Run: `cd api && npx jest`
Expected: PASS — mismo número de pruebas que antes de la Task 1.

- [ ] **Step 3: Commit**

```bash
git add api/test/integration/admin.spec.ts api/test/integration/contract-pdf.spec.ts \
  api/test/integration/contract-signing.spec.ts api/test/integration/drop-capacity.spec.ts \
  api/test/integration/piece-stock.spec.ts api/test/integration/playback.spec.ts \
  api/test/integration/public-read.spec.ts api/test/integration/wiring.spec.ts
git commit -m "test(api): price_cop -> price_usd_cents en fixtures existentes"
```

---

## Task 6: País en el envío

**Files:**
- Modify: `api/src/orders/orders.controller.ts:18-21`
- Modify: `web/app/checkout/page.tsx`
- Modify: `web/app/studio/pedidos/page.tsx:61-66`

**Interfaces:**
- Produce: `shippingAddress` (API y front) gana `country: string`, requerido
  cuando hay al menos una pieza física en el pedido — mismo requisito que
  `line1`/`city`/`phone` ya tienen hoy.

- [ ] **Step 1: `ShippingAddressDto` en la API**

`api/src/orders/orders.controller.ts:18-21`:
```ts
class ShippingAddressDto {
  @IsString() line1!: string;
  @IsString() city!: string;
  @IsString() country!: string;
  @IsString() phone!: string;
}
```

- [ ] **Step 2: Prueba de la validación**

```ts
// añadir a api/test/integration/wiring.spec.ts, junto a "rejects an address that is not one"
it('requires a country in the shipping address', async () => {
  const { token } = await session();
  await ds.query(
    `INSERT INTO pieces (slug, title, price_usd_cents, status, published_at)
     VALUES ('boceto-pais', 'Boceto', 25000, 'available', now())`,
  );
  await request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', 'pais-1')
    .send({
      pieceSlugs: ['boceto-pais'], dropSlugs: [], paymentMethod: 'CARD',
      shippingAddress: { line1: 'Calle 1', city: 'Medellín', phone: '3001234567' },
    })
    .expect(400);
});
```

- [ ] **Step 3: Correr la prueba y verificar que falla**

Run: `cd api && npx jest wiring -t "requires a country"`
Expected: FAIL — hoy `country` no es requerido, así que la petición
respondería 201, no 400.

- [ ] **Step 4: Aplicar el Step 1 y correr de nuevo**

Run: `cd api && npx jest wiring -t "requires a country"`
Expected: PASS.

- [ ] **Step 5: Formulario de `/checkout`**

`web/app/checkout/page.tsx`: el estado `address` gana `country`:
```ts
const [address, setAddress] = useState({ line1: '', city: '', country: '', phone: '' });
```
y en el fieldset «A dónde la enviamos», junto al campo Ciudad:
```tsx
<label htmlFor="country">País</label>
<input
  id="country"
  value={address.country}
  onChange={(e) => setAddress({ ...address, country: e.target.value })}
  autoComplete="country-name"
  required
/>
```
`addressComplete` gana la condición: `&& address.country.trim() !== ''`.

- [ ] **Step 6: Mostrarlo en `/studio/pedidos`**

`web/app/studio/pedidos/page.tsx:61-66`, agregar `country` a la lista que
ya arma la línea de dirección:
```ts
{[order.shippingAddress.line1, order.shippingAddress.city,
  order.shippingAddress.country, order.shippingAddress.phone]
  .filter(Boolean).join(', ')}
```

- [ ] **Step 7: Verificar todo junto**

```bash
cd api && npx jest wiring
cd ../web && npx tsc --noEmit
```
Expected: ambos en verde.

- [ ] **Step 8: Commit**

```bash
git add api/src/orders/orders.controller.ts api/test/integration/wiring.spec.ts \
  web/app/checkout/page.tsx web/app/studio/pedidos/page.tsx
git commit -m "feat: país en la dirección de envío, para piezas internacionales"
```

---

## Task 7: El front muestra dólares

Tarea mecánica de renombrado, igual que la Task 4 pero en `web/`: todo
precio de **catálogo** (pieza o video) pasa de `priceCop` a
`priceUsdCents`. Los totales de **pedido** (`OrderSummary.totalCop`, el
`totalCop` que devuelve `createOrder`) no se renombran — ganan un
`totalUsdCents` nuevo al lado (ver Task 3, ya lo devuelve la API).

**Files:**
- Modify: `web/lib/types.ts` (líneas 17, 36, 68, 95, 106, 120, 136)
- Modify: `web/lib/api.ts:77-78`
- Modify: `web/lib/cart.ts`
- Modify: `web/lib/checkout-actions.ts:118,122`
- Modify: `web/lib/studio-actions.ts:52,60`
- Modify: `web/lib/mock-data.ts`
- Modify: `web/components/PieceForm.tsx:26,61`
- Modify: `web/components/VideoForm.tsx:21,128`
- Modify: `web/app/page.tsx`, `web/app/piezas/[slug]/page.tsx`,
  `web/app/drops/[slug]/page.tsx`, `web/app/carrito/page.tsx`,
  `web/app/checkout/page.tsx`, `web/app/cuenta/page.tsx`,
  `web/app/studio/page.tsx`

**Interfaces:**
- Produce: `PieceSummary.priceUsdCents`, `PieceDetail.priceUsdCents`,
  `DropDetail.priceUsdCents`, `AdminPiece.priceUsdCents`,
  `AdminDrop.priceUsdCents`, `CartLine.priceUsdCents`. `OrderSummary`
  gana `totalUsdCents: number | null` junto al ya existente `totalCop`
  (nulo solo para un pedido de antes de la Task 3 — todo pedido nuevo lo
  trae siempre).

- [ ] **Step 1: `types.ts`**

Renombrar `priceCop`→`priceUsdCents` en `PieceSummary` (línea 17),
`PieceDetail` si lo declara aparte (línea 36), `AdminPiece` (línea 95),
`AdminDrop` (línea 106), y donde más aparezca ligado a una pieza/drop
(línea 120). En `OrderSummary` (línea 68) y `AdminOrder` (línea 136), dejar
`totalCop` como está y agregar `totalUsdCents: number | null` justo al lado.

- [ ] **Step 2: `cart.ts`**

```ts
export interface CartLine {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
  priceUsdCents: number; // antes: priceCop
}
```
La función que suma el carrito (usada como `cartTotalCop` hoy) se renombra
a `cartTotalUsdCents` y su cuerpo (`lines.reduce((sum, l) => sum + l.priceUsdCents, 0)`)
usa el campo nuevo. Todo lugar que la llama (`carrito/page.tsx`,
`checkout/page.tsx`) se actualiza al nuevo nombre.

- [ ] **Step 3: `api.ts` (mock)**

Línea 77-78:
```ts
if (path === '/pieces') {
  return PIECES.map(({ slug, title, priceUsdCents, images, stock, available }) => ({
    slug, title, priceUsdCents, images, stock, available,
  })) as T;
}
```

- [ ] **Step 4: `mock-data.ts`**

Cada objeto de `PIECES`/`DROPS` cambia `priceCop: N` por
`priceUsdCents: Math.round(N / 100)` — mismo criterio que en el seed de la
API (Task 4, Step 4): son datos de muestra, no una conversión real.

- [ ] **Step 5: `checkout-actions.ts` y `studio-actions.ts`**

`checkout-actions.ts:118,122`: el tipo de retorno de `createOrder` gana
`totalUsdCents`:
```ts
export async function createOrder(
  input: CreateOrderInput,
): Promise<Result<{ id: string; reference: string; totalCop: number; totalUsdCents: number }>> {
```
y el tipo interno de `apiSend` en el mismo lugar, igual.

`studio-actions.ts:52,60`: `PieceInput.priceCop`/`DropInput.priceCop`
pasan a `priceUsdCents`.

- [ ] **Step 6: `PieceForm.tsx` y `VideoForm.tsx`**

`PieceForm.tsx:26,61`: `piece?.priceCop` → `piece?.priceUsdCents`;
`priceCop: price` → `priceUsdCents: price` en el payload que se envía.
Mismo cambio en `VideoForm.tsx:21,128`.

- [ ] **Step 7: Páginas que muestran precio de catálogo**

En `page.tsx` (home), `piezas/[slug]/page.tsx`, `drops/[slug]/page.tsx`,
`carrito/page.tsx`, `checkout/page.tsx` y `studio/page.tsx`: cada
`formatPrice(x.priceCop)` pasa a `formatPrice(x.priceUsdCents)`. En
`carrito/page.tsx` y `checkout/page.tsx`, `cartTotalCop(lines)` pasa a
`cartTotalUsdCents(lines)` (Step 2).

- [ ] **Step 8: `cuenta/page.tsx`**

Ahí solo se muestra `formatPrice(order.totalCop)` — **no cambia**: sigue
siendo el total en pesos que de verdad se cobró (ver el aviso de la Task 8
sobre `formatPrice`; ese uso puntual se revisa en esa tarea, no aquí).

- [ ] **Step 9: Verificar**

```bash
cd web
npx tsc --noEmit
npx jest
```
Expected: ambos en verde. `tsc` va a señalar cualquier `priceCop` que haya
quedado sin renombrar — seguirlos hasta que no queden.

- [ ] **Step 10: Commit**

```bash
git add web/lib web/components/PieceForm.tsx web/components/VideoForm.tsx \
  web/app/page.tsx web/app/piezas web/app/drops web/app/carrito \
  web/app/checkout/page.tsx web/app/studio/page.tsx
git commit -m "refactor(web): priceCop -> priceUsdCents en catálogo y carrito"
```

---

## Task 8: `formatPrice` en dólares, y el aviso de conversión en el checkout

**Files:**
- Modify: `web/lib/format.ts:1-7`
- Modify: `web/lib/format.test.ts:4-7`
- Modify: `web/components/PriceInput.tsx`
- Modify: `web/lib/fees.ts`
- Modify: `web/lib/fees.test.ts`
- Modify: `web/app/checkout/pagar/page.tsx`
- Modify: `web/app/cuenta/page.tsx` (el `formatPrice(order.totalCop)` de la Task 7 Step 8)

**Interfaces:**
- Produce: `formatPrice(usdCents: number): string` (antes tomaba pesos).
  Para mostrar el total en pesos que de verdad se cobra, se usa un
  `formatPrice` distinto sobre `totalCop` — ver Step 5.

- [ ] **Step 1: Prueba de `formatPrice`**

```ts
// web/lib/format.test.ts:4-7, reemplazar
it('formats dollars with cents and a thousands separator', () => {
  expect(formatPrice(2500)).toBe('$25.00 USD');
  expect(formatPrice(400)).toBe('$4.00 USD');
  expect(formatPrice(1234567)).toBe('$12,345.67 USD');
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `cd web && npx jest format`
Expected: FAIL — `formatPrice(2500)` hoy devuelve `"$2.500 COP"`.

- [ ] **Step 3: Implementar**

```ts
// web/lib/format.ts:1-7
const DOLLARS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** User-facing strings stay in Spanish; the number itself reads as a dollar amount. */
export function formatPrice(usdCents: number): string {
  return `$${DOLLARS.format(usdCents / 100)} USD`;
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `cd web && npx jest format`
Expected: PASS.

- [ ] **Step 5: El total en pesos, donde de verdad se cobra**

`web/app/checkout/pagar/page.tsx` hoy es enteramente `'use client'` y no lee
el pedido, solo tiene el `orderId` de la URL. `apiGet` es server-only (usa
`next/headers`), así que no se puede llamar desde `Pay` directamente — el
patrón correcto es el mismo que ya usa `checkout/resultado/page.tsx`: un
`page.tsx` servidor que hace el `apiGet` y pasa el resultado como prop a un
componente cliente. `PayPage` deja de ser el único export cliente del
archivo: se separa el fetch (servidor) del botón interactivo (cliente).

Archivo completo reescrito:
```tsx
// web/app/checkout/pagar/page.tsx
import { Suspense } from 'react';
import { apiGet } from '@/lib/api';
import { OrderSummary } from '@/lib/types';
import { Pay } from './Pay';
import styles from './page.module.scss';

async function PayLoader({ orderId }: { orderId: string }) {
  const order = await apiGet<OrderSummary>(`/orders/${orderId}`, true).catch(() => null);
  return <Pay orderId={orderId} order={order} />;
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) {
    return (
      <div className={styles.pay}>
        <p>Este enlace no lleva a ningún pedido.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className={styles.pay} />}>
      <PayLoader orderId={orderId} />
    </Suspense>
  );
}
```

```tsx
// web/app/checkout/pagar/Pay.tsx — el botón interactivo, ahora recibe el pedido ya cargado
'use client';

import { useState } from 'react';
import { startPayment } from '@/lib/checkout-actions';
import { formatPrice } from '@/lib/format';
import { OrderSummary } from '@/lib/types';
import styles from './page.module.scss';

export function Pay({ orderId, order }: { orderId: string; order: OrderSummary | null }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setWorking(true);
    setError(null);

    const result = await startPayment(orderId);
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }
    window.location.replace(result.data.checkoutUrl);
  }

  return (
    <div className={styles.pay}>
      <h1 className="label muted">Pagar</h1>

      {/* totalUsdCents es null solo en un pedido de antes de esta función —
          en ese caso se muestra nada más el peso, que es lo único que hubo. */}
      {order && order.totalUsdCents !== null && (
        <p className="muted">
          Total: {formatPrice(order.totalUsdCents)} — se cobra como{' '}
          {new Intl.NumberFormat('es-CO').format(order.totalCop)} COP (tasa de hoy)
        </p>
      )}
      {order && order.totalUsdCents === null && (
        <p className="muted">
          Total: {new Intl.NumberFormat('es-CO').format(order.totalCop)} COP
        </p>
      )}

      <p>Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.</p>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <button type="button" onClick={pay} disabled={working}>
        {working ? 'Abriendo…' : 'Ir a pagar'}
      </button>

      <p className="muted">Los datos de tu tarjeta no pasan por esta tienda.</p>
    </div>
  );
}
```

`startPayment` ya existe en `web/lib/checkout-actions.ts` con esta misma
firma (`(orderId: string) => Promise<Result<{ checkoutUrl: string }>>`) —
no cambia.

- [ ] **Step 6: `cuenta/page.tsx`**

`formatPrice(order.totalCop)` (Task 7 Step 8) pasa a llamarse con el
dato correcto: como `formatPrice` ahora espera dólares, ese uso puntual se
reemplaza por el pesos formateados a mano, igual que en el Step 5:
```tsx
<span>{new Intl.NumberFormat('es-CO').format(order.totalCop)} COP</span>
```

- [ ] **Step 7: `PriceInput.tsx`**

```tsx
// web/components/PriceInput.tsx
const DOLLARS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```
El campo sigue guardando un entero (ahora centavos de dólar): quien
escribe `25.00` debe producir `2500`. Como `caretAfterFormat` cuenta
dígitos y el punto decimal no es un dígito, el flujo de entrada existente
(dígitos crudos → formatear) sigue funcionando si se interpreta lo tecleado
como centavos directamente (igual que hoy se interpreta como pesos
enteros) — cambia el sufijo visual:
```tsx
<span className={styles.currency} aria-hidden="true">USD</span>
```
y el formateo de vista pasa a `` `$${DOLLARS.format(value / 100)}` `` en
vez de `PESOS.format(value)`, mostrando el valor con dos decimales tal como
lo interpretará `formatPrice`.

- [ ] **Step 8: `fees.ts`**

```ts
// web/lib/fees.ts
/**
 * Comisión real de Wompi: porcentaje sobre lo que de verdad se cobra en
 * pesos, más un monto fijo por transacción. El porcentaje no cambia al
 * pasar a dólares — es una proporción, no una cifra en una moneda — pero
 * el monto fijo (900 COP) sí necesita una referencia para expresarse en
 * dólares; se usa una tasa de referencia fija para esta estimación nada
 * más, no la TRM en vivo (ver docs/superpowers/specs/2026-08-27-precios-usd-cobro-trm-design.md
 * §6 — esto es una guía para el artista, no una liquidación).
 */
const RATE = 0.0265;
const FLAT_USD_CENTS = 30; // ~900 COP a una tasa de referencia de ~3.000 COP/USD

/** Por debajo de esto, la comisión se come más del 10%. */
export const SUGGESTED_PRICE_USD_CENTS = 500;

export interface Fees {
  feeUsdCents: number;
  payoutUsdCents: number;
  percentage: number;
}

export function calculateFees(priceUsdCents: number): Fees {
  if (priceUsdCents <= 0) return { feeUsdCents: 0, payoutUsdCents: 0, percentage: 0 };
  const feeUsdCents = Math.round(priceUsdCents * RATE) + FLAT_USD_CENTS;
  const payoutUsdCents = Math.max(0, priceUsdCents - feeUsdCents);
  return {
    feeUsdCents,
    payoutUsdCents,
    percentage: Math.round((feeUsdCents / priceUsdCents) * 100),
  };
}
```

`web/components/PayoutHint.tsx:21` (`` `Desde ${formatPrice(SUGGESTED_PRICE_COP)} la comisión baja a cerca del 8%.` ``)
cambia a `SUGGESTED_PRICE_USD_CENTS` y a `feeUsdCents`/`payoutUsdCents` en
cualquier otro lugar de ese componente que lea los campos de `Fees`.

- [ ] **Step 9: Prueba de `fees.ts`**

```ts
// web/lib/fees.test.ts, reemplazar todo el archivo
import { calculateFees } from './fees';

describe('fees', () => {
  it('a very cheap price loses a third to the flat fee', () => {
    const f = calculateFees(100); // $1.00
    expect(f.payoutUsdCents).toBe(67);
    expect(f.percentage).toBe(33);
  });

  it('at the suggested price the fee drops to single digits', () => {
    const f = calculateFees(500); // $5.00
    expect(f.percentage).toBeLessThanOrEqual(9);
    expect(f.payoutUsdCents).toBe(457);
  });

  it('on an expensive piece the flat fee stops mattering', () => {
    expect(calculateFees(25000).percentage).toBe(3); // $250.00
  });

  it('never reports a negative payout', () => {
    expect(calculateFees(10).payoutUsdCents).toBe(0);
  });

  it('a zero price does not divide by zero', () => {
    expect(calculateFees(0)).toEqual({ feeUsdCents: 0, payoutUsdCents: 0, percentage: 0 });
  });
});
```

- [ ] **Step 10: Correr todo**

```bash
cd web
npx jest
npx tsc --noEmit
```
Expected: ambos en verde.

- [ ] **Step 11: Commit**

```bash
git add web/lib/format.ts web/lib/format.test.ts web/components/PriceInput.tsx \
  web/lib/fees.ts web/lib/fees.test.ts web/components/PayoutHint.tsx \
  web/app/checkout/pagar/page.tsx web/app/cuenta/page.tsx
git commit -m "feat(web): mostrar precios en USD, con el equivalente en pesos antes de pagar"
```

---

## Task 9: Verificación final de punta a punta

**Files:** ninguno nuevo — corre todo lo anterior junto.

- [ ] **Step 1: Suite completa de la API**

```bash
cd api
docker compose -f ../docker-compose.test.yml up -d
npm run build
npx jest
```
Expected: build sin errores; toda la suite en verde.

- [ ] **Step 2: Suite completa del front**

```bash
cd web
npx tsc --noEmit
npx jest
```
Expected: ambos en verde.

- [ ] **Step 3: Migración contra una base de desarrollo real**

```bash
cd ..
docker compose up -d
cd api
npm run seed:fresh
```
Expected: siembra sin errores, con los nuevos `price_usd_cents`.

- [ ] **Step 4: Prueba manual del flujo**

Con `API_URL=http://localhost:3000` en `web/.env.local` y ambos servidores
corriendo (`npm run start:dev` en `api/`, `npm run dev -- -p 3001` en
`web/`): abrir una pieza, confirmar que el precio se ve en dólares,
agregarla al carrito, ir a `/checkout`, llenar el país, avanzar hasta
`/checkout/pagar` y confirmar que aparece el total en dólares junto al
equivalente en pesos que realmente se va a cobrar.

- [ ] **Step 5: Commit final (si hubo ajustes de la verificación manual)**

```bash
git add -A
git commit -m "chore: ajustes tras la verificación de punta a punta"
```
