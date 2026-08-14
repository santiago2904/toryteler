# Tienda del artista — Diseño de sistema (Fase 1)

Fecha: 2026-08-13
Estado: aprobado en brainstorming, pendiente de plan de implementación

---

## 1. Qué es esto

Una tienda de un solo artista donde se venden dos cosas, en el mismo carrito y el mismo checkout:

- **Piezas físicas únicas** (one-of-one): objetos del artista, cosas que usó, piezas irrepetibles. Cada compra incluye una nota personal escrita por el artista y un contrato de compraventa firmado electrónicamente.
- **Piezas digitales efímeras**: contenido en video con aforo limitado y acceso de una sola vez por comprador, dentro de una ventana de tiempo.

La propuesta no es el producto: es la cercanía. El sistema existe para que la relación entre el artista y quien compra quede registrada — quién tiene qué pieza, qué le escribió el artista, quién vio ese video y cuándo.

Estéticamente el referente es `yeezy.com`: minimalismo extremo, casi sin interfaz, tipografía y foto haciendo todo el trabajo.

### Alcance de la fase 1

Dentro:
- Catálogo de piezas físicas únicas, con página de procedencia pública por pieza
- Nota personal por pieza, escrita por el artista
- Drops digitales con aforo configurable y visionado de una vez por comprador
- Checkout único (pieza física y/o drop digital en el mismo pedido)
- Contrato de compraventa en PDF, firmado electrónicamente antes del pago
- Pagos en COP vía Wompi (PSE, Nequi, tarjeta, Bancolombia)
- Panel mínimo del artista

Fuera (fases posteriores):
- Subastas
- Q&A del artista con los compradores
- Mercado secundario / reventa entre coleccionistas
- Multi-artista
- Envíos internacionales

---

## 2. Decisiones tomadas

| Área | Decisión | Razón |
|---|---|---|
| Tenencia | Single-tenant, un artista | Elimina payouts multiparte, KYC de vendedores y responsabilidad de marketplace |
| Plataforma | In-house, no Shopify | Shopify resuelve logística (que aquí es de bajo volumen) y no resuelve el contenido efímero ni la firma en checkout; integrarlo dejaría dos sistemas y dos identidades de usuario |
| Backend | NestJS + Postgres + TypeORM | Proceso persistente para PDF, webhooks y crons; stack conocido del equipo |
| Frontend | Next.js (App Router) consumiendo la API | SSR para catálogo y procedencia: primer render y previews sociales |
| Deploy | API en Railway/Render, web en Vercel | Proporcional al tamaño; Postgres administrado y cron incluidos |
| Imágenes | Cloudinary | Transformaciones y `f_auto`/`q_auto` sin montar pipeline |
| Video | Cloudflare Stream | URLs firmadas de vida corta, control de reproducción por sesión |
| Pagos | Wompi (Bancolombia) | PSE, Nequi, Bancolombia y tarjeta; webhooks firmados y buena documentación |
| PDF | `pdf-lib` en el servidor | Contrato generado con datos reales, sin proveedor externo |
| Correo | Resend | Contrato firmado, acceso al contenido, notas |
| Sesión | Magic link por correo | Sin contraseñas; la identidad es requisito para la firma y para el aforo |

Deliberadamente ausentes: Redis, colas, motor de búsqueda, CDN propio, carrito persistente complejo. Con un catálogo de piezas contadas, buscar es un `WHERE`.

### Sobre las comisiones en productos de precio bajo

Una transacción con tarjeta en Colombia cuesta aproximadamente 2.65% + 900 COP fijos; PSE ronda 1.700 COP fijos. Un drop digital de ~4.000 COP pierde entre 25% y 45% en comisión.

Decisión: se acepta ese costo en fase 1 y no se construyen créditos prepagados ni saldos. El drop de precio simbólico es un gesto de marca, no una línea de ingreso, y un sistema de saldos es un subsistema financiero completo (recargas, caducidad, reembolsos parciales, contabilidad) que no se justifica hasta tener volumen.

**El precio mínimo no se impone por sistema.** El artista puede poner el precio que quiera, incluido el drop simbólico de ~4.000 COP, porque el gesto artístico manda sobre el margen. Lo que sí hace el panel es mostrar, en el momento de fijar el precio, el cálculo real de lo que queda después de comisión:

> Precio 4.000 COP → recibes ~2.194 COP (45% se va en comisión).
> Recomendado: desde 15.000 COP (comisión ~8%).

Es información en el punto de decisión, no una restricción. `price_cop > 0` sigue siendo el único límite duro.

---

## 3. Arquitectura

```
┌────────────────┐        REST/JSON        ┌──────────────────┐
│  Next.js (web) │ ──────────────────────► │  NestJS (API)    │
│  Vercel        │ ◄────────────────────── │  Railway/Render  │
└────────────────┘                          └────────┬─────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                        ┌─────▼─────┐        ┌───────▼───────┐      ┌───────▼───────┐
                        │ Postgres  │        │ Wompi         │      │ Cloudflare    │
                        │ (verdad)  │        │ (pagos)       │      │ Stream (video)│
                        └───────────┘        └───────────────┘      └───────────────┘
                                                     │
                                       Cloudinary (img) · Resend (correo)
```

**Principio rector:** todo estado peligroso —"esta pieza es única", "quedan N cupos", "esta vista ya se gastó"— vive **solo en Postgres, protegido por constraints**. Nunca en memoria de la aplicación, nunca duplicado. La API corre en varias instancias; cualquier secuencia de "leer, verificar, escribir" en TypeScript vende la misma pieza dos veces tarde o temprano.

Corolario: los invariantes se implementan en migraciones SQL escritas a mano. Las validaciones de entidad de TypeORM no protegen contra concurrencia y no se usan para esto.

**Sobre la piratería:** cualquiera puede grabar la pantalla. Con URLs firmadas y sin DRM se detiene la mayoría del abuso casual; el resto no se detiene sin un gasto desproporcionado. Se asume como decisión de diseño: el valor del producto es el gesto y la procedencia, no la imposibilidad técnica de copiar.

---

## 4. Modelo de datos

Dos tipos de cosa vendible, **no unificados** bajo un "producto" genérico. Una pieza física única y un drop digital con aforo se comportan de forma tan distinta (envío vs. acceso, stock 1 vs. N, contrato vs. entitlement) que fusionarlos produce columnas nulas y condicionales por todas partes.

### users
```sql
id              uuid primary key
email           citext not null unique
full_name       text
document_id     text          -- cédula; requerida antes de firmar
phone           text
created_at      timestamptz not null default now()
```

### pieces — pieza física única
```sql
id              uuid primary key
slug            text not null unique
title           text not null
description     text
story           text            -- procedencia: qué es, cuándo la usó el artista
personal_note   text            -- nota del artista para el comprador
price_cop       integer not null check (price_cop > 0)
images          jsonb not null default '[]'   -- public_ids de Cloudinary
status          text not null default 'draft'
                check (status in ('draft','available','reserved','sold','archived'))
reserved_until  timestamptz
published_at    timestamptz
sold_at         timestamptz
```

### drops — pieza digital efímera
```sql
id                  uuid primary key
slug                text not null unique
title               text not null
description         text
price_cop           integer not null check (price_cop > 0)
video_asset_id      text not null          -- Cloudflare Stream
poster_image        text
capacity            integer check (capacity is null or capacity > 0)  -- null = ilimitado
view_window_hours   integer not null default 24 check (view_window_hours > 0)
max_views_per_buyer integer not null default 1 check (max_views_per_buyer > 0)
status              text not null default 'draft'
                    check (status in ('draft','available','closed','archived'))
published_at        timestamptz
```

Regla de negocio: `capacity` se puede aumentar, nunca reducir por debajo de los entitlements ya emitidos. Reducirla no revoca accesos pagados; el sistema rechaza la operación en vez de quedar inconsistente. Se valida en el servicio, no con constraint (requiere consultar otra tabla).

### orders / order_items
```sql
-- orders
id                    uuid primary key
user_id               uuid not null references users(id)
status                text not null default 'pending'
                      check (status in ('pending','paid','failed','expired','refunded'))
total_cop             integer not null
shipping_address      jsonb          -- null si el pedido es solo digital
wompi_transaction_id  text unique
created_at            timestamptz not null default now()
paid_at               timestamptz

-- order_items
id            uuid primary key
order_id      uuid not null references orders(id)
piece_id      uuid references pieces(id)
drop_id       uuid references drops(id)
unit_price_cop integer not null
check (num_nonnulls(piece_id, drop_id) = 1)   -- exactamente uno
```

### entitlements — derecho a ver un drop
```sql
id              uuid primary key
user_id         uuid not null references users(id)
drop_id         uuid not null references drops(id)
order_id        uuid not null references orders(id)
granted_at      timestamptz not null default now()
first_played_at timestamptz
expires_at      timestamptz
views_used      integer not null default 0
unique (user_id, drop_id)
```

### contracts
```sql
id                  uuid primary key
order_id            uuid not null references orders(id)
piece_id            uuid not null references pieces(id)
pdf_url             text not null
document_hash       text not null        -- sha256 del PDF exacto que vio el firmante
status              text not null default 'signed_pending_payment'
                    check (status in ('signed_pending_payment','executed','void'))
signed_at           timestamptz not null
evidence            jsonb not null       -- acta de evidencias, ver §7
unique (order_id, piece_id)
```

### payment_events — idempotencia de webhooks
```sql
id                  uuid primary key
provider_event_id   text not null unique
payload             jsonb not null
received_at         timestamptz not null default now()
processed_at        timestamptz
```

### idempotency_keys
```sql
key           text primary key
user_id       uuid references users(id)
endpoint      text not null
request_hash  text not null
response_body jsonb
status_code   integer
created_at    timestamptz not null default now()
```

### view_sessions — auditoría de reproducción
```sql
id              uuid primary key
entitlement_id  uuid not null references entitlements(id)
started_at      timestamptz not null default now()
ip              inet
user_agent      text
```

---

## 5. Los tres invariantes

### 5.1 Una pieza no se vende dos veces

Reserva por `UPDATE` condicional — gana uno solo, sin transacciones largas:
```sql
UPDATE pieces
SET status = 'reserved', reserved_until = now() + ($2 * interval '1 minute')  -- TTL según método
WHERE id = $1 AND status = 'available';
-- 0 filas afectadas: alguien llegó primero
```

Y un índice único parcial que hace la doble venta imposible, no solo improbable:
```sql
CREATE UNIQUE INDEX uniq_order_item_piece ON order_items (piece_id) WHERE piece_id IS NOT NULL;
```

### 5.2 No existe el comprador que excede el aforo

Cuando `capacity IS NOT NULL`, se serializa bloqueando la fila del drop dentro de la transacción:
```sql
SELECT capacity FROM drops WHERE id = $1 FOR UPDATE;
-- contar entitlements del drop; si count >= capacity, rechazar con 409
```
Con `capacity IS NULL` se omite el bloqueo: no hay nada que serializar y las compras entran en paralelo.

`UNIQUE (user_id, drop_id)` impide además que la misma persona compre dos veces el mismo drop.

### 5.3 La ventana de visionado se abre una sola vez

```sql
UPDATE entitlements
SET first_played_at = now(),
    expires_at = now() + (SELECT view_window_hours FROM drops WHERE id = drop_id) * interval '1 hour'
WHERE id = $1 AND first_played_at IS NULL;
```

Regla de acceso posterior: se permite si `first_played_at IS NULL` (aún no empieza) o si `now() < expires_at` (dentro de la ventana). Una caída de red no cuesta la compra; a las 24 horas la ventana se cierra sola.

### Reservas: TTL, liberación y pagos tardíos

Al iniciar el checkout la pieza pasa a `reserved`, para que nadie más la compre mientras el usuario llena datos, lee el contrato, verifica el OTP y firma.

**El TTL depende del método de pago**, porque PSE es estructuralmente lento (redirección al banco, clave, token):

| Método | `reserved_until` |
|---|---|
| Tarjeta | 15 minutos |
| PSE / Bancolombia | 45 minutos |
| Nequi | 20 minutos |

Cron cada minuto: las piezas `reserved` con `reserved_until < now()` vuelven a `available` y su pedido pasa a `expired`. Una compra abandonada no congela una pieza para siempre.

**Pago aprobado que llega después de que la reserva venció.** Una reserva vencida no anula un pago real. Al procesar el webhook se resuelve por estado actual de la pieza:

| Estado de la pieza al llegar el pago | Resolución |
|---|---|
| `available` (nadie la tomó) | Se respeta la compra. Pasa a `sold`. Caso normal y mayoritario |
| `reserved` por otro usuario, sin pagar | **El pago vence a la reserva.** Se le asigna a quien pagó; al otro se le libera el checkout con aviso |
| `sold` a otro usuario | Gana quien pagó primero. Al segundo se le reembolsa automáticamente con correo explicando |

La regla general: **pago vence a reserva; primer pago vence a segundo pago.** Con el TTL diferenciado, la tercera fila es rara.

---

## 6. Idempotencia

Todo endpoint que mueva dinero o entregue acceso es reintentable sin consecuencias. Ningún efecto se dispara fuera de la transacción que lo autoriza.

**1. Webhooks de Wompi.** Verificar firma, luego dejar que Postgres decida si el evento es nuevo:
```sql
INSERT INTO payment_events (provider_event_id, payload) VALUES ($1, $2)
ON CONFLICT (provider_event_id) DO NOTHING;
-- 0 filas: ya procesado. Responder 200 y salir.
```
El evento y su efecto (marcar pagado, emitir entitlements, sellar contrato) se aplican en **una sola transacción**. Si el proceso muere a la mitad, no queda un pago registrado sin acceso entregado.

**2. Creación de pedido.** El cliente envía `Idempotency-Key` (UUID por intento de checkout). Misma clave + mismo `request_hash` devuelve la respuesta guardada; misma clave + cuerpo distinto responde `409`. Mata el doble clic y el reintento por timeout.

**3. Transiciones de estado condicionales, nunca ciegas.**
```sql
UPDATE orders SET status='paid', paid_at=now() WHERE id=$1 AND status='pending';
```
Cero filas significa "ya estaba pagada": es éxito, no error. Igual para el alta de entitlements y el consumo de vista.

**4. Efectos externos** (PDF, correo). Clave natural: `UNIQUE (order_id, piece_id)` en `contracts` impide generar el contrato dos veces; el envío de correo lleva su propia clave de deduplicación. Wompi reintenta webhooks; sin esto el comprador recibe tres veces el mismo contrato.

---

## 7. Flujo A — Compra de pieza física con contrato firmado

Se firma **antes** de pagar. Firmando después existiría un instante con dinero cobrado y sin contrato; firmando antes, el peor caso es un contrato firmado nunca pagado, que se anula solo.

1. **Sesión.** Magic link al correo. Sin identidad no hay firma válida.
2. **Reserva.** `POST /orders` con `Idempotency-Key`: el `UPDATE` condicional gana la pieza (TTL según método de pago, §5) y crea el pedido en `pending`.
3. **Datos del comprador.** Nombre completo, cédula, dirección y teléfono. La cédula identifica al firmante en el contrato.
4. **Contrato en pantalla.** Se genera el PDF con pieza, precio, comprador y condiciones, y se muestra completo. Se registra que llegó al final del documento: evidencia de oportunidad real de lectura.
5. **Firma.** Casilla de consentimiento con texto versionado **más código OTP** al celular o correo. El OTP ata la identidad al acto; sin él queda solo un checkbox, mucho más débil ante una disputa.
6. **Acta de evidencias** (JSONB en `contracts.evidence`):
   ```json
   {
     "document_hash": "sha256:...",
     "signer": { "full_name": "...", "document_id": "...", "email": "..." },
     "consent_text_version": "v1",
     "consent_at": "2026-08-13T20:14:03Z",
     "otp_verification_id": "...",
     "otp_verified_at": "2026-08-13T20:13:48Z",
     "ip": "...",
     "user_agent": "...",
     "document_scrolled_to_end": true
   }
   ```
7. **Pago en Wompi.** El contrato queda `signed_pending_payment`.
8. **Webhook aprobado** → una transacción: pedido `paid`, pieza `sold`, contrato `executed` (se estampa firma, hash y fecha en el PDF), correo con el PDF adjunto.
9. **Pago fallido o reserva vencida** → pieza vuelve a `available`, contrato a `void`. No hay compraventa sin precio pagado.

### Marco legal (Colombia)

La firma electrónica simple es válida bajo la **Ley 527 de 1999** y el **Decreto 2364 de 2012**, siempre que sea confiable y apropiada para el fin. El acta de evidencias cubre los cuatro requisitos: identidad del firmante (cédula + OTP), consentimiento explícito (texto versionado aceptado), integridad del documento (hash SHA-256 del PDF exacto) y trazabilidad (IP, user-agent, timestamps). No se requiere firma digital certificada para una compraventa de bien mueble.

Antes de publicar hay que hacer revisar el texto del contrato por un abogado. El sistema queda listo para versionar ese texto (`consent_text_version`) sin migraciones.

---

## 8. Flujo B — Visionado efímero

1. **Compra** → entitlement, con el chequeo de aforo de §5.2.
2. **Advertencia antes del play.** Pantalla explícita: *"Al reproducir se abre tu ventana de 24 horas. Solo ocurre una vez."* Con confirmación aparte. Esta pantalla evita la mayor parte de los reclamos.
3. **Play** → el `UPDATE` condicional abre la ventana; el backend solicita a Cloudflare Stream un token firmado de vida corta (2 h, renovable dentro de la ventana).
4. **Dentro de la ventana** puede salir, volver y cambiar de dispositivo. Una sola sesión concurrente por entitlement.
5. **Vencida la ventana**, el token se niega y la página muestra el estado consumido, con la fecha en que lo vio.
6. **Watermark** con el correo del comprador superpuesto en el player. No impide grabar; hace rastreable el compartir. Es disuasión y se comunica como tal.

`view_sessions` registra cada reproducción: sirve para soporte y para detectar abuso.

---

## 9. API (superficie mínima)

```
POST   /auth/magic-link            enviar enlace
GET    /auth/verify                canjear enlace por sesión
GET    /pieces                     catálogo publicado
GET    /pieces/:slug               detalle + procedencia
GET    /drops/:slug                detalle + cupos restantes
POST   /orders                     crear pedido y reservar   [Idempotency-Key]
POST   /orders/:id/contract        generar borrador de contrato
POST   /orders/:id/sign            verificar OTP y firmar    [Idempotency-Key]
POST   /orders/:id/pay             iniciar transacción Wompi
POST   /webhooks/wompi             webhook firmado
GET    /me/orders                  historial
GET    /me/entitlements            accesos digitales
POST   /entitlements/:id/play      abrir ventana y emitir token de video
GET    /admin/*                    panel del artista (rol admin)
```

## 10. Panel del artista

Mínimo deliberado, una sola persona lo usa:
- Crear/editar pieza: fotos (Cloudinary), título, historia de procedencia, precio, nota personal
- Publicar / despublicar
- Crear drop: video, precio, aforo, ventana de visionado
- Ver pedidos: marcar enviado, número de guía
- Ver contratos firmados y descargarlos
- Emitir reembolso

Sin analítica, sin roles, sin flujos de aprobación.

---

## 11. Principios de interfaz

- Fondo blanco o negro plano. Sin sombras, sin bordes redondeados, sin gradientes.
- Una tipografía, dos pesos. Mayúsculas para navegación.
- La foto de la pieza ocupa la pantalla; el texto es mínimo y va abajo.
- Navegación de tres entradas como máximo.
- Sin banners, sin popups, sin chat, sin "productos relacionados".
- El estado se comunica con palabras, no con iconos de colores: `AGOTADO`, `VISTO 13 AGO 2026`, `QUEDAN 12`.
- La accesibilidad no se sacrifica al minimalismo: contraste AA, foco visible, navegación por teclado, `alt` en cada imagen.

---

## 12. Errores y casos borde

| Caso | Comportamiento |
|---|---|
| Webhook duplicado o desordenado | `payment_events` + transiciones condicionales |
| Pago aprobado sobre reserva vencida | Resuelto por estado de la pieza (§5): disponible → se respeta; reservada por otro → el pago gana; vendida → reembolso automático |
| Webhook que nunca llega | Cron reconcilia contra la API de Wompi los pedidos `pending` con más de 30 minutos |
| Falla al generar el PDF | El pedido no avanza; se reintenta. Nunca se cobra sin contrato |
| Aforo lleno al pagar | El entitlement se emite en la transacción del webhook; si el cupo se agotó, reembolso automático |
| Usuario pierde la conexión durante el video | Vuelve a entrar dentro de la ventana, sin costo |
| Reembolso de un drop ya visto | No procede automáticamente; queda a decisión manual del artista desde el panel |

---

## 13. Pruebas

Pruebas de integración contra un Postgres real, sin mocks, sobre los tres invariantes:

1. Dos compras concurrentes de la misma pieza → una gana, la otra recibe 409, la pieza queda vendida una vez.
2. `capacity + 1` compras concurrentes de un drop → se emiten exactamente `capacity` entitlements.
3. Drop con `capacity NULL` → todas las compras concurrentes tienen éxito.
4. Webhook entregado tres veces → un solo contrato, un solo correo, un solo entitlement.
5. Doble `POST /orders` con la misma `Idempotency-Key` → un solo pedido.
6. Dos `play` concurrentes sobre el mismo entitlement → una sola ventana abierta.
7. Acceso tras `expires_at` → 403.
8. Reserva vencida liberada por el cron → la pieza vuelve a estar disponible.

La UI, el catálogo y el panel no llevan pruebas automatizadas en fase 1. Ese es el único código donde un bug cuesta dinero y credibilidad; el resto se verifica manualmente.

---

## 14. Costos operativos estimados (mensuales, arranque)

| Concepto | Estimado |
|---|---|
| Railway/Render (API + Postgres) | USD 10–20 |
| Vercel (web) | USD 0 (hobby) |
| Cloudinary | USD 0 (plan gratuito) |
| Cloudflare Stream | USD 5 por 1.000 minutos almacenados + USD 1 por 1.000 vistos |
| Resend | USD 0 hasta 3.000 correos |
| Wompi | Sin fijo; por transacción |
| **Total base** | **~USD 20–30/mes** |

---

## 15. Riesgos abiertos

1. **El texto del contrato requiere revisión legal** antes de publicar. El sistema queda listo para versionarlo.
2. **Sostenibilidad del contenido**: los drops digitales dependen de que el artista produzca constantemente. Es riesgo de producto, no técnico, pero define si la fase 1 vale la pena.
3. **Wompi en producción** requiere cuenta comercial aprobada de Bancolombia. El desarrollo completo se hace contra el **entorno sandbox de Wompi** (llaves `pub_test_` / `prv_test_`), que cubre PSE, Nequi, tarjeta y webhooks firmados sin cuenta comercial. El trámite bloquea el lanzamiento, no el desarrollo: basta iniciarlo antes de la fase de pruebas con usuarios reales. La única llave de configuración que cambia entre entornos es el par de credenciales; no hay diferencia de código.
4. **Grabación de pantalla** no se puede impedir. Asumido explícitamente.

## 16. Fases siguientes (no diseñadas aquí)

- **Fase 2**: Q&A del artista con compradores verificados
- **Fase 3**: subastas de piezas únicas
- **Fase 4**: mercado secundario con derecho de tanteo del artista
