# API núcleo — Plan de implementación (Fase 1, plan 1 de 3)

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDO: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Construir la API de la tienda —piezas únicas, drops digitales efímeros, checkout, contrato firmado y pagos Wompi— con los tres invariantes garantizados por Postgres y probados bajo concurrencia real.

**Arquitectura:** NestJS sobre Postgres. Todo el estado peligroso (unicidad de pieza, aforo, ventana de visionado) vive en la base de datos, protegido por constraints e índices únicos parciales; ninguna verificación crítica ocurre en memoria de la aplicación. Los invariantes se escriben en migraciones SQL a mano — las validaciones de entidad de TypeORM no protegen contra concurrencia. Todo endpoint que mueva dinero o entregue acceso es reintentable sin consecuencias.

**Stack:** NestJS 10, TypeScript 5, Postgres 16, TypeORM 0.3, Jest + Supertest, pdf-lib, Cloudinary, Cloudflare Stream, Wompi (sandbox), Resend.

**Spec:** `docs/superpowers/specs/2026-08-13-tienda-artista-design.md`

## Restricciones globales

- Node 20 LTS. TypeScript en modo `strict`.
- Postgres 16. Nombres de tabla y columna en `snake_case`; propiedades de entidad en `camelCase`.
- Los invariantes se implementan **en migraciones SQL escritas a mano**, no con decoradores de TypeORM.
- Toda consulta que decida disponibilidad, aforo o acceso corre dentro de una transacción y usa `UPDATE` condicional o `SELECT … FOR UPDATE`. Nunca "leer, verificar en JS, escribir".
- Moneda: enteros en pesos colombianos (`price_cop`), nunca decimales ni flotantes. Wompi recibe centavos (`amount_in_cents = price_cop * 100`).
- Todas las marcas de tiempo son `timestamptz` y se generan con `now()` de Postgres, nunca con `new Date()` de Node.
- **Prueba primero solo en el núcleo.** Las tareas 2, 3, 4, 7, 8 y 10 —invariantes, idempotencia, firma, pagos y ventana de visionado— siguen el ciclo completo: prueba que falla, implementación mínima, prueba que pasa. Las tareas 1, 5, 6, 9, 11 y 12 se implementan directo y se verifican al final; sus pruebas existen pero se escriben después, sin bloquear el avance. La razón es económica: un fallo en el núcleo cuesta dinero y credibilidad; uno en un endpoint de lectura cuesta un despliegue.
- Las pruebas de integración corren contra un Postgres real levantado por Docker. No se permiten mocks de la base de datos.
- Pagos siempre contra el sandbox de Wompi (`pub_test_` / `prv_test_`). Ninguna llave real entra al repo.
- Ningún efecto externo (correo, PDF) se dispara fuera de la transacción que lo autoriza.

---

## Estructura de archivos

```
src/
  main.ts                                arranque
  app.module.ts                          composición de módulos
  config/configuration.ts                config tipada + validación de entorno
  database/data-source.ts                DataSource de TypeORM (app y CLI)
  database/migrations/                   migraciones SQL a mano
  common/idempotency/
    idempotency-key.entity.ts
    idempotency.interceptor.ts           protege endpoints de escritura
  users/user.entity.ts
  auth/
    magic-link.entity.ts
    auth.service.ts                      emitir y canjear enlaces
    auth.controller.ts
    session.guard.ts                     resuelve usuario desde cookie de sesión
  otp/
    otp-challenge.entity.ts
    otp.service.ts                       emitir y verificar códigos
  pieces/
    piece.entity.ts
    pieces.service.ts                    reserva y liberación perezosa
    pieces.controller.ts
  drops/
    drop.entity.ts
    entitlement.entity.ts
    drops.service.ts                     aforo bajo bloqueo de fila
    drops.controller.ts
  orders/
    order.entity.ts
    order-item.entity.ts
    orders.service.ts                    arma el pedido, reserva, calcula total
    orders.controller.ts
  contracts/
    contract.entity.ts
    contract-pdf.service.ts              genera el PDF con pdf-lib
    contracts.service.ts                 firma, hash, acta de evidencias
    contracts.controller.ts
  payments/
    payment-event.entity.ts
    wompi.client.ts                      firma de integridad y consulta de transacción
    payments.service.ts                  liquidación transaccional del pago
    payments.controller.ts               webhook + inicio de pago
    reconciliation.service.ts            único proceso periódico
  playback/
    view-session.entity.ts
    playback.service.ts                  abre ventana y firma token de video
    playback.controller.ts
  mail/mail.service.ts                   Resend
  storage/cloudinary.service.ts          subida de PDF y de imágenes
test/
  setup/db.ts                            DataSource de prueba y truncado entre casos
  setup/factories.ts                     constructores de datos de prueba
  integration/*.spec.ts
docker-compose.test.yml
```

Cada módulo agrupa lo que cambia junto: entidad, servicio y controlador de un mismo concepto viven en la misma carpeta. No hay carpetas por capa técnica (`services/`, `controllers/`) porque obligan a saltar entre directorios para leer una sola funcionalidad.

---

## Tarea 1: Esqueleto, base de datos de prueba y primera migración

**Archivos:**
- Crear: `package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, `.gitignore`
- Crear: `src/main.ts`, `src/app.module.ts`, `src/config/configuration.ts`
- Crear: `src/database/data-source.ts`, `src/database/migrations/1755100000000-init.ts`
- Crear: `src/users/user.entity.ts`, `src/pieces/piece.entity.ts`
- Crear: `docker-compose.test.yml`, `test/setup/db.ts`, `jest.config.js`
- Prueba: `test/integration/schema.spec.ts`

**Interfaces:**
- Produce: `AppDataSource: DataSource`; `testDb(): Promise<DataSource>` y `truncateAll(ds: DataSource): Promise<void>` desde `test/setup/db.ts`; entidades `User` y `Piece`.

- [ ] **Paso 1: Inicializar el proyecto**

```bash
cd /Users/sapalacioa/Documents/Development/Personal/toryteler
npx @nestjs/cli new api --package-manager npm --skip-git --strict
cd api
npm i @nestjs/config typeorm @nestjs/typeorm pg joi
npm i -D @types/supertest supertest ts-node
```

- [ ] **Paso 2: Levantar Postgres de pruebas**

Crear `docker-compose.test.yml` en la raíz del repo:

```yaml
services:
  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: toryteler
      POSTGRES_PASSWORD: toryteler
      POSTGRES_DB: toryteler_test
    ports: ["5433:5432"]
    tmpfs: ["/var/lib/postgresql/data"]
```

Ejecutar: `docker compose -f docker-compose.test.yml up -d`
Esperado: contenedor `db-test` en estado running.

- [ ] **Paso 3: Configuración tipada**

`api/src/config/configuration.ts`:

```ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  SESSION_SECRET: Joi.string().min(32).required(),
  WOMPI_PUBLIC_KEY: Joi.string().required(),
  WOMPI_PRIVATE_KEY: Joi.string().required(),
  WOMPI_INTEGRITY_SECRET: Joi.string().required(),
  WOMPI_EVENTS_SECRET: Joi.string().required(),
  WOMPI_BASE_URL: Joi.string().default('https://sandbox.wompi.co/v1'),
  CHECKOUT_BASE_URL: Joi.string().default('https://checkout.wompi.co/p/'),
  PUBLIC_WEB_URL: Joi.string().required(),
  CLOUDINARY_URL: Joi.string().required(),
  CF_STREAM_ACCOUNT_ID: Joi.string().required(),
  CF_STREAM_TOKEN: Joi.string().required(),
  CF_STREAM_KEY_ID: Joi.string().required(),
  CF_STREAM_KEY_JWK: Joi.string().required(),
  RESEND_API_KEY: Joi.string().required(),
});
```

`api/.env.example`:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://toryteler:toryteler@localhost:5433/toryteler_test
SESSION_SECRET=cambiar-por-32-caracteres-o-mas-aqui
WOMPI_PUBLIC_KEY=pub_test_xxx
WOMPI_PRIVATE_KEY=prv_test_xxx
WOMPI_INTEGRITY_SECRET=test_integrity_xxx
WOMPI_EVENTS_SECRET=test_events_xxx
WOMPI_BASE_URL=https://sandbox.wompi.co/v1
CHECKOUT_BASE_URL=https://checkout.wompi.co/p/
PUBLIC_WEB_URL=http://localhost:3001
CLOUDINARY_URL=cloudinary://key:secret@cloud
CF_STREAM_ACCOUNT_ID=xxx
CF_STREAM_TOKEN=xxx
CF_STREAM_KEY_ID=xxx
CF_STREAM_KEY_JWK=xxx
RESEND_API_KEY=re_xxx
```

Añadir `.env` a `.gitignore`.

- [ ] **Paso 4: DataSource**

`api/src/database/data-source.ts`:

```ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});
```

`synchronize: false` es obligatorio: los invariantes son SQL a mano y la sincronización automática los borraría.

- [ ] **Paso 5: Entidades User y Piece**

`api/src/users/user.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) email!: string;
  @Column({ type: 'text', name: 'full_name', nullable: true }) fullName!: string | null;
  @Column({ type: 'text', name: 'document_id', nullable: true }) documentId!: string | null;
  @Column({ type: 'text', nullable: true }) phone!: string | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}
```

`api/src/pieces/piece.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PieceStatus = 'draft' | 'available' | 'reserved' | 'sold' | 'archived';

@Entity('pieces')
export class Piece {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'text', nullable: true }) story!: string | null;
  @Column({ type: 'text', name: 'personal_note', nullable: true }) personalNote!: string | null;
  @Column({ type: 'int', name: 'price_cop' }) priceCop!: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) images!: string[];
  @Column({ type: 'text', default: 'draft' }) status!: PieceStatus;
  @Column({ type: 'timestamptz', name: 'reserved_until', nullable: true }) reservedUntil!: Date | null;
  @Column({ type: 'timestamptz', name: 'published_at', nullable: true }) publishedAt!: Date | null;
  @Column({ type: 'timestamptz', name: 'sold_at', nullable: true }) soldAt!: Date | null;
}
```

- [ ] **Paso 6: Escribir la prueba que falla**

`api/test/setup/db.ts`:

```ts
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../src/database/data-source';

let ds: DataSource | null = null;

export async function testDb(): Promise<DataSource> {
  if (!ds) {
    ds = await AppDataSource.initialize();
    await ds.runMigrations();
  }
  return ds;
}

export async function truncateAll(ds: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await ds.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'migrations'`,
  );
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await ds.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
```

`api/test/integration/schema.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';

describe('esquema base', () => {
  let ds: DataSource;
  beforeAll(async () => { ds = await testDb(); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  it('rechaza dos usuarios con el mismo correo', async () => {
    await ds.query(`INSERT INTO users (email) VALUES ('a@b.co')`);
    await expect(ds.query(`INSERT INTO users (email) VALUES ('a@b.co')`)).rejects.toThrow();
  });

  it('rechaza una pieza con precio cero o negativo', async () => {
    await expect(
      ds.query(`INSERT INTO pieces (slug, title, price_cop) VALUES ('x', 'X', 0)`),
    ).rejects.toThrow();
  });

  it('rechaza un estado de pieza inválido', async () => {
    await expect(
      ds.query(`INSERT INTO pieces (slug, title, price_cop, status) VALUES ('y', 'Y', 100, 'raro')`),
    ).rejects.toThrow();
  });
});
```

`api/jest.config.js`:

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 1,
};
```

`maxWorkers: 1` porque las pruebas comparten una base de datos y se truncan entre casos.

- [ ] **Paso 7: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/schema.spec.ts`
Esperado: FALLA — la tabla `users` no existe.

- [ ] **Paso 8: Escribir la migración**

`api/src/database/migrations/1755100000000-init.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1755100000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await q.query(`
      CREATE TABLE users (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email       citext NOT NULL UNIQUE,
        full_name   text,
        document_id text,
        phone       text,
        created_at  timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE pieces (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug           text NOT NULL UNIQUE,
        title          text NOT NULL,
        description    text,
        story          text,
        personal_note  text,
        price_cop      integer NOT NULL CHECK (price_cop > 0),
        images         jsonb NOT NULL DEFAULT '[]',
        status         text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','available','reserved','sold','archived')),
        reserved_until timestamptz,
        published_at   timestamptz,
        sold_at        timestamptz
      )`);

    await q.query(`CREATE INDEX idx_pieces_status ON pieces (status)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE pieces`);
    await q.query(`DROP TABLE users`);
  }
}
```

- [ ] **Paso 9: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/schema.spec.ts`
Esperado: PASA — 3 pruebas.

- [ ] **Paso 10: Commit**

```bash
git add api docker-compose.test.yml
git commit -m "feat(api): esqueleto NestJS, Postgres de pruebas y esquema base"
```

---

> **Esta tarea cambió el 14 de agosto de 2026 y el texto de abajo está desactualizado.** Las piezas dejaron de ser necesariamente irrepetibles: llevan `stock`, la reserva es un decremento condicional y el índice único parcial sobre `order_items(piece_id)` desaparece. La regla vigente está en el spec §5.1; las pruebas de concurrencia siguen siendo las mismas, pero comprobando que de `stock = N` salen exactamente N ventas.

## Tarea 2: Reserva de pieza — invariante de unicidad

**Archivos:**
- Crear: `src/pieces/pieces.service.ts`
- Prueba: `test/integration/piece-reservation.spec.ts`
- Modificar: `src/database/migrations/` — nueva migración `1755200000000-order-tables.ts`
- Crear: `src/orders/order.entity.ts`, `src/orders/order-item.entity.ts`

**Interfaces:**
- Consume: `Piece`, `User`, `testDb()`, `truncateAll()` de la Tarea 1.
- Produce: `PiecesService.reserve(pieceId: string, method: PaymentMethod): Promise<boolean>` — `true` si la ganó. `type PaymentMethod = 'CARD' | 'PSE' | 'NEQUI'`. Tablas `orders` y `order_items` con el índice único parcial sobre `piece_id`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/piece-reservation.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PiecesService } from '../../src/pieces/pieces.service';

describe('reserva de pieza', () => {
  let ds: DataSource;
  let svc: PiecesService;

  beforeAll(async () => { ds = await testDb(); svc = new PiecesService(ds); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function newPiece(status = 'available'): Promise<string> {
    const [row] = await ds.query(
      `INSERT INTO pieces (slug, title, price_cop, status) VALUES ($1,'P',500000,$2) RETURNING id`,
      [`p-${Math.random().toString(36).slice(2)}`, status],
    );
    return row.id;
  }

  it('una sola de diez compras concurrentes gana la pieza', async () => {
    const id = await newPiece();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => svc.reserve(id, 'CARD')),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const [piece] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [id]);
    expect(piece.status).toBe('reserved');
  });

  it('aplica TTL de 45 minutos para PSE y 15 para tarjeta', async () => {
    const pse = await newPiece();
    await svc.reserve(pse, 'PSE');
    const [a] = await ds.query(
      `SELECT EXTRACT(EPOCH FROM (reserved_until - now()))/60 AS mins FROM pieces WHERE id=$1`, [pse]);
    expect(Number(a.mins)).toBeGreaterThan(44);

    const card = await newPiece();
    await svc.reserve(card, 'CARD');
    const [b] = await ds.query(
      `SELECT EXTRACT(EPOCH FROM (reserved_until - now()))/60 AS mins FROM pieces WHERE id=$1`, [card]);
    expect(Number(b.mins)).toBeLessThan(16);
  });

  it('una reserva vencida se considera disponible, sin proceso de fondo', async () => {
    const id = await newPiece();
    await ds.query(
      `UPDATE pieces SET status='reserved', reserved_until = now() - interval '1 minute' WHERE id=$1`, [id]);
    await expect(svc.reserve(id, 'CARD')).resolves.toBe(true);
  });

  it('no reserva una pieza ya vendida', async () => {
    const id = await newPiece('sold');
    await expect(svc.reserve(id, 'CARD')).resolves.toBe(false);
  });

  it('no reserva una pieza en borrador', async () => {
    const id = await newPiece('draft');
    await expect(svc.reserve(id, 'CARD')).resolves.toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/piece-reservation.spec.ts`
Esperado: FALLA — `PiecesService` no existe.

- [ ] **Paso 3: Implementar el servicio**

`api/src/pieces/pieces.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type PaymentMethod = 'CARD' | 'PSE' | 'NEQUI';

export const RESERVATION_TTL_MINUTES: Record<PaymentMethod, number> = {
  CARD: 15,
  PSE: 45,
  NEQUI: 20,
};

@Injectable()
export class PiecesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Gana la pieza para el checkout en curso. Una reserva vencida se trata como
   * disponible en la misma consulta: la expiración es perezosa, no hay job.
   */
  async reserve(pieceId: string, method: PaymentMethod): Promise<boolean> {
    const result = await this.ds.query(
      `UPDATE pieces
          SET status = 'reserved',
              reserved_until = now() + make_interval(mins => $2)
        WHERE id = $1
          AND (status = 'available'
               OR (status = 'reserved' AND reserved_until < now()))
        RETURNING id`,
      [pieceId, RESERVATION_TTL_MINUTES[method]],
    );
    return result.length === 1;
  }
}
```

- [ ] **Paso 4: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/piece-reservation.spec.ts`
Esperado: PASA — 5 pruebas.

- [ ] **Paso 5: Migración de pedidos con el índice único parcial**

`api/src/database/migrations/1755200000000-order-tables.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderTables1755200000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE orders (
        id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              uuid NOT NULL REFERENCES users(id),
        status               text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','paid','failed','expired','refunded')),
        total_cop            integer NOT NULL CHECK (total_cop > 0),
        payment_method       text NOT NULL CHECK (payment_method IN ('CARD','PSE','NEQUI')),
        shipping_address     jsonb,
        wompi_transaction_id text UNIQUE,
        reference            text NOT NULL UNIQUE,
        created_at           timestamptz NOT NULL DEFAULT now(),
        paid_at              timestamptz
      )`);

    await q.query(`
      CREATE TABLE order_items (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id       uuid NOT NULL REFERENCES orders(id),
        piece_id       uuid REFERENCES pieces(id),
        drop_id        uuid,
        unit_price_cop integer NOT NULL CHECK (unit_price_cop > 0),
        CHECK (num_nonnulls(piece_id, drop_id) = 1)
      )`);

    // Hace imposible la doble venta, no solo improbable.
    await q.query(`
      CREATE UNIQUE INDEX uniq_order_item_piece
        ON order_items (piece_id) WHERE piece_id IS NOT NULL`);

    await q.query(`CREATE INDEX idx_orders_status_created ON orders (status, created_at)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE order_items`);
    await q.query(`DROP TABLE orders`);
  }
}
```

`api/src/orders/order.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentMethod } from '../pieces/pieces.service';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'text', default: 'pending' }) status!: OrderStatus;
  @Column({ type: 'int', name: 'total_cop' }) totalCop!: number;
  @Column({ type: 'text', name: 'payment_method' }) paymentMethod!: PaymentMethod;
  @Column({ type: 'jsonb', name: 'shipping_address', nullable: true }) shippingAddress!: Record<string, string> | null;
  @Column({ type: 'text', name: 'wompi_transaction_id', nullable: true }) wompiTransactionId!: string | null;
  @Column({ type: 'text' }) reference!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true }) paidAt!: Date | null;
}
```

`api/src/orders/order-item.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'order_id' }) orderId!: string;
  @Column({ type: 'uuid', name: 'piece_id', nullable: true }) pieceId!: string | null;
  @Column({ type: 'uuid', name: 'drop_id', nullable: true }) dropId!: string | null;
  @Column({ type: 'int', name: 'unit_price_cop' }) unitPriceCop!: number;
}
```

- [ ] **Paso 6: Probar que el índice único parcial bloquea la doble venta**

Añadir a `api/test/integration/piece-reservation.spec.ts`:

```ts
  it('la base rechaza dos order_items sobre la misma pieza', async () => {
    const pieceId = await newPiece();
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ('c@d.co') RETURNING id`);
    const mk = async () => {
      const [o] = await ds.query(
        `INSERT INTO orders (user_id, total_cop, payment_method, reference)
         VALUES ($1, 500000, 'CARD', $2) RETURNING id`,
        [u.id, `ref-${Math.random().toString(36).slice(2)}`],
      );
      return ds.query(
        `INSERT INTO order_items (order_id, piece_id, unit_price_cop) VALUES ($1,$2,500000)`,
        [o.id, pieceId],
      );
    };
    await mk();
    await expect(mk()).rejects.toThrow();
  });
```

Ejecutar: `npx jest test/integration/piece-reservation.spec.ts`
Esperado: PASA — 6 pruebas.

- [ ] **Paso 7: Commit**

```bash
git add api
git commit -m "feat(api): reserva de pieza con TTL por método y expiración perezosa"
```

---

## Tarea 3: Drops y aforo — invariante de capacidad

**Archivos:**
- Crear: `src/drops/drop.entity.ts`, `src/drops/entitlement.entity.ts`, `src/drops/drops.service.ts`
- Crear: `src/database/migrations/1755300000000-drops.ts`
- Prueba: `test/integration/drop-capacity.spec.ts`

**Interfaces:**
- Consume: `testDb()`, `truncateAll()`, tablas `users` y `orders` de tareas 1-2.
- Produce: `DropsService.grantEntitlement(manager: EntityManager, dropId: string, userId: string, orderId: string): Promise<string>` — devuelve el id del entitlement; lanza `ConflictException('SOLD_OUT')` si no hay cupo y `ConflictException('ALREADY_OWNED')` si ya lo tiene. Recibe un `EntityManager` porque siempre se ejecuta dentro de la transacción del pago.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/drop-capacity.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { DropsService } from '../../src/drops/drops.service';

describe('aforo de drops', () => {
  let ds: DataSource;
  let svc: DropsService;

  beforeAll(async () => { ds = await testDb(); svc = new DropsService(ds); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function newDrop(capacity: number | null): Promise<string> {
    const [d] = await ds.query(
      `INSERT INTO drops (slug, title, price_cop, video_asset_id, capacity, status)
       VALUES ($1,'D',4000,'vid',$2,'available') RETURNING id`,
      [`d-${Math.random().toString(36).slice(2)}`, capacity],
    );
    return d.id;
  }

  async function newUserWithOrder(): Promise<{ userId: string; orderId: string }> {
    const [u] = await ds.query(
      `INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`],
    );
    const [o] = await ds.query(
      `INSERT INTO orders (user_id, total_cop, payment_method, reference)
       VALUES ($1, 4000, 'CARD', $2) RETURNING id`,
      [u.id, `ref-${Math.random().toString(36).slice(2)}`],
    );
    return { userId: u.id, orderId: o.id };
  }

  const grant = (dropId: string, userId: string, orderId: string) =>
    ds.transaction((m) => svc.grantEntitlement(m, dropId, userId, orderId));

  it('emite exactamente `capacity` entitlements con 51 compras concurrentes', async () => {
    const dropId = await newDrop(50);
    const buyers = await Promise.all(Array.from({ length: 51 }, () => newUserWithOrder()));
    const results = await Promise.allSettled(
      buyers.map((b) => grant(dropId, b.userId, b.orderId)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(50);
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM entitlements WHERE drop_id=$1`, [dropId]);
    expect(count).toBe(50);
  });

  it('con capacity NULL no hay límite', async () => {
    const dropId = await newDrop(null);
    const buyers = await Promise.all(Array.from({ length: 20 }, () => newUserWithOrder()));
    const results = await Promise.allSettled(
      buyers.map((b) => grant(dropId, b.userId, b.orderId)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(20);
  });

  it('el mismo usuario no obtiene dos entitlements del mismo drop', async () => {
    const dropId = await newDrop(50);
    const b = await newUserWithOrder();
    await grant(dropId, b.userId, b.orderId);
    await expect(grant(dropId, b.userId, b.orderId)).rejects.toThrow(/ALREADY_OWNED/);
  });

  it('rechaza cuando el cupo está lleno', async () => {
    const dropId = await newDrop(1);
    const a = await newUserWithOrder();
    const b = await newUserWithOrder();
    await grant(dropId, a.userId, a.orderId);
    await expect(grant(dropId, b.userId, b.orderId)).rejects.toThrow(/SOLD_OUT/);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/drop-capacity.spec.ts`
Esperado: FALLA — la tabla `drops` no existe.

- [ ] **Paso 3: Migración**

`api/src/database/migrations/1755300000000-drops.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Drops1755300000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE drops (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug                text NOT NULL UNIQUE,
        title               text NOT NULL,
        description         text,
        price_cop           integer NOT NULL CHECK (price_cop > 0),
        video_asset_id      text NOT NULL,
        poster_image        text,
        capacity            integer CHECK (capacity IS NULL OR capacity > 0),
        view_window_hours   integer NOT NULL DEFAULT 24 CHECK (view_window_hours > 0),
        max_views_per_buyer integer NOT NULL DEFAULT 1 CHECK (max_views_per_buyer > 0),
        status              text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','available','closed','archived')),
        published_at        timestamptz
      )`);

    await q.query(`
      CREATE TABLE entitlements (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES users(id),
        drop_id         uuid NOT NULL REFERENCES drops(id),
        order_id        uuid NOT NULL REFERENCES orders(id),
        granted_at      timestamptz NOT NULL DEFAULT now(),
        first_played_at timestamptz,
        expires_at      timestamptz,
        views_used      integer NOT NULL DEFAULT 0,
        UNIQUE (user_id, drop_id)
      )`);

    await q.query(`ALTER TABLE order_items ADD CONSTRAINT fk_order_items_drop
                     FOREIGN KEY (drop_id) REFERENCES drops(id)`);
    await q.query(`CREATE INDEX idx_entitlements_drop ON entitlements (drop_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE order_items DROP CONSTRAINT fk_order_items_drop`);
    await q.query(`DROP TABLE entitlements`);
    await q.query(`DROP TABLE drops`);
  }
}
```

- [ ] **Paso 4: Implementar el servicio**

`api/src/drops/drop.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DropStatus = 'draft' | 'available' | 'closed' | 'archived';

@Entity('drops')
export class Drop {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'int', name: 'price_cop' }) priceCop!: number;
  @Column({ type: 'text', name: 'video_asset_id' }) videoAssetId!: string;
  @Column({ type: 'text', name: 'poster_image', nullable: true }) posterImage!: string | null;
  @Column({ type: 'int', nullable: true }) capacity!: number | null;
  @Column({ type: 'int', name: 'view_window_hours', default: 24 }) viewWindowHours!: number;
  @Column({ type: 'int', name: 'max_views_per_buyer', default: 1 }) maxViewsPerBuyer!: number;
  @Column({ type: 'text', default: 'draft' }) status!: DropStatus;
  @Column({ type: 'timestamptz', name: 'published_at', nullable: true }) publishedAt!: Date | null;
}
```

`api/src/drops/entitlement.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('entitlements')
export class Entitlement {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'drop_id' }) dropId!: string;
  @Column({ type: 'uuid', name: 'order_id' }) orderId!: string;
  @Column({ type: 'timestamptz', name: 'granted_at' }) grantedAt!: Date;
  @Column({ type: 'timestamptz', name: 'first_played_at', nullable: true }) firstPlayedAt!: Date | null;
  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true }) expiresAt!: Date | null;
  @Column({ type: 'int', name: 'views_used', default: 0 }) viewsUsed!: number;
}
```

`api/src/drops/drops.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class DropsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Emite el derecho de visionado. Debe llamarse dentro de la transacción que
   * liquida el pago: el bloqueo de fila del drop es lo que serializa a los
   * compradores y hace imposible superar el aforo.
   */
  async grantEntitlement(
    m: EntityManager,
    dropId: string,
    userId: string,
    orderId: string,
  ): Promise<string> {
    const [drop] = await m.query(
      `SELECT id, capacity FROM drops WHERE id = $1 FOR UPDATE`,
      [dropId],
    );
    if (!drop) throw new NotFoundException('DROP_NOT_FOUND');

    if (drop.capacity !== null) {
      const [{ count }] = await m.query(
        `SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`,
        [dropId],
      );
      if (count >= drop.capacity) throw new ConflictException('SOLD_OUT');
    }

    const rows = await m.query(
      `INSERT INTO entitlements (user_id, drop_id, order_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, drop_id) DO NOTHING
       RETURNING id`,
      [userId, dropId, orderId],
    );
    if (rows.length === 0) throw new ConflictException('ALREADY_OWNED');
    return rows[0].id;
  }
}
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/drop-capacity.spec.ts`
Esperado: PASA — 4 pruebas. La primera tarda unos segundos: 51 transacciones se serializan sobre la fila del drop.

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): drops con aforo configurable garantizado por bloqueo de fila"
```

---

## Tarea 4: Idempotencia de escritura

**Archivos:**
- Crear: `src/common/idempotency/idempotency-key.entity.ts`, `src/common/idempotency/idempotency.interceptor.ts`
- Crear: `src/database/migrations/1755400000000-idempotency.ts`
- Prueba: `test/integration/idempotency.spec.ts`

**Interfaces:**
- Consume: `testDb()`, `truncateAll()`.
- Produce: `IdempotencyInterceptor` aplicable con `@UseInterceptors(IdempotencyInterceptor)`. Exige el encabezado `Idempotency-Key`; responde `400` si falta, `409` si la clave se reutiliza con otro cuerpo o si hay una petición en curso, y repite la respuesta original si el cuerpo coincide.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/idempotency.spec.ts`:

```ts
import { INestApplication, Body, Controller, Post, UseInterceptors, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { IdempotencyInterceptor } from '../../src/common/idempotency/idempotency.interceptor';

let counter = 0;

@Controller('demo')
class DemoController {
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  create(@Body() body: { value: string }) {
    counter += 1;
    return { id: `created-${counter}`, echo: body.value };
  }
}

describe('idempotencia', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    ds = await testDb();
    @Module({
      imports: [TypeOrmModule.forRoot({ ...(ds.options as any), autoLoadEntities: true })],
      controllers: [DemoController],
    })
    class TestModule {}
    const mod = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  beforeEach(async () => { await truncateAll(ds); counter = 0; });
  afterAll(async () => { await app.close(); await ds.destroy(); });

  it('exige el encabezado Idempotency-Key', async () => {
    await request(app.getHttpServer()).post('/demo').send({ value: 'a' }).expect(400);
  });

  it('la misma clave con el mismo cuerpo devuelve la respuesta original', async () => {
    const key = 'k-1';
    const first = await request(app.getHttpServer())
      .post('/demo').set('Idempotency-Key', key).send({ value: 'a' }).expect(201);
    const second = await request(app.getHttpServer())
      .post('/demo').set('Idempotency-Key', key).send({ value: 'a' }).expect(201);
    expect(second.body).toEqual(first.body);
    expect(counter).toBe(1);
  });

  it('la misma clave con otro cuerpo responde 409', async () => {
    const key = 'k-2';
    await request(app.getHttpServer())
      .post('/demo').set('Idempotency-Key', key).send({ value: 'a' }).expect(201);
    await request(app.getHttpServer())
      .post('/demo').set('Idempotency-Key', key).send({ value: 'b' }).expect(409);
  });

  it('dos peticiones concurrentes con la misma clave ejecutan el efecto una vez', async () => {
    const key = 'k-3';
    const send = () => request(app.getHttpServer())
      .post('/demo').set('Idempotency-Key', key).send({ value: 'a' });
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(counter).toBe(1);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/idempotency.spec.ts`
Esperado: FALLA — `IdempotencyInterceptor` no existe.

- [ ] **Paso 3: Migración**

`api/src/database/migrations/1755400000000-idempotency.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Idempotency1755400000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE idempotency_keys (
        key           text PRIMARY KEY,
        user_id       uuid REFERENCES users(id),
        endpoint      text NOT NULL,
        request_hash  text NOT NULL,
        response_body jsonb,
        status_code   integer,
        created_at    timestamptz NOT NULL DEFAULT now()
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE idempotency_keys`);
  }
}
```

- [ ] **Paso 4: Implementar el interceptor**

`api/src/common/idempotency/idempotency-key.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'text' }) key!: string;
  @Column({ type: 'uuid', name: 'user_id', nullable: true }) userId!: string | null;
  @Column({ type: 'text' }) endpoint!: string;
  @Column({ type: 'text', name: 'request_hash' }) requestHash!: string;
  @Column({ type: 'jsonb', name: 'response_body', nullable: true }) responseBody!: unknown;
  @Column({ type: 'int', name: 'status_code', nullable: true }) statusCode!: number | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}
```

`api/src/common/idempotency/idempotency.interceptor.ts`:

```ts
import {
  BadRequestException, CallHandler, ConflictException, ExecutionContext,
  Injectable, NestInterceptor,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const key: string | undefined = req.headers['idempotency-key'];
    if (!key) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');

    const endpoint = `${req.method} ${req.route?.path ?? req.url}`;
    const hash = createHash('sha256')
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');
    const userId = req.user?.id ?? null;

    return from(this.claim(key, userId, endpoint, hash)).pipe(
      switchMap((existing) => {
        // Reclamamos la clave. Si ya existía, no ejecutamos el handler.
        if (existing) {
          if (existing.request_hash !== hash) throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
          if (existing.response_body === null) throw new ConflictException('REQUEST_IN_PROGRESS');
          return of(existing.response_body);
        }
        return next.handle().pipe(
          tap({
            next: async (body) => {
              await this.ds.query(
                `UPDATE idempotency_keys SET response_body=$2, status_code=201 WHERE key=$1`,
                [key, JSON.stringify(body ?? {})],
              );
            },
            error: async () => {
              // El handler falló: liberamos la clave para que se pueda reintentar.
              await this.ds.query(`DELETE FROM idempotency_keys WHERE key=$1`, [key]);
            },
          }),
        );
      }),
    );
  }

  /** Inserta la clave; devuelve la fila existente si otro la reclamó antes. */
  private async claim(key: string, userId: string | null, endpoint: string, hash: string) {
    const inserted = await this.ds.query(
      `INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash)
       VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING RETURNING key`,
      [key, userId, endpoint, hash],
    );
    if (inserted.length === 1) return null;
    const [row] = await this.ds.query(`SELECT * FROM idempotency_keys WHERE key=$1`, [key]);
    return row;
  }
}
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/idempotency.spec.ts`
Esperado: PASA — 4 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): interceptor de idempotencia para endpoints de escritura"
```

---

## Tarea 5: Sesión por magic link y OTP

**Archivos:**
- Crear: `src/auth/magic-link.entity.ts`, `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/auth/session.guard.ts`
- Crear: `src/otp/otp-challenge.entity.ts`, `src/otp/otp.service.ts`
- Crear: `src/mail/mail.service.ts`
- Crear: `src/database/migrations/1755500000000-auth.ts`
- Prueba: `test/integration/auth.spec.ts`

**Interfaces:**
- Consume: `User`, `testDb()`, `truncateAll()`.
- Produce: `AuthService.requestMagicLink(email: string): Promise<void>`; `AuthService.redeem(token: string): Promise<{ userId: string; sessionToken: string }>`; `SessionGuard` que pone `req.user = { id }`; `OtpService.issue(userId: string, purpose: 'CONTRACT_SIGNATURE'): Promise<string>` devuelve el id del reto; `OtpService.verify(challengeId: string, code: string): Promise<boolean>`; `MailService.send(to: string, subject: string, html: string, dedupeKey: string): Promise<void>`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/auth.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { AuthService } from '../../src/auth/auth.service';
import { OtpService } from '../../src/otp/otp.service';
import { MailService } from '../../src/mail/mail.service';

class FakeMail implements Pick<MailService, 'send'> {
  sent: { to: string; html: string }[] = [];
  async send(to: string, _s: string, html: string) { this.sent.push({ to, html }); }
}

describe('autenticación', () => {
  let ds: DataSource;
  let auth: AuthService;
  let otp: OtpService;
  let mail: FakeMail;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    auth = new AuthService(ds, mail as unknown as MailService, 'http://web.test', 'secreto-de-al-menos-32-caracteres!!');
    otp = new OtpService(ds, mail as unknown as MailService);
  });
  beforeEach(async () => { await truncateAll(ds); mail.sent = []; });
  afterAll(async () => { await ds.destroy(); });

  it('crea el usuario si no existe y envía el enlace', async () => {
    await auth.requestMagicLink('nuevo@x.co');
    const [u] = await ds.query(`SELECT id FROM users WHERE email='nuevo@x.co'`);
    expect(u).toBeDefined();
    expect(mail.sent).toHaveLength(1);
  });

  it('canjea el token una sola vez', async () => {
    await auth.requestMagicLink('a@x.co');
    const [link] = await ds.query(`SELECT token FROM magic_links LIMIT 1`);
    const session = await auth.redeem(link.token);
    expect(session.sessionToken).toBeTruthy();
    await expect(auth.redeem(link.token)).rejects.toThrow(/INVALID_OR_USED/);
  });

  it('rechaza un token vencido', async () => {
    await auth.requestMagicLink('b@x.co');
    await ds.query(`UPDATE magic_links SET expires_at = now() - interval '1 minute'`);
    const [link] = await ds.query(`SELECT token FROM magic_links LIMIT 1`);
    await expect(auth.redeem(link.token)).rejects.toThrow(/INVALID_OR_USED/);
  });

  it('verifica el OTP correcto y lo invalida tras usarlo', async () => {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ('c@x.co') RETURNING id`);
    const challengeId = await otp.issue(u.id, 'CONTRACT_SIGNATURE');
    const code = mail.sent[0].html.match(/\b(\d{6})\b/)![1];
    await expect(otp.verify(challengeId, code)).resolves.toBe(true);
    await expect(otp.verify(challengeId, code)).resolves.toBe(false);
  });

  it('rechaza el OTP tras cinco intentos fallidos', async () => {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ('d@x.co') RETURNING id`);
    const challengeId = await otp.issue(u.id, 'CONTRACT_SIGNATURE');
    for (let i = 0; i < 5; i++) await otp.verify(challengeId, '000000');
    const code = mail.sent[0].html.match(/\b(\d{6})\b/)![1];
    await expect(otp.verify(challengeId, code)).resolves.toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/auth.spec.ts`
Esperado: FALLA — `AuthService` no existe.

- [ ] **Paso 3: Migración**

`api/src/database/migrations/1755500000000-auth.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auth1755500000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE magic_links (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id),
        token      text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at    timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE otp_challenges (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid NOT NULL REFERENCES users(id),
        purpose      text NOT NULL CHECK (purpose IN ('CONTRACT_SIGNATURE')),
        code_hash    text NOT NULL,
        attempts     integer NOT NULL DEFAULT 0,
        expires_at   timestamptz NOT NULL,
        verified_at  timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now()
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE otp_challenges`);
    await q.query(`DROP TABLE magic_links`);
  }
}
```

- [ ] **Paso 4: Implementar correo, auth y OTP**

`api/src/mail/mail.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly sentKeys = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  /**
   * `dedupeKey` evita el correo duplicado cuando Wompi reintenta un webhook.
   * lazy: deduplicación en memoria; mover a tabla si la API corre en varias instancias.
   */
  async send(to: string, subject: string, html: string, dedupeKey?: string): Promise<void> {
    if (dedupeKey && this.sentKeys.has(dedupeKey)) return;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: 'no-reply@toryteler.com', to, subject, html }),
    });
    if (!res.ok) throw new Error(`RESEND_FAILED_${res.status}`);
    if (dedupeKey) this.sentKeys.add(dedupeKey);
  }
}
```

`api/src/auth/auth.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly mail: MailService,
    private readonly webUrl: string,
    private readonly sessionSecret: string,
  ) {}

  async requestMagicLink(email: string): Promise<void> {
    const [user] = await this.ds.query(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email],
    );
    const token = randomBytes(32).toString('hex');
    await this.ds.query(
      `INSERT INTO magic_links (user_id, token, expires_at)
       VALUES ($1, $2, now() + interval '20 minutes')`,
      [user.id, token],
    );
    const url = `${this.webUrl}/auth/verify?token=${token}`;
    await this.mail.send(email, 'Tu acceso', `<p><a href="${url}">Entrar</a></p>`);
  }

  async redeem(token: string): Promise<{ userId: string; sessionToken: string }> {
    const rows = await this.ds.query(
      `UPDATE magic_links SET used_at = now()
        WHERE token = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [token],
    );
    if (rows.length === 0) throw new UnauthorizedException('INVALID_OR_USED');
    const userId = rows[0].user_id;
    return { userId, sessionToken: this.signSession(userId) };
  }

  signSession(userId: string): string {
    const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64url');
    const sig = createHmac('sha256', this.sessionSecret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  verifySession(value: string): string | null {
    const [payload, sig] = value.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', this.sessionSecret).update(payload).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).sub;
  }
}
```

`api/src/otp/otp.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly mail: MailService,
  ) {}

  async issue(userId: string, purpose: 'CONTRACT_SIGNATURE'): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [row] = await this.ds.query(
      `INSERT INTO otp_challenges (user_id, purpose, code_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes') RETURNING id`,
      [userId, purpose, this.hash(code)],
    );
    const [user] = await this.ds.query(`SELECT email FROM users WHERE id=$1`, [userId]);
    await this.mail.send(user.email, 'Código de firma', `<p>Tu código: <b>${code}</b></p>`);
    return row.id;
  }

  /** Consume el reto: un código solo sirve una vez, y solo dentro de 5 intentos. */
  async verify(challengeId: string, code: string): Promise<boolean> {
    const rows = await this.ds.query(
      `UPDATE otp_challenges
          SET verified_at = now()
        WHERE id = $1
          AND verified_at IS NULL
          AND expires_at > now()
          AND attempts < $3
          AND code_hash = $2
        RETURNING id`,
      [challengeId, this.hash(code), MAX_ATTEMPTS],
    );
    if (rows.length === 1) return true;
    await this.ds.query(
      `UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1 AND verified_at IS NULL`,
      [challengeId],
    );
    return false;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
```

`api/src/auth/session.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const raw = req.cookies?.session ?? req.headers['authorization']?.replace('Bearer ', '');
    const userId = raw ? this.auth.verifySession(raw) : null;
    if (!userId) throw new UnauthorizedException('NO_SESSION');
    req.user = { id: userId };
    return true;
  }
}
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/auth.spec.ts`
Esperado: PASA — 5 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): sesión por magic link y retos OTP para la firma"
```

---

## Tarea 6: Crear pedido

**Archivos:**
- Crear: `src/orders/orders.service.ts`, `src/orders/orders.controller.ts`, `src/orders/dto/create-order.dto.ts`
- Prueba: `test/integration/create-order.spec.ts`

**Interfaces:**
- Consume: `PiecesService.reserve()`, `PaymentMethod`, `IdempotencyInterceptor`, `SessionGuard`.
- Produce: `OrdersService.create(userId: string, dto: CreateOrderDto): Promise<{ id: string; reference: string; totalCop: number }>`. `CreateOrderDto = { pieceIds: string[]; dropIds: string[]; paymentMethod: PaymentMethod; shippingAddress?: Record<string,string> }`. Endpoint `POST /orders`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/create-order.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { OrdersService } from '../../src/orders/orders.service';
import { PiecesService } from '../../src/pieces/pieces.service';

describe('creación de pedido', () => {
  let ds: DataSource;
  let orders: OrdersService;

  beforeAll(async () => {
    ds = await testDb();
    orders = new OrdersService(ds, new PiecesService(ds));
  });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  const newUser = async () => {
    const [u] = await ds.query(
      `INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    return u.id;
  };
  const newPiece = async (price = 500000) => {
    const [p] = await ds.query(
      `INSERT INTO pieces (slug,title,price_cop,status) VALUES ($1,'P',$2,'available') RETURNING id`,
      [`p-${Math.random().toString(36).slice(2)}`, price]);
    return p.id;
  };
  const newDrop = async (price = 15000) => {
    const [d] = await ds.query(
      `INSERT INTO drops (slug,title,price_cop,video_asset_id,capacity,status)
       VALUES ($1,'D',$2,'vid',50,'available') RETURNING id`,
      [`d-${Math.random().toString(36).slice(2)}`, price]);
    return d.id;
  };

  it('suma el total desde los precios de la base, no del cliente', async () => {
    const userId = await newUser();
    const order = await orders.create(userId, {
      pieceIds: [await newPiece(500000)],
      dropIds: [await newDrop(15000)],
      paymentMethod: 'CARD',
      shippingAddress: { line1: 'Calle 1', city: 'Medellín' },
    });
    expect(order.totalCop).toBe(515000);
    expect(order.reference).toMatch(/^ord_/);
  });

  it('reserva la pieza al crear el pedido', async () => {
    const pieceId = await newPiece();
    await orders.create(await newUser(), {
      pieceIds: [pieceId], dropIds: [], paymentMethod: 'CARD',
      shippingAddress: { line1: 'x', city: 'y' },
    });
    const [p] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [pieceId]);
    expect(p.status).toBe('reserved');
  });

  it('rechaza el pedido si la pieza ya está reservada por otro', async () => {
    const pieceId = await newPiece();
    await orders.create(await newUser(), {
      pieceIds: [pieceId], dropIds: [], paymentMethod: 'CARD',
      shippingAddress: { line1: 'x', city: 'y' },
    });
    await expect(orders.create(await newUser(), {
      pieceIds: [pieceId], dropIds: [], paymentMethod: 'CARD',
      shippingAddress: { line1: 'x', city: 'y' },
    })).rejects.toThrow(/PIECE_UNAVAILABLE/);
  });

  it('exige dirección de envío cuando hay pieza física', async () => {
    await expect(orders.create(await newUser(), {
      pieceIds: [await newPiece()], dropIds: [], paymentMethod: 'CARD',
    })).rejects.toThrow(/SHIPPING_REQUIRED/);
  });

  it('no exige dirección para un pedido solo digital', async () => {
    const order = await orders.create(await newUser(), {
      pieceIds: [], dropIds: [await newDrop()], paymentMethod: 'CARD',
    });
    expect(order.totalCop).toBe(15000);
  });

  it('rechaza un pedido vacío', async () => {
    await expect(orders.create(await newUser(), {
      pieceIds: [], dropIds: [], paymentMethod: 'CARD',
    })).rejects.toThrow(/EMPTY_ORDER/);
  });

  it('libera la reserva si falla una pieza posterior del mismo pedido', async () => {
    const ok = await newPiece();
    const taken = await newPiece();
    await orders.create(await newUser(), {
      pieceIds: [taken], dropIds: [], paymentMethod: 'CARD',
      shippingAddress: { line1: 'x', city: 'y' },
    });
    await expect(orders.create(await newUser(), {
      pieceIds: [ok, taken], dropIds: [], paymentMethod: 'CARD',
      shippingAddress: { line1: 'x', city: 'y' },
    })).rejects.toThrow(/PIECE_UNAVAILABLE/);
    const [p] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [ok]);
    expect(p.status).toBe('available');
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/create-order.spec.ts`
Esperado: FALLA — `OrdersService` no existe.

- [ ] **Paso 3: Implementar el DTO y el servicio**

`api/src/orders/dto/create-order.dto.ts`:

```ts
import { PaymentMethod } from '../../pieces/pieces.service';

export interface CreateOrderDto {
  pieceIds: string[];
  dropIds: string[];
  paymentMethod: PaymentMethod;
  shippingAddress?: Record<string, string>;
}
```

`api/src/orders/orders.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { PiecesService } from '../pieces/pieces.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly pieces: PiecesService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    if (dto.pieceIds.length === 0 && dto.dropIds.length === 0) {
      throw new BadRequestException('EMPTY_ORDER');
    }
    if (dto.pieceIds.length > 0 && !dto.shippingAddress) {
      throw new BadRequestException('SHIPPING_REQUIRED');
    }

    const reserved: string[] = [];
    try {
      for (const pieceId of dto.pieceIds) {
        const won = await this.pieces.reserve(pieceId, dto.paymentMethod);
        if (!won) throw new ConflictException('PIECE_UNAVAILABLE');
        reserved.push(pieceId);
      }

      // Los precios se leen de la base: el cliente nunca los envía.
      const pieceRows = dto.pieceIds.length
        ? await this.ds.query(`SELECT id, price_cop FROM pieces WHERE id = ANY($1)`, [dto.pieceIds])
        : [];
      const dropRows = dto.dropIds.length
        ? await this.ds.query(
            `SELECT id, price_cop FROM drops WHERE id = ANY($1) AND status='available'`,
            [dto.dropIds])
        : [];
      if (dropRows.length !== dto.dropIds.length) throw new ConflictException('DROP_UNAVAILABLE');

      const items = [
        ...pieceRows.map((r: any) => ({ pieceId: r.id, dropId: null, price: r.price_cop })),
        ...dropRows.map((r: any) => ({ pieceId: null, dropId: r.id, price: r.price_cop })),
      ];
      const totalCop = items.reduce((sum, i) => sum + i.price, 0);
      const reference = `ord_${randomBytes(12).toString('hex')}`;

      return await this.ds.transaction(async (m) => {
        const [order] = await m.query(
          `INSERT INTO orders (user_id, total_cop, payment_method, shipping_address, reference)
           VALUES ($1,$2,$3,$4,$5) RETURNING id, reference, total_cop`,
          [userId, totalCop, dto.paymentMethod, dto.shippingAddress ?? null, reference],
        );
        for (const item of items) {
          await m.query(
            `INSERT INTO order_items (order_id, piece_id, drop_id, unit_price_cop)
             VALUES ($1,$2,$3,$4)`,
            [order.id, item.pieceId, item.dropId, item.price],
          );
        }
        return { id: order.id, reference: order.reference, totalCop: order.total_cop };
      });
    } catch (err) {
      // Nada de lo reservado en este intento debe quedar bloqueado.
      if (reserved.length > 0) {
        await this.ds.query(
          `UPDATE pieces SET status='available', reserved_until=NULL
            WHERE id = ANY($1) AND status='reserved'`,
          [reserved],
        );
      }
      throw err;
    }
  }
}
```

`api/src/orders/orders.controller.ts`:

```ts
import { Body, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(SessionGuard)
  @UseInterceptors(IdempotencyInterceptor)
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.id, dto);
  }
}
```

- [ ] **Paso 4: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/create-order.spec.ts`
Esperado: PASA — 7 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add api
git commit -m "feat(api): creación de pedido con reserva y precios leídos de la base"
```

---

## Tarea 7: Contrato en PDF, firma y acta de evidencias

**Archivos:**
- Crear: `src/storage/cloudinary.service.ts`, `src/contracts/contract.entity.ts`, `src/contracts/contract-pdf.service.ts`, `src/contracts/contracts.service.ts`, `src/contracts/contracts.controller.ts`
- Crear: `src/database/migrations/1755600000000-contracts.ts`
- Prueba: `test/integration/contract-signing.spec.ts`

**Interfaces:**
- Consume: `OrdersService`, `OtpService`, `User`.
- Produce: `ContractsService.prepare(orderId: string, signer: SignerData): Promise<{ contractId: string; pdfUrl: string; documentHash: string; otpChallengeId: string }>` y `ContractsService.sign(contractId: string, input: SignInput): Promise<void>`. `SignerData = { fullName: string; documentId: string; phone: string }`. `SignInput = { otpChallengeId: string; code: string; consentTextVersion: string; ip: string; userAgent: string; scrolledToEnd: boolean }`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/contract-signing.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { testDb, truncateAll } from '../setup/db';
import { ContractsService } from '../../src/contracts/contracts.service';
import { ContractPdfService } from '../../src/contracts/contract-pdf.service';
import { OtpService } from '../../src/otp/otp.service';
import { MailService } from '../../src/mail/mail.service';
import { CloudinaryService } from '../../src/storage/cloudinary.service';

class FakeMail { sent: { html: string }[] = []; async send(_t: string, _s: string, html: string) { this.sent.push({ html }); } }
class FakeStorage { async uploadPdf(buf: Buffer, name: string) { return `https://fake/${name}.pdf`; } }

describe('firma del contrato', () => {
  let ds: DataSource;
  let contracts: ContractsService;
  let mail: FakeMail;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    contracts = new ContractsService(
      ds,
      new ContractPdfService(),
      new OtpService(ds, mail as unknown as MailService),
      new FakeStorage() as unknown as CloudinaryService,
    );
  });
  beforeEach(async () => { await truncateAll(ds); mail.sent = []; });
  afterAll(async () => { await ds.destroy(); });

  async function orderWithPiece() {
    const [u] = await ds.query(
      `INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    const [p] = await ds.query(
      `INSERT INTO pieces (slug,title,price_cop,status) VALUES ($1,'Chaqueta',500000,'reserved') RETURNING id`,
      [`p-${Math.random().toString(36).slice(2)}`]);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference)
       VALUES ($1,500000,'CARD',$2) RETURNING id`,
      [u.id, `ord_${Math.random().toString(36).slice(2)}`]);
    await ds.query(
      `INSERT INTO order_items (order_id,piece_id,unit_price_cop) VALUES ($1,$2,500000)`,
      [o.id, p.id]);
    return { userId: u.id, orderId: o.id, pieceId: p.id };
  }

  const signer = { fullName: 'Ana Ruiz', documentId: '1017234567', phone: '3001234567' };

  it('genera un PDF y guarda su hash', async () => {
    const { orderId } = await orderWithPiece();
    const prepared = await contracts.prepare(orderId, signer);
    expect(prepared.pdfUrl).toContain('.pdf');
    expect(prepared.documentHash).toMatch(/^[a-f0-9]{64}$/);
    const [c] = await ds.query(`SELECT status FROM contracts WHERE id=$1`, [prepared.contractId]);
    expect(c.status).toBe('draft');
  });

  it('guarda la cédula del firmante en el usuario', async () => {
    const { orderId, userId } = await orderWithPiece();
    await contracts.prepare(orderId, signer);
    const [u] = await ds.query(`SELECT document_id, full_name FROM users WHERE id=$1`, [userId]);
    expect(u.document_id).toBe('1017234567');
    expect(u.full_name).toBe('Ana Ruiz');
  });

  it('firma con OTP válido y registra el acta completa', async () => {
    const { orderId } = await orderWithPiece();
    const p = await contracts.prepare(orderId, signer);
    const code = mail.sent[0].html.match(/\b(\d{6})\b/)![1];
    await contracts.sign(p.contractId, {
      otpChallengeId: p.otpChallengeId, code, consentTextVersion: 'v1',
      ip: '190.1.2.3', userAgent: 'jest', scrolledToEnd: true,
    });
    const [c] = await ds.query(`SELECT status, evidence, signed_at FROM contracts WHERE id=$1`, [p.contractId]);
    expect(c.status).toBe('signed_pending_payment');
    expect(c.signed_at).not.toBeNull();
    expect(c.evidence.document_hash).toBe(p.documentHash);
    expect(c.evidence.signer.document_id).toBe('1017234567');
    expect(c.evidence.consent_text_version).toBe('v1');
    expect(c.evidence.ip).toBe('190.1.2.3');
    expect(c.evidence.document_scrolled_to_end).toBe(true);
  });

  it('rechaza la firma con OTP incorrecto', async () => {
    const { orderId } = await orderWithPiece();
    const p = await contracts.prepare(orderId, signer);
    await expect(contracts.sign(p.contractId, {
      otpChallengeId: p.otpChallengeId, code: '000000', consentTextVersion: 'v1',
      ip: '1.1.1.1', userAgent: 'jest', scrolledToEnd: true,
    })).rejects.toThrow(/INVALID_OTP/);
    const [c] = await ds.query(`SELECT status FROM contracts WHERE id=$1`, [p.contractId]);
    expect(c.status).toBe('draft');
  });

  it('rechaza la firma si no leyó el documento completo', async () => {
    const { orderId } = await orderWithPiece();
    const p = await contracts.prepare(orderId, signer);
    const code = mail.sent[0].html.match(/\b(\d{6})\b/)![1];
    await expect(contracts.sign(p.contractId, {
      otpChallengeId: p.otpChallengeId, code, consentTextVersion: 'v1',
      ip: '1.1.1.1', userAgent: 'jest', scrolledToEnd: false,
    })).rejects.toThrow(/DOCUMENT_NOT_READ/);
  });

  it('no genera dos contratos para el mismo pedido y pieza', async () => {
    const { orderId } = await orderWithPiece();
    const a = await contracts.prepare(orderId, signer);
    const b = await contracts.prepare(orderId, signer);
    expect(b.contractId).toBe(a.contractId);
    const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM contracts`);
    expect(count).toBe(1);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/contract-signing.spec.ts`
Esperado: FALLA — `ContractsService` no existe.

- [ ] **Paso 3: Instalar dependencias y escribir la migración**

```bash
cd api && npm i pdf-lib cloudinary
```

`api/src/database/migrations/1755600000000-contracts.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Contracts1755600000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE contracts (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      uuid NOT NULL REFERENCES orders(id),
        piece_id      uuid NOT NULL REFERENCES pieces(id),
        pdf_url       text NOT NULL,
        document_hash text NOT NULL,
        status        text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','signed_pending_payment','executed','void')),
        signed_at     timestamptz,
        evidence      jsonb,
        created_at    timestamptz NOT NULL DEFAULT now(),
        UNIQUE (order_id, piece_id),
        CHECK (status = 'draft' OR (signed_at IS NOT NULL AND evidence IS NOT NULL))
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE contracts`);
  }
}
```

El `CHECK` final impide que exista un contrato firmado sin acta de evidencias: la trazabilidad legal la garantiza la base, no la disciplina del programador.

- [ ] **Paso 4: Implementar generación de PDF, almacenamiento y firma**

`api/src/storage/cloudinary.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadPdf(buffer: Buffer, publicId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', public_id: `contracts/${publicId}`, format: 'pdf' },
        (err, res) => (err || !res ? reject(err) : resolve(res.secure_url)),
      );
      stream.end(buffer);
    });
  }
}
```

`api/src/contracts/contract-pdf.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface ContractData {
  reference: string;
  pieceTitle: string;
  pieceDescription: string;
  priceCop: number;
  buyerName: string;
  buyerDocument: string;
  buyerEmail: string;
  consentTextVersion: string;
}

@Injectable()
export class ContractPdfService {
  async render(data: ContractData): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]); // A4
    const money = new Intl.NumberFormat('es-CO').format(data.priceCop);

    const lines = [
      'CONTRATO DE COMPRAVENTA DE BIEN MUEBLE ÚNICO',
      '',
      `Referencia: ${data.reference}`,
      '',
      `COMPRADOR: ${data.buyerName}, identificado con cédula ${data.buyerDocument},`,
      `correo ${data.buyerEmail}.`,
      '',
      `OBJETO: ${data.pieceTitle}.`,
      `${data.pieceDescription}`,
      '',
      `PRECIO: $${money} COP, pagaderos en su totalidad al momento de la compra.`,
      '',
      'El VENDEDOR declara que la pieza es única, auténtica y de su propiedad.',
      'El COMPRADOR declara conocer su estado y aceptarlo.',
      'La entrega se realizará a la dirección registrada en el pedido.',
      '',
      `Versión del texto de consentimiento: ${data.consentTextVersion}`,
      '',
      'Este documento se firma electrónicamente conforme a la Ley 527 de 1999',
      'y al Decreto 2364 de 2012.',
    ];

    let y = 780;
    for (const line of lines) {
      page.drawText(line, { x: 50, y, size: line.startsWith('CONTRATO') ? 13 : 10, font });
      y -= 20;
    }
    return Buffer.from(await pdf.save());
  }

  /** Estampa la constancia de firma sobre el PDF ya firmado. */
  async seal(original: Buffer, hash: string, signedAt: Date): Promise<Buffer> {
    const pdf = await PDFDocument.load(original);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    const stamp = [
      'CONSTANCIA DE FIRMA ELECTRÓNICA',
      '',
      `Fecha de firma: ${signedAt.toISOString()}`,
      `Huella del documento (SHA-256): ${hash}`,
      '',
      'La integridad del documento puede verificarse recalculando esta huella.',
    ];
    let y = 780;
    for (const line of stamp) {
      page.drawText(line, { x: 50, y, size: 10, font });
      y -= 20;
    }
    return Buffer.from(await pdf.save());
  }
}
```

`api/src/contracts/contracts.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { OtpService } from '../otp/otp.service';
import { CloudinaryService } from '../storage/cloudinary.service';
import { ContractPdfService } from './contract-pdf.service';

export interface SignerData { fullName: string; documentId: string; phone: string }
export interface SignInput {
  otpChallengeId: string;
  code: string;
  consentTextVersion: string;
  ip: string;
  userAgent: string;
  scrolledToEnd: boolean;
}

@Injectable()
export class ContractsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly pdf: ContractPdfService,
    private readonly otp: OtpService,
    private readonly storage: CloudinaryService,
  ) {}

  async prepare(orderId: string, signer: SignerData) {
    const [row] = await this.ds.query(
      `SELECT o.id AS order_id, o.reference, o.user_id, u.email,
              p.id AS piece_id, p.title, coalesce(p.description,'') AS description, oi.unit_price_cop
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.piece_id IS NOT NULL
         JOIN pieces p ON p.id = oi.piece_id
         JOIN users u ON u.id = o.user_id
        WHERE o.id = $1`,
      [orderId],
    );
    if (!row) throw new NotFoundException('NO_PHYSICAL_ITEM');

    await this.ds.query(
      `UPDATE users SET full_name=$2, document_id=$3, phone=$4 WHERE id=$1`,
      [row.user_id, signer.fullName, signer.documentId, signer.phone],
    );

    const existing = await this.ds.query(
      `SELECT id, pdf_url, document_hash FROM contracts WHERE order_id=$1 AND piece_id=$2`,
      [orderId, row.piece_id],
    );
    if (existing.length === 1) {
      const challengeId = await this.otp.issue(row.user_id, 'CONTRACT_SIGNATURE');
      return {
        contractId: existing[0].id,
        pdfUrl: existing[0].pdf_url,
        documentHash: existing[0].document_hash,
        otpChallengeId: challengeId,
      };
    }

    const buffer = await this.pdf.render({
      reference: row.reference,
      pieceTitle: row.title,
      pieceDescription: row.description,
      priceCop: row.unit_price_cop,
      buyerName: signer.fullName,
      buyerDocument: signer.documentId,
      buyerEmail: row.email,
      consentTextVersion: 'v1',
    });
    const documentHash = createHash('sha256').update(buffer).digest('hex');
    const pdfUrl = await this.storage.uploadPdf(buffer, `${row.reference}-${row.piece_id}`);

    const [contract] = await this.ds.query(
      `INSERT INTO contracts (order_id, piece_id, pdf_url, document_hash)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [orderId, row.piece_id, pdfUrl, documentHash],
    );
    const otpChallengeId = await this.otp.issue(row.user_id, 'CONTRACT_SIGNATURE');
    return { contractId: contract.id, pdfUrl, documentHash, otpChallengeId };
  }

  async sign(contractId: string, input: SignInput): Promise<void> {
    if (!input.scrolledToEnd) throw new BadRequestException('DOCUMENT_NOT_READ');

    const [contract] = await this.ds.query(
      `SELECT c.id, c.document_hash, c.pdf_url, u.full_name, u.document_id, u.email
         FROM contracts c JOIN orders o ON o.id=c.order_id JOIN users u ON u.id=o.user_id
        WHERE c.id=$1 AND c.status='draft'`,
      [contractId],
    );
    if (!contract) throw new NotFoundException('CONTRACT_NOT_SIGNABLE');

    const ok = await this.otp.verify(input.otpChallengeId, input.code);
    if (!ok) throw new BadRequestException('INVALID_OTP');

    const evidence = {
      document_hash: contract.document_hash,
      signer: {
        full_name: contract.full_name,
        document_id: contract.document_id,
        email: contract.email,
      },
      consent_text_version: input.consentTextVersion,
      otp_verification_id: input.otpChallengeId,
      ip: input.ip,
      user_agent: input.userAgent,
      document_scrolled_to_end: input.scrolledToEnd,
    };

    await this.ds.query(
      `UPDATE contracts
          SET status='signed_pending_payment', signed_at=now(), evidence=$2
        WHERE id=$1 AND status='draft'`,
      [contractId, JSON.stringify(evidence)],
    );
  }
}
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/contract-signing.spec.ts`
Esperado: PASA — 6 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): contrato en PDF, firma con OTP y acta de evidencias"
```

---

## Tarea 8: Pagos Wompi — inicio, webhook y liquidación

**Archivos:**
- Crear: `src/payments/payment-event.entity.ts`, `src/payments/wompi.client.ts`, `src/payments/payments.service.ts`, `src/payments/payments.controller.ts`
- Crear: `src/database/migrations/1755700000000-payments.ts`
- Prueba: `test/integration/payment-settlement.spec.ts`

**Interfaces:**
- Consume: `DropsService.grantEntitlement()`, `ContractsService`, `MailService`, `Order`.
- Produce: `WompiClient.buildCheckoutUrl(reference: string, amountCop: number, redirectUrl: string): string`; `WompiClient.verifyEventSignature(body: WompiEvent): boolean`; `WompiClient.getTransaction(id: string): Promise<{ status: string; reference: string }>`; `PaymentsService.settle(event: WompiEvent): Promise<void>`. Endpoint `POST /webhooks/wompi`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/payment-settlement.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { testDb, truncateAll } from '../setup/db';
import { PaymentsService } from '../../src/payments/payments.service';
import { WompiClient, WompiEvent } from '../../src/payments/wompi.client';
import { DropsService } from '../../src/drops/drops.service';
import { MailService } from '../../src/mail/mail.service';

class FakeMail { sent: string[] = []; async send(to: string, _s: string, _h: string, key?: string) { this.sent.push(key ?? to); } }

const EVENTS_SECRET = 'test_events_secret';

function makeEvent(reference: string, txId: string, status: 'APPROVED' | 'DECLINED', amountCents: number): WompiEvent {
  const props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const timestamp = 1755000000;
  const values = [txId, status, String(amountCents)];
  const checksum = createHash('sha256')
    .update(values.join('') + timestamp + EVENTS_SECRET).digest('hex');
  return {
    event: 'transaction.updated',
    data: { transaction: { id: txId, reference, status, amount_in_cents: amountCents } },
    signature: { properties: props, checksum },
    timestamp,
  };
}

describe('liquidación de pago', () => {
  let ds: DataSource;
  let payments: PaymentsService;
  let mail: FakeMail;

  beforeAll(async () => {
    ds = await testDb();
    mail = new FakeMail();
    payments = new PaymentsService(
      ds,
      new DropsService(ds),
      mail as unknown as MailService,
      new WompiClient('pub_test', 'prv_test', 'integrity', EVENTS_SECRET, 'https://sandbox.wompi.co/v1', 'https://checkout.wompi.co/p/'),
    );
  });
  beforeEach(async () => { await truncateAll(ds); mail.sent = []; });
  afterAll(async () => { await ds.destroy(); });

  async function pendingOrder(opts: { withPiece?: boolean; withDrop?: boolean } = { withPiece: true }) {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    const reference = `ord_${Math.random().toString(36).slice(2)}`;
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference)
       VALUES ($1,500000,'CARD',$2) RETURNING id`, [u.id, reference]);
    let pieceId: string | null = null;
    let dropId: string | null = null;
    if (opts.withPiece) {
      const [p] = await ds.query(
        `INSERT INTO pieces (slug,title,price_cop,status) VALUES ($1,'P',500000,'reserved') RETURNING id`,
        [`p-${Math.random().toString(36).slice(2)}`]);
      pieceId = p.id;
      await ds.query(`INSERT INTO order_items (order_id,piece_id,unit_price_cop) VALUES ($1,$2,500000)`, [o.id, p.id]);
      await ds.query(
        `INSERT INTO contracts (order_id,piece_id,pdf_url,document_hash,status,signed_at,evidence)
         VALUES ($1,$2,'https://f/x.pdf','abc','signed_pending_payment',now(),'{}'::jsonb)`,
        [o.id, p.id]);
    }
    if (opts.withDrop) {
      const [d] = await ds.query(
        `INSERT INTO drops (slug,title,price_cop,video_asset_id,capacity,status)
         VALUES ($1,'D',15000,'vid',50,'available') RETURNING id`,
        [`d-${Math.random().toString(36).slice(2)}`]);
      dropId = d.id;
      await ds.query(`INSERT INTO order_items (order_id,drop_id,unit_price_cop) VALUES ($1,$2,15000)`, [o.id, d.id]);
    }
    return { orderId: o.id, reference, userId: u.id, pieceId, dropId };
  }

  it('rechaza un webhook con firma inválida', async () => {
    const ev = makeEvent('ord_x', 'tx1', 'APPROVED', 50000000);
    ev.signature.checksum = 'falsa';
    await expect(payments.settle(ev)).rejects.toThrow(/INVALID_SIGNATURE/);
  });

  it('marca pagado, vende la pieza y ejecuta el contrato', async () => {
    const o = await pendingOrder({ withPiece: true });
    await payments.settle(makeEvent(o.reference, 'tx2', 'APPROVED', 50000000));
    const [order] = await ds.query(`SELECT status, paid_at FROM orders WHERE id=$1`, [o.orderId]);
    expect(order.status).toBe('paid');
    expect(order.paid_at).not.toBeNull();
    const [piece] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [o.pieceId]);
    expect(piece.status).toBe('sold');
    const [contract] = await ds.query(`SELECT status FROM contracts WHERE order_id=$1`, [o.orderId]);
    expect(contract.status).toBe('executed');
  });

  it('emite el entitlement del drop al pagar', async () => {
    const o = await pendingOrder({ withDrop: true });
    await payments.settle(makeEvent(o.reference, 'tx3', 'APPROVED', 1500000));
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM entitlements WHERE drop_id=$1 AND user_id=$2`,
      [o.dropId, o.userId]);
    expect(count).toBe(1);
  });

  it('procesa tres entregas del mismo evento con un solo efecto', async () => {
    const o = await pendingOrder({ withPiece: true, withDrop: true });
    const ev = makeEvent(o.reference, 'tx4', 'APPROVED', 51500000);
    await payments.settle(ev);
    await payments.settle(ev);
    await payments.settle(ev);
    const [{ ent }] = await ds.query(
      `SELECT count(*)::int AS ent FROM entitlements WHERE drop_id=$1`, [o.dropId]);
    expect(ent).toBe(1);
    const [{ evs }] = await ds.query(`SELECT count(*)::int AS evs FROM payment_events`);
    expect(evs).toBe(1);
    expect(mail.sent).toHaveLength(1);
  });

  it('un pago declinado libera la pieza y anula el contrato', async () => {
    const o = await pendingOrder({ withPiece: true });
    await payments.settle(makeEvent(o.reference, 'tx5', 'DECLINED', 50000000));
    const [order] = await ds.query(`SELECT status FROM orders WHERE id=$1`, [o.orderId]);
    expect(order.status).toBe('failed');
    const [piece] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [o.pieceId]);
    expect(piece.status).toBe('available');
    const [contract] = await ds.query(`SELECT status FROM contracts WHERE order_id=$1`, [o.orderId]);
    expect(contract.status).toBe('void');
  });

  it('respeta el pago si la reserva venció pero nadie tomó la pieza', async () => {
    const o = await pendingOrder({ withPiece: true });
    await ds.query(
      `UPDATE pieces SET status='available', reserved_until=NULL WHERE id=$1`, [o.pieceId]);
    await payments.settle(makeEvent(o.reference, 'tx6', 'APPROVED', 50000000));
    const [piece] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [o.pieceId]);
    expect(piece.status).toBe('sold');
  });

  it('marca el pedido para reembolso si la pieza ya se vendió a otro', async () => {
    const o = await pendingOrder({ withPiece: true });
    await ds.query(`UPDATE pieces SET status='sold', sold_at=now() WHERE id=$1`, [o.pieceId]);
    await payments.settle(makeEvent(o.reference, 'tx7', 'APPROVED', 50000000));
    const [order] = await ds.query(`SELECT status FROM orders WHERE id=$1`, [o.orderId]);
    expect(order.status).toBe('refunded');
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/payment-settlement.spec.ts`
Esperado: FALLA — `PaymentsService` no existe.

- [ ] **Paso 3: Migración**

`api/src/database/migrations/1755700000000-payments.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payments1755700000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE payment_events (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_event_id text NOT NULL UNIQUE,
        payload           jsonb NOT NULL,
        received_at       timestamptz NOT NULL DEFAULT now(),
        processed_at      timestamptz
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE payment_events`);
  }
}
```

El `provider_event_id` se compone como `${transaction.id}:${transaction.status}`: Wompi puede emitir varios eventos por transacción (pendiente, aprobada) y cada estado debe procesarse una sola vez.

- [ ] **Paso 4: Implementar cliente Wompi y liquidación**

`api/src/payments/wompi.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface WompiEvent {
  event: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
      amount_in_cents: number;
    };
  };
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

@Injectable()
export class WompiClient {
  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
    private readonly integritySecret: string,
    private readonly eventsSecret: string,
    private readonly baseUrl: string,
    private readonly checkoutUrl: string,
  ) {}

  /** URL del checkout alojado: la tarjeta nunca toca nuestros servidores. */
  buildCheckoutUrl(reference: string, amountCop: number, redirectUrl: string): string {
    const cents = amountCop * 100;
    const integrity = createHash('sha256')
      .update(`${reference}${cents}COP${this.integritySecret}`).digest('hex');
    const params = new URLSearchParams({
      'public-key': this.publicKey,
      currency: 'COP',
      'amount-in-cents': String(cents),
      reference,
      'signature:integrity': integrity,
      'redirect-url': redirectUrl,
    });
    return `${this.checkoutUrl}?${params.toString()}`;
  }

  /** Recalcula el checksum sobre las propiedades que el propio evento declara. */
  verifyEventSignature(body: WompiEvent): boolean {
    const concatenated = body.signature.properties
      .map((path) => path.split('.').reduce<any>((acc, k) => acc?.[k], body.data))
      .map(String)
      .join('');
    const expected = createHash('sha256')
      .update(`${concatenated}${body.timestamp}${this.eventsSecret}`).digest('hex');
    return expected === body.signature.checksum;
  }

  async getTransaction(id: string): Promise<{ status: string; reference: string }> {
    const res = await fetch(`${this.baseUrl}/transactions/${id}`, {
      headers: { Authorization: `Bearer ${this.privateKey}` },
    });
    if (!res.ok) throw new Error(`WOMPI_QUERY_FAILED_${res.status}`);
    const json = await res.json();
    return { status: json.data.status, reference: json.data.reference };
  }
}
```

`api/src/payments/payments.service.ts`:

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DropsService } from '../drops/drops.service';
import { MailService } from '../mail/mail.service';
import { WompiClient, WompiEvent } from './wompi.client';

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly drops: DropsService,
    private readonly mail: MailService,
    private readonly wompi: WompiClient,
  ) {}

  /**
   * Punto único de liquidación. El evento y todos sus efectos se aplican en una
   * sola transacción: si el proceso muere a la mitad, no queda pago registrado
   * sin acceso entregado.
   */
  async settle(event: WompiEvent): Promise<void> {
    if (!this.wompi.verifyEventSignature(event)) {
      throw new BadRequestException('INVALID_SIGNATURE');
    }
    const tx = event.data.transaction;
    const eventId = `${tx.id}:${tx.status}`;

    const notify = await this.ds.transaction(async (m) => {
      const inserted = await m.query(
        `INSERT INTO payment_events (provider_event_id, payload)
         VALUES ($1,$2) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`,
        [eventId, JSON.stringify(event)],
      );
      if (inserted.length === 0) return null; // ya procesado

      const [order] = await m.query(
        `SELECT id, user_id, status FROM orders WHERE reference = $1 FOR UPDATE`,
        [tx.reference],
      );
      if (!order) { this.log.warn(`Pago sin pedido: ${tx.reference}`); return null; }

      const result = tx.status === 'APPROVED'
        ? await this.approve(m, order.id, order.user_id, tx.id)
        : await this.decline(m, order.id, tx.id);

      await m.query(`UPDATE payment_events SET processed_at = now() WHERE provider_event_id = $1`, [eventId]);
      return result;
    });

    // El correo sale fuera de la transacción, con clave de deduplicación.
    if (notify) {
      await this.mail.send(notify.email, notify.subject, notify.html, eventId);
    }
  }

  private async approve(m: EntityManager, orderId: string, userId: string, txId: string) {
    const items = await m.query(
      `SELECT piece_id, drop_id FROM order_items WHERE order_id = $1`, [orderId]);

    // Regla: pago vence a reserva. Solo pierde contra una pieza ya vendida.
    for (const item of items.filter((i: any) => i.piece_id)) {
      const won = await m.query(
        `UPDATE pieces SET status='sold', sold_at=now(), reserved_until=NULL
          WHERE id=$1 AND status IN ('available','reserved') RETURNING id`,
        [item.piece_id],
      );
      if (won.length === 0) {
        await m.query(
          `UPDATE orders SET status='refunded', wompi_transaction_id=$2 WHERE id=$1`,
          [orderId, txId]);
        await m.query(`UPDATE contracts SET status='void' WHERE order_id=$1`, [orderId]);
        const [u] = await m.query(`SELECT email FROM users WHERE id=$1`, [userId]);
        return {
          email: u.email,
          subject: 'Reembolso de tu compra',
          html: '<p>La pieza fue vendida antes de que se confirmara tu pago. Te reembolsamos el valor completo.</p>',
        };
      }
    }

    for (const item of items.filter((i: any) => i.drop_id)) {
      try {
        await this.drops.grantEntitlement(m, item.drop_id, userId, orderId);
      } catch (err) {
        // Cupo lleno o ya poseído: el pago existe, así que se reembolsa.
        await m.query(
          `UPDATE orders SET status='refunded', wompi_transaction_id=$2 WHERE id=$1`,
          [orderId, txId]);
        const [u] = await m.query(`SELECT email FROM users WHERE id=$1`, [userId]);
        return {
          email: u.email,
          subject: 'Reembolso de tu compra',
          html: '<p>El cupo se agotó antes de confirmarse tu pago. Te reembolsamos el valor completo.</p>',
        };
      }
    }

    await m.query(
      `UPDATE orders SET status='paid', paid_at=now(), wompi_transaction_id=$2
        WHERE id=$1 AND status='pending'`,
      [orderId, txId]);
    await m.query(
      `UPDATE contracts SET status='executed' WHERE order_id=$1 AND status='signed_pending_payment'`,
      [orderId]);

    const [u] = await m.query(`SELECT email FROM users WHERE id=$1`, [userId]);
    return {
      email: u.email,
      subject: 'Compra confirmada',
      html: '<p>Tu compra quedó confirmada. Adjuntamos tu contrato firmado.</p>',
    };
  }

  private async decline(m: EntityManager, orderId: string, txId: string) {
    await m.query(
      `UPDATE orders SET status='failed', wompi_transaction_id=$2 WHERE id=$1 AND status='pending'`,
      [orderId, txId]);
    await m.query(
      `UPDATE pieces SET status='available', reserved_until=NULL
        WHERE id IN (SELECT piece_id FROM order_items WHERE order_id=$1 AND piece_id IS NOT NULL)
          AND status='reserved'`,
      [orderId]);
    await m.query(
      `UPDATE contracts SET status='void' WHERE order_id=$1 AND status <> 'executed'`, [orderId]);
    return null;
  }
}
```

`api/src/payments/payments.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { WompiEvent } from './wompi.client';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhooks/wompi')
  @HttpCode(200)
  async webhook(@Body() event: WompiEvent) {
    await this.payments.settle(event);
    return { received: true };
  }
}
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/payment-settlement.spec.ts`
Esperado: PASA — 7 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): liquidación transaccional e idempotente de pagos Wompi"
```

---

## Tarea 9: Reconciliación de pagos

**Archivos:**
- Crear: `src/payments/reconciliation.service.ts`
- Prueba: `test/integration/reconciliation.spec.ts`

**Interfaces:**
- Consume: `WompiClient.getTransaction()`, `PaymentsService.settle()`.
- Produce: `ReconciliationService.run(): Promise<{ checked: number; expired: number }>`, ejecutado cada 10 minutos con `@Cron`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/reconciliation.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { ReconciliationService } from '../../src/payments/reconciliation.service';
import { WompiClient } from '../../src/payments/wompi.client';
import { PaymentsService } from '../../src/payments/payments.service';

describe('reconciliación de pagos', () => {
  let ds: DataSource;

  beforeAll(async () => { ds = await testDb(); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function pendingOrder(ageMinutes: number, txId: string | null) {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    const [p] = await ds.query(
      `INSERT INTO pieces (slug,title,price_cop,status) VALUES ($1,'P',500000,'reserved') RETURNING id`,
      [`p-${Math.random().toString(36).slice(2)}`]);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference,wompi_transaction_id,created_at)
       VALUES ($1,500000,'CARD',$2,$3, now() - make_interval(mins => $4)) RETURNING id`,
      [u.id, `ord_${Math.random().toString(36).slice(2)}`, txId, ageMinutes]);
    await ds.query(`INSERT INTO order_items (order_id,piece_id,unit_price_cop) VALUES ($1,$2,500000)`,
      [o.id, p.id]);
    return { orderId: o.id, pieceId: p.id };
  }

  function makeService(remoteStatus: string) {
    const wompi = {
      getTransaction: async () => ({ status: remoteStatus, reference: 'x' }),
    } as unknown as WompiClient;
    const payments = { settle: jest.fn() } as unknown as PaymentsService;
    return { svc: new ReconciliationService(ds, wompi, payments), payments };
  }

  it('ignora pedidos recientes', async () => {
    await pendingOrder(5, 'tx-recent');
    const { svc } = makeService('APPROVED');
    const result = await svc.run();
    expect(result.checked).toBe(0);
  });

  it('marca expirado un pedido viejo que nunca llegó a Wompi', async () => {
    const o = await pendingOrder(60, null);
    const { svc } = makeService('APPROVED');
    const result = await svc.run();
    expect(result.expired).toBe(1);
    const [order] = await ds.query(`SELECT status FROM orders WHERE id=$1`, [o.orderId]);
    expect(order.status).toBe('expired');
    const [piece] = await ds.query(`SELECT status FROM pieces WHERE id=$1`, [o.pieceId]);
    expect(piece.status).toBe('available');
  });

  it('consulta Wompi para un pedido viejo con transacción y liquida si fue aprobada', async () => {
    await pendingOrder(60, 'tx-lost');
    const { svc, payments } = makeService('APPROVED');
    const result = await svc.run();
    expect(result.checked).toBe(1);
    expect(payments.settle).toHaveBeenCalledTimes(1);
  });

  it('no liquida si Wompi sigue reportando pendiente', async () => {
    await pendingOrder(60, 'tx-pending');
    const { svc, payments } = makeService('PENDING');
    await svc.run();
    expect(payments.settle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/reconciliation.spec.ts`
Esperado: FALLA — `ReconciliationService` no existe.

- [ ] **Paso 3: Implementar el servicio**

```bash
cd api && npm i @nestjs/schedule
```

`api/src/payments/reconciliation.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { WompiClient, WompiEvent } from './wompi.client';

const STALE_MINUTES = 30;

@Injectable()
export class ReconciliationService {
  private readonly log = new Logger(ReconciliationService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly wompi: WompiClient,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Único proceso periódico del sistema: red de seguridad ante un webhook
   * que nunca llegó. No libera reservas — eso es perezoso por diseño.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<{ checked: number; expired: number }> {
    const stale = await this.ds.query(
      `SELECT id, reference, wompi_transaction_id
         FROM orders
        WHERE status = 'pending'
          AND created_at < now() - make_interval(mins => $1)`,
      [STALE_MINUTES],
    );

    let checked = 0;
    let expired = 0;

    for (const order of stale) {
      if (!order.wompi_transaction_id) {
        // Nunca llegó a la pasarela: el usuario abandonó el checkout.
        await this.expire(order.id);
        expired += 1;
        continue;
      }
      checked += 1;
      try {
        const tx = await this.wompi.getTransaction(order.wompi_transaction_id);
        if (tx.status === 'APPROVED' || tx.status === 'DECLINED') {
          await this.payments.settle(this.rebuildEvent(order, tx.status));
        }
      } catch (err) {
        this.log.error(`Reconciliación falló para ${order.reference}: ${String(err)}`);
      }
    }
    return { checked, expired };
  }

  private async expire(orderId: string): Promise<void> {
    await this.ds.transaction(async (m) => {
      await m.query(`UPDATE orders SET status='expired' WHERE id=$1 AND status='pending'`, [orderId]);
      await m.query(
        `UPDATE pieces SET status='available', reserved_until=NULL
          WHERE id IN (SELECT piece_id FROM order_items WHERE order_id=$1 AND piece_id IS NOT NULL)
            AND status='reserved'`,
        [orderId]);
      await m.query(`UPDATE contracts SET status='void' WHERE order_id=$1 AND status='signed_pending_payment'`, [orderId]);
    });
  }

  /** El estado viene de la API, no de un webhook: la firma la ponemos nosotros. */
  private rebuildEvent(order: { reference: string; wompi_transaction_id: string }, status: string): WompiEvent {
    return {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: order.wompi_transaction_id,
          reference: order.reference,
          status: status as 'APPROVED' | 'DECLINED',
          amount_in_cents: 0,
        },
      },
      signature: { properties: [], checksum: '' },
      timestamp: 0,
      trusted: true,
    } as WompiEvent & { trusted: true };
  }
}
```

- [ ] **Paso 4: Permitir el evento de confianza en la liquidación**

En `api/src/payments/payments.service.ts`, cambiar la primera línea de `settle`:

```ts
    const trusted = (event as WompiEvent & { trusted?: boolean }).trusted === true;
    if (!trusted && !this.wompi.verifyEventSignature(event)) {
      throw new BadRequestException('INVALID_SIGNATURE');
    }
```

Solo la reconciliación construye eventos de confianza, y solo después de confirmar el estado contra la API de Wompi con la llave privada.

- [ ] **Paso 5: Ejecutar todas las pruebas**

Ejecutar: `npx jest`
Esperado: PASA — todas las suites, incluidas las 7 de liquidación (la firma inválida sigue rechazándose).

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): reconciliación periódica de pagos contra Wompi"
```

---

## Tarea 10: Visionado efímero

**Archivos:**
- Crear: `src/playback/view-session.entity.ts`, `src/playback/playback.service.ts`, `src/playback/playback.controller.ts`
- Crear: `src/database/migrations/1755800000000-view-sessions.ts`
- Prueba: `test/integration/playback.spec.ts`

**Interfaces:**
- Consume: `Entitlement`, `Drop`, `SessionGuard`.
- Produce: `PlaybackService.play(entitlementId: string, userId: string, ctx: { ip: string; userAgent: string }): Promise<{ token: string; expiresAt: Date }>`. Lanza `ForbiddenException('WINDOW_CLOSED')` si la ventana venció. Endpoint `POST /entitlements/:id/play`.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/playback.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PlaybackService } from '../../src/playback/playback.service';

describe('visionado efímero', () => {
  let ds: DataSource;
  let svc: PlaybackService;
  const ctx = { ip: '190.0.0.1', userAgent: 'jest' };

  beforeAll(async () => {
    ds = await testDb();
    svc = new PlaybackService(ds, async () => 'signed-token-abc');
  });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function entitlement(windowHours = 24) {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
      [`u-${Math.random().toString(36).slice(2)}@x.co`]);
    const [d] = await ds.query(
      `INSERT INTO drops (slug,title,price_cop,video_asset_id,capacity,view_window_hours,status)
       VALUES ($1,'D',15000,'vid',50,$2,'available') RETURNING id`,
      [`d-${Math.random().toString(36).slice(2)}`, windowHours]);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference,status)
       VALUES ($1,15000,'CARD',$2,'paid') RETURNING id`,
      [u.id, `ord_${Math.random().toString(36).slice(2)}`]);
    const [e] = await ds.query(
      `INSERT INTO entitlements (user_id,drop_id,order_id) VALUES ($1,$2,$3) RETURNING id`,
      [u.id, d.id, o.id]);
    return { entitlementId: e.id, userId: u.id };
  }

  it('el primer play abre la ventana de 24 horas', async () => {
    const { entitlementId, userId } = await entitlement(24);
    const res = await svc.play(entitlementId, userId, ctx);
    expect(res.token).toBe('signed-token-abc');
    const [e] = await ds.query(
      `SELECT first_played_at, EXTRACT(EPOCH FROM (expires_at - now()))/3600 AS hours
         FROM entitlements WHERE id=$1`, [entitlementId]);
    expect(e.first_played_at).not.toBeNull();
    expect(Number(e.hours)).toBeGreaterThan(23);
  });

  it('respeta la ventana configurada por drop', async () => {
    const { entitlementId, userId } = await entitlement(2);
    await svc.play(entitlementId, userId, ctx);
    const [e] = await ds.query(
      `SELECT EXTRACT(EPOCH FROM (expires_at - now()))/3600 AS hours FROM entitlements WHERE id=$1`,
      [entitlementId]);
    expect(Number(e.hours)).toBeLessThan(2.1);
  });

  it('dos plays concurrentes abren una sola ventana', async () => {
    const { entitlementId, userId } = await entitlement();
    await Promise.all([
      svc.play(entitlementId, userId, ctx),
      svc.play(entitlementId, userId, ctx),
    ]);
    const [e] = await ds.query(
      `SELECT first_played_at FROM entitlements WHERE id=$1`, [entitlementId]);
    const [{ count }] = await ds.query(
      `SELECT count(*)::int AS count FROM view_sessions WHERE entitlement_id=$1`, [entitlementId]);
    expect(e.first_played_at).not.toBeNull();
    expect(count).toBe(2); // dos sesiones registradas, una sola ventana
  });

  it('permite volver dentro de la ventana', async () => {
    const { entitlementId, userId } = await entitlement();
    const first = await svc.play(entitlementId, userId, ctx);
    const second = await svc.play(entitlementId, userId, ctx);
    expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime());
  });

  it('niega el acceso una vez vencida la ventana', async () => {
    const { entitlementId, userId } = await entitlement();
    await svc.play(entitlementId, userId, ctx);
    await ds.query(
      `UPDATE entitlements SET expires_at = now() - interval '1 minute' WHERE id=$1`, [entitlementId]);
    await expect(svc.play(entitlementId, userId, ctx)).rejects.toThrow(/WINDOW_CLOSED/);
  });

  it('niega el acceso a un entitlement de otro usuario', async () => {
    const { entitlementId } = await entitlement();
    const other = await entitlement();
    await expect(svc.play(entitlementId, other.userId, ctx)).rejects.toThrow(/NOT_FOUND/);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/playback.spec.ts`
Esperado: FALLA — `PlaybackService` no existe.

- [ ] **Paso 3: Migración**

`api/src/database/migrations/1755800000000-view-sessions.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ViewSessions1755800000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE view_sessions (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        entitlement_id uuid NOT NULL REFERENCES entitlements(id),
        started_at     timestamptz NOT NULL DEFAULT now(),
        ip             inet,
        user_agent     text
      )`);
    await q.query(`CREATE INDEX idx_view_sessions_ent ON view_sessions (entitlement_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE view_sessions`);
  }
}
```

- [ ] **Paso 4: Implementar el servicio**

`api/src/playback/playback.service.ts`:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Firma un token de reproducción de Cloudflare Stream para el asset dado. */
export type TokenSigner = (videoAssetId: string, ttlSeconds: number) => Promise<string>;

const TOKEN_TTL_SECONDS = 7200;

@Injectable()
export class PlaybackService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly signToken: TokenSigner,
  ) {}

  async play(
    entitlementId: string,
    userId: string,
    ctx: { ip: string; userAgent: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    // Abre la ventana solo si nunca se abrió. Dos plays simultáneos: gana uno.
    await this.ds.query(
      `UPDATE entitlements e
          SET first_played_at = now(),
              expires_at = now() + make_interval(hours => d.view_window_hours)
         FROM drops d
        WHERE e.id = $1 AND e.user_id = $2 AND e.drop_id = d.id
          AND e.first_played_at IS NULL`,
      [entitlementId, userId],
    );

    const [ent] = await this.ds.query(
      `SELECT e.id, e.expires_at, d.video_asset_id
         FROM entitlements e JOIN drops d ON d.id = e.drop_id
        WHERE e.id = $1 AND e.user_id = $2`,
      [entitlementId, userId],
    );
    if (!ent) throw new NotFoundException('NOT_FOUND');
    if (new Date(ent.expires_at).getTime() <= Date.now()) {
      throw new ForbiddenException('WINDOW_CLOSED');
    }

    await this.ds.query(
      `INSERT INTO view_sessions (entitlement_id, ip, user_agent) VALUES ($1,$2,$3)`,
      [entitlementId, ctx.ip, ctx.userAgent],
    );
    await this.ds.query(
      `UPDATE entitlements SET views_used = views_used + 1 WHERE id = $1`, [entitlementId]);

    const token = await this.signToken(ent.video_asset_id, TOKEN_TTL_SECONDS);
    return { token, expiresAt: new Date(ent.expires_at) };
  }
}
```

`api/src/playback/playback.controller.ts`:

```ts
import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { PlaybackService } from './playback.service';

@Controller('entitlements')
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Post(':id/play')
  @UseGuards(SessionGuard)
  play(@Param('id') id: string, @Req() req: any) {
    return this.playback.play(id, req.user.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
```

El firmante real de Cloudflare Stream se registra como proveedor en `app.module.ts`:

```ts
{
  provide: PlaybackService,
  inject: [getDataSourceToken(), ConfigService],
  useFactory: (ds: DataSource, config: ConfigService) =>
    new PlaybackService(ds, async (videoAssetId, ttl) => {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.get('CF_STREAM_ACCOUNT_ID')}/stream/${videoAssetId}/token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.get('CF_STREAM_TOKEN')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttl }),
        },
      );
      if (!res.ok) throw new Error(`CF_STREAM_TOKEN_FAILED_${res.status}`);
      return (await res.json()).result.token;
    }),
}
```

- [ ] **Paso 5: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/playback.spec.ts`
Esperado: PASA — 6 pruebas.

- [ ] **Paso 6: Cablear todos los módulos y verificar la suite completa**

Componer `api/src/app.module.ts` con `ConfigModule.forRoot({ validationSchema: envSchema, isGlobal: true })`, `TypeOrmModule.forRoot(AppDataSource.options)`, `ScheduleModule.forRoot()` y los controladores `AuthController`, `OrdersController`, `ContractsController`, `PaymentsController`, `PlaybackController`.

Ejecutar: `npx jest`
Esperado: PASA — 8 suites, 49 pruebas.

- [ ] **Paso 7: Commit**

```bash
git add api
git commit -m "feat(api): visionado efímero con ventana única y token firmado"
```

---

## Tarea 11: Endpoints de lectura pública y de cuenta

**Archivos:**
- Crear: `src/pieces/pieces.controller.ts`, `src/drops/drops.controller.ts`, `src/orders/me.controller.ts`
- Modificar: `src/pieces/pieces.service.ts` (añadir métodos de consulta), `src/drops/drops.service.ts`
- Prueba: `test/integration/public-read.spec.ts`

**Interfaces:**
- Consume: `Piece`, `Drop`, `Entitlement`, `SessionGuard`.
- Produce: `GET /pieces`, `GET /pieces/:slug`, `GET /drops/:slug`, `GET /me/orders`, `GET /me/entitlements`. Tipos de respuesta `PieceSummary`, `PieceDetail`, `DropDetail`, `OrderSummary`, `EntitlementSummary` — el front del plan 2 los consume literalmente.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/public-read.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { PiecesService } from '../../src/pieces/pieces.service';
import { DropsService } from '../../src/drops/drops.service';

describe('lectura pública', () => {
  let ds: DataSource;
  let pieces: PiecesService;
  let drops: DropsService;

  beforeAll(async () => { ds = await testDb(); pieces = new PiecesService(ds); drops = new DropsService(ds); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  it('el catálogo excluye borradores y archivadas, e incluye vendidas', async () => {
    await ds.query(`INSERT INTO pieces (slug,title,price_cop,status,published_at)
                    VALUES ('a','A',1000,'available',now()),
                           ('b','B',1000,'draft',NULL),
                           ('c','C',1000,'sold',now()),
                           ('d','D',1000,'archived',now())`);
    const list = await pieces.listPublished();
    expect(list.map((p) => p.slug).sort()).toEqual(['a', 'c']);
  });

  it('el detalle de pieza incluye historia y nota, y marca si está disponible', async () => {
    await ds.query(`INSERT INTO pieces (slug,title,price_cop,status,story,personal_note,published_at)
                    VALUES ('x','X',250000,'available','La usé en la gira','Gracias',now())`);
    const detail = await pieces.findBySlug('x');
    expect(detail!.story).toBe('La usé en la gira');
    expect(detail!.available).toBe(true);
    expect(detail!.priceCop).toBe(250000);
  });

  it('una pieza en borrador no se puede consultar por slug', async () => {
    await ds.query(`INSERT INTO pieces (slug,title,price_cop,status) VALUES ('y','Y',1000,'draft')`);
    await expect(pieces.findBySlug('y')).resolves.toBeNull();
  });

  it('el detalle del drop reporta los cupos restantes', async () => {
    const [d] = await ds.query(
      `INSERT INTO drops (slug,title,price_cop,video_asset_id,capacity,status,published_at)
       VALUES ('dr','DR',15000,'vid',3,'available',now()) RETURNING id`);
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ('a@b.co') RETURNING id`);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference)
       VALUES ($1,15000,'CARD','r1') RETURNING id`, [u.id]);
    await ds.query(`INSERT INTO entitlements (user_id,drop_id,order_id) VALUES ($1,$2,$3)`,
      [u.id, d.id, o.id]);
    const detail = await drops.findBySlug('dr');
    expect(detail!.remaining).toBe(2);
    expect(detail!.soldOut).toBe(false);
  });

  it('un drop sin capacidad reporta cupos ilimitados', async () => {
    await ds.query(`INSERT INTO drops (slug,title,price_cop,video_asset_id,capacity,status,published_at)
                    VALUES ('inf','INF',15000,'vid',NULL,'available',now())`);
    const detail = await drops.findBySlug('inf');
    expect(detail!.remaining).toBeNull();
    expect(detail!.soldOut).toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/public-read.spec.ts`
Esperado: FALLA — `pieces.listPublished` no es una función.

- [ ] **Paso 3: Añadir los métodos de consulta**

Añadir a `api/src/pieces/pieces.service.ts`:

```ts
export interface PieceSummary {
  slug: string; title: string; priceCop: number; images: string[]; available: boolean;
}
export interface PieceDetail extends PieceSummary {
  id: string; description: string | null; story: string | null; soldAt: Date | null;
}
```

y dentro de la clase:

```ts
  async listPublished(): Promise<PieceSummary[]> {
    const rows = await this.ds.query(
      `SELECT slug, title, price_cop, images, status
         FROM pieces
        WHERE status IN ('available','reserved','sold') AND published_at IS NOT NULL
        ORDER BY published_at DESC`,
    );
    return rows.map((r: any) => ({
      slug: r.slug, title: r.title, priceCop: r.price_cop, images: r.images,
      available: r.status === 'available',
    }));
  }

  async findBySlug(slug: string): Promise<PieceDetail | null> {
    const [r] = await this.ds.query(
      `SELECT id, slug, title, description, story, price_cop, images, status, sold_at
         FROM pieces
        WHERE slug=$1 AND status IN ('available','reserved','sold') AND published_at IS NOT NULL`,
      [slug],
    );
    if (!r) return null;
    return {
      id: r.id, slug: r.slug, title: r.title, description: r.description, story: r.story,
      priceCop: r.price_cop, images: r.images, available: r.status === 'available', soldAt: r.sold_at,
    };
  }
```

Añadir a `api/src/drops/drops.service.ts`:

```ts
export interface DropDetail {
  id: string; slug: string; title: string; description: string | null;
  priceCop: number; posterImage: string | null;
  capacity: number | null; remaining: number | null; soldOut: boolean;
  viewWindowHours: number;
}
```

y dentro de la clase:

```ts
  async findBySlug(slug: string): Promise<DropDetail | null> {
    const [r] = await this.ds.query(
      `SELECT d.id, d.slug, d.title, d.description, d.price_cop, d.poster_image,
              d.capacity, d.view_window_hours,
              (SELECT count(*)::int FROM entitlements e WHERE e.drop_id = d.id) AS granted
         FROM drops d
        WHERE d.slug = $1 AND d.status = 'available' AND d.published_at IS NOT NULL`,
      [slug],
    );
    if (!r) return null;
    const remaining = r.capacity === null ? null : Math.max(0, r.capacity - r.granted);
    return {
      id: r.id, slug: r.slug, title: r.title, description: r.description,
      priceCop: r.price_cop, posterImage: r.poster_image,
      capacity: r.capacity, remaining, soldOut: remaining === 0,
      viewWindowHours: r.view_window_hours,
    };
  }
```

- [ ] **Paso 4: Ejecutar la prueba y verificar que pasa**

Ejecutar: `npx jest test/integration/public-read.spec.ts`
Esperado: PASA — 5 pruebas.

- [ ] **Paso 5: Exponer los controladores**

`api/src/pieces/pieces.controller.ts`:

```ts
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PiecesService } from './pieces.service';

@Controller('pieces')
export class PiecesController {
  constructor(private readonly pieces: PiecesService) {}

  @Get()
  list() { return this.pieces.listPublished(); }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const piece = await this.pieces.findBySlug(slug);
    if (!piece) throw new NotFoundException('PIECE_NOT_FOUND');
    return piece;
  }
}
```

`api/src/drops/drops.controller.ts`:

```ts
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { DropsService } from './drops.service';

@Controller('drops')
export class DropsController {
  constructor(private readonly drops: DropsService) {}

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const drop = await this.drops.findBySlug(slug);
    if (!drop) throw new NotFoundException('DROP_NOT_FOUND');
    return drop;
  }
}
```

`api/src/orders/me.controller.ts`:

```ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SessionGuard } from '../auth/session.guard';

export interface OrderSummary {
  id: string; reference: string; status: string; totalCop: number;
  createdAt: Date; trackingNumber: string | null;
}
export interface EntitlementSummary {
  id: string; dropSlug: string; dropTitle: string;
  firstPlayedAt: Date | null; expiresAt: Date | null; state: 'unopened' | 'open' | 'consumed';
}

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get('orders')
  async orders(@Req() req: any): Promise<OrderSummary[]> {
    const rows = await this.ds.query(
      `SELECT id, reference, status, total_cop, created_at, tracking_number
         FROM orders WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    return rows.map((r: any) => ({
      id: r.id, reference: r.reference, status: r.status, totalCop: r.total_cop,
      createdAt: r.created_at, trackingNumber: r.tracking_number,
    }));
  }

  @Get('entitlements')
  async entitlements(@Req() req: any): Promise<EntitlementSummary[]> {
    const rows = await this.ds.query(
      `SELECT e.id, d.slug, d.title, e.first_played_at, e.expires_at
         FROM entitlements e JOIN drops d ON d.id = e.drop_id
        WHERE e.user_id=$1 ORDER BY e.granted_at DESC`,
      [req.user.id],
    );
    return rows.map((r: any) => ({
      id: r.id, dropSlug: r.slug, dropTitle: r.title,
      firstPlayedAt: r.first_played_at, expiresAt: r.expires_at,
      state: r.first_played_at === null
        ? 'unopened'
        : new Date(r.expires_at).getTime() > Date.now() ? 'open' : 'consumed',
    }));
  }
}
```

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): endpoints de catálogo público y de cuenta"
```

---

## Tarea 12: Administración del artista

**Archivos:**
- Crear: `src/admin/admin.guard.ts`, `src/admin/admin.controller.ts`, `src/admin/admin.service.ts`
- Crear: `src/database/migrations/1755900000000-admin.ts`
- Prueba: `test/integration/admin.spec.ts`

**Interfaces:**
- Consume: `SessionGuard`, `Piece`, `Drop`, `Order`, `Contract`.
- Produce: `AdminGuard` (exige `users.is_admin`); endpoints `POST/PATCH /admin/pieces`, `POST/PATCH /admin/drops`, `GET /admin/orders`, `POST /admin/orders/:id/ship`, `GET /admin/contracts`. `AdminService.updateDropCapacity(dropId, capacity)` rechaza reducir por debajo de lo emitido.

- [ ] **Paso 1: Escribir la prueba que falla**

`api/test/integration/admin.spec.ts`:

```ts
import { DataSource } from 'typeorm';
import { testDb, truncateAll } from '../setup/db';
import { AdminService } from '../../src/admin/admin.service';

describe('administración', () => {
  let ds: DataSource;
  let admin: AdminService;

  beforeAll(async () => { ds = await testDb(); admin = new AdminService(ds); });
  beforeEach(async () => { await truncateAll(ds); });
  afterAll(async () => { await ds.destroy(); });

  async function dropWith(capacity: number | null, granted: number) {
    const [d] = await ds.query(
      `INSERT INTO drops (slug,title,price_cop,video_asset_id,capacity,status)
       VALUES ($1,'D',15000,'vid',$2,'available') RETURNING id`,
      [`d-${Math.random().toString(36).slice(2)}`, capacity]);
    for (let i = 0; i < granted; i++) {
      const [u] = await ds.query(`INSERT INTO users (email) VALUES ($1) RETURNING id`,
        [`u${i}-${Math.random().toString(36).slice(2)}@x.co`]);
      const [o] = await ds.query(
        `INSERT INTO orders (user_id,total_cop,payment_method,reference)
         VALUES ($1,15000,'CARD',$2) RETURNING id`,
        [u.id, `r-${Math.random().toString(36).slice(2)}`]);
      await ds.query(`INSERT INTO entitlements (user_id,drop_id,order_id) VALUES ($1,$2,$3)`,
        [u.id, d.id, o.id]);
    }
    return d.id;
  }

  it('permite aumentar la capacidad', async () => {
    const id = await dropWith(10, 5);
    await admin.updateDropCapacity(id, 20);
    const [d] = await ds.query(`SELECT capacity FROM drops WHERE id=$1`, [id]);
    expect(d.capacity).toBe(20);
  });

  it('rechaza reducir la capacidad por debajo de lo ya emitido', async () => {
    const id = await dropWith(10, 5);
    await expect(admin.updateDropCapacity(id, 3)).rejects.toThrow(/CAPACITY_BELOW_GRANTED/);
    const [d] = await ds.query(`SELECT capacity FROM drops WHERE id=$1`, [id]);
    expect(d.capacity).toBe(10);
  });

  it('permite quitar el límite de capacidad', async () => {
    const id = await dropWith(10, 5);
    await admin.updateDropCapacity(id, null);
    const [d] = await ds.query(`SELECT capacity FROM drops WHERE id=$1`, [id]);
    expect(d.capacity).toBeNull();
  });

  it('registra el envío de un pedido pagado', async () => {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ('s@x.co') RETURNING id`);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference,status)
       VALUES ($1,500000,'CARD','r-ship','paid') RETURNING id`, [u.id]);
    await admin.markShipped(o.id, 'GUIA-123');
    const [order] = await ds.query(`SELECT tracking_number, shipped_at FROM orders WHERE id=$1`, [o.id]);
    expect(order.tracking_number).toBe('GUIA-123');
    expect(order.shipped_at).not.toBeNull();
  });

  it('no permite marcar enviado un pedido no pagado', async () => {
    const [u] = await ds.query(`INSERT INTO users (email) VALUES ('t@x.co') RETURNING id`);
    const [o] = await ds.query(
      `INSERT INTO orders (user_id,total_cop,payment_method,reference)
       VALUES ($1,500000,'CARD','r-np') RETURNING id`, [u.id]);
    await expect(admin.markShipped(o.id, 'G')).rejects.toThrow(/ORDER_NOT_PAID/);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y verificar que falla**

Ejecutar: `npx jest test/integration/admin.spec.ts`
Esperado: FALLA — `AdminService` no existe.

- [ ] **Paso 3: Migración**

`api/src/database/migrations/1755900000000-admin.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Admin1755900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE orders ADD COLUMN tracking_number text`);
    await q.query(`ALTER TABLE orders ADD COLUMN shipped_at timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders DROP COLUMN shipped_at`);
    await q.query(`ALTER TABLE orders DROP COLUMN tracking_number`);
    await q.query(`ALTER TABLE users DROP COLUMN is_admin`);
  }
}
```

- [ ] **Paso 4: Implementar guard y servicio**

`api/src/admin/admin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [user] = await this.ds.query(`SELECT is_admin FROM users WHERE id=$1`, [req.user?.id]);
    if (!user?.is_admin) throw new ForbiddenException('NOT_ADMIN');
    return true;
  }
}
```

`api/src/admin/admin.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** La capacidad sube libremente; bajarla nunca puede revocar accesos pagados. */
  async updateDropCapacity(dropId: string, capacity: number | null): Promise<void> {
    await this.ds.transaction(async (m) => {
      const [drop] = await m.query(`SELECT id FROM drops WHERE id=$1 FOR UPDATE`, [dropId]);
      if (!drop) throw new NotFoundException('DROP_NOT_FOUND');
      if (capacity !== null) {
        const [{ granted }] = await m.query(
          `SELECT count(*)::int AS granted FROM entitlements WHERE drop_id=$1`, [dropId]);
        if (capacity < granted) throw new ConflictException('CAPACITY_BELOW_GRANTED');
      }
      await m.query(`UPDATE drops SET capacity=$2 WHERE id=$1`, [dropId, capacity]);
    });
  }

  async markShipped(orderId: string, trackingNumber: string): Promise<void> {
    const rows = await this.ds.query(
      `UPDATE orders SET tracking_number=$2, shipped_at=now()
        WHERE id=$1 AND status='paid' RETURNING id`,
      [orderId, trackingNumber],
    );
    if (rows.length === 0) throw new BadRequestException('ORDER_NOT_PAID');
  }
}
```

`api/src/admin/admin.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Post('pieces')
  async createPiece(@Body() b: {
    slug: string; title: string; description?: string; story?: string;
    personalNote?: string; priceCop: number; images: string[];
  }) {
    const [p] = await this.ds.query(
      `INSERT INTO pieces (slug,title,description,story,personal_note,price_cop,images)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [b.slug, b.title, b.description ?? null, b.story ?? null, b.personalNote ?? null,
       b.priceCop, JSON.stringify(b.images)],
    );
    return { id: p.id };
  }

  @Patch('pieces/:id/publish')
  async publishPiece(@Param('id') id: string) {
    await this.ds.query(
      `UPDATE pieces SET status='available', published_at=now()
        WHERE id=$1 AND status='draft'`, [id]);
    return { ok: true };
  }

  @Post('drops')
  async createDrop(@Body() b: {
    slug: string; title: string; description?: string; priceCop: number;
    videoAssetId: string; posterImage?: string; capacity: number | null; viewWindowHours: number;
  }) {
    const [d] = await this.ds.query(
      `INSERT INTO drops (slug,title,description,price_cop,video_asset_id,poster_image,
                          capacity,view_window_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [b.slug, b.title, b.description ?? null, b.priceCop, b.videoAssetId,
       b.posterImage ?? null, b.capacity, b.viewWindowHours],
    );
    return { id: d.id };
  }

  @Patch('drops/:id/publish')
  async publishDrop(@Param('id') id: string) {
    await this.ds.query(
      `UPDATE drops SET status='available', published_at=now() WHERE id=$1 AND status='draft'`, [id]);
    return { ok: true };
  }

  @Patch('drops/:id/capacity')
  async capacity(@Param('id') id: string, @Body() b: { capacity: number | null }) {
    await this.admin.updateDropCapacity(id, b.capacity);
    return { ok: true };
  }

  @Get('orders')
  orders() {
    return this.ds.query(
      `SELECT o.id, o.reference, o.status, o.total_cop, o.created_at, o.tracking_number,
              o.shipping_address, u.email, u.full_name
         FROM orders o JOIN users u ON u.id=o.user_id
        ORDER BY o.created_at DESC LIMIT 200`);
  }

  @Post('orders/:id/ship')
  async ship(@Param('id') id: string, @Body() b: { trackingNumber: string }) {
    await this.admin.markShipped(id, b.trackingNumber);
    return { ok: true };
  }

  @Get('contracts')
  contracts() {
    return this.ds.query(
      `SELECT c.id, c.pdf_url, c.status, c.signed_at, o.reference, u.full_name, u.document_id
         FROM contracts c JOIN orders o ON o.id=c.order_id JOIN users u ON u.id=o.user_id
        ORDER BY c.created_at DESC LIMIT 200`);
  }
}
```

- [ ] **Paso 5: Ejecutar la suite completa**

Ejecutar: `npx jest`
Esperado: PASA — 10 suites, 59 pruebas.

- [ ] **Paso 6: Commit**

```bash
git add api
git commit -m "feat(api): administración del artista con guard de rol"
```

---

## Autorrevisión

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| §4 modelo de datos | 1, 2, 3, 4, 5, 7, 8, 10 |
| §5.1 unicidad de pieza | 2 |
| §5.2 aforo configurable | 3 |
| §5.3 ventana de visionado | 10 |
| §5 expiración perezosa | 2 |
| §6 idempotencia (4 puntos) | 4 (clave), 8 (webhooks, transiciones, efectos externos) |
| §7 contrato y acta de evidencias | 7 |
| §8 visionado efímero | 10 |
| §9 superficie de API | 5, 6, 7, 8, 10, 11, 12 |
| §10 panel del artista (API) | 12 |
| §12 casos borde | 8 (pago tardío, cupo lleno, declinado), 9 (webhook perdido) |
| §13 pruebas 1-8 | 2, 3, 4, 8, 10 |

Fuera de este plan por decisión de alcance: §11 principios de interfaz — corresponde al plan 2, que cubre la web pública y la interfaz del panel en `/studio`.

**Marcador de deuda declarado:** la deduplicación de correos en `MailService` es en memoria (`lazy:` en el código). Basta con una instancia; si la API escala horizontalmente, mover a tabla.

**Consistencia de tipos verificada:** `PaymentMethod` se define en `pieces.service.ts` y se importa en `order.entity.ts` y `create-order.dto.ts`. `WompiEvent` se define en `wompi.client.ts` y se consume en `payments.service.ts`, `payments.controller.ts` y `reconciliation.service.ts`. `grantEntitlement` recibe `EntityManager` en la tarea 3 y se invoca con el manager de la transacción en la tarea 8. `TokenSigner` se define en `playback.service.ts` y se inyecta en `app.module.ts`.
