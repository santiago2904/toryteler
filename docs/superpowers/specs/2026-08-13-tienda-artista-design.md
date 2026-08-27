# Tienda del artista — Diseño de sistema (Fase 1)

Fecha: 2026-08-13
Estado: aprobado en brainstorming, pendiente de plan de implementación

---

## 1. Qué es esto

Una tienda de un solo artista donde se venden dos cosas, en el mismo carrito y el mismo checkout:

- **Piezas físicas**: objetos del artista, cosas que usó, bocetos y pruebas. La mayoría son irrepetibles —una sola unidad— pero el artista puede publicar una edición de varias. Cada compra incluye una nota personal escrita por el artista y un contrato de compraventa firmado electrónicamente.
- **Piezas digitales efímeras**: contenido en video con aforo limitado y acceso de una sola vez por comprador, dentro de una ventana de tiempo.

La propuesta no es el producto: es la cercanía. El sistema existe para que la relación entre el artista y quien compra quede registrada — quién tiene qué pieza, qué le escribió el artista, quién vio ese video y cuándo.

Estéticamente el referente es `yeezy.com`: minimalismo extremo, casi sin interfaz, tipografía y foto haciendo todo el trabajo.

### Alcance de la fase 1

Dentro:
- Catálogo de piezas físicas —**La casa de Tory**—, con página de procedencia pública por pieza
- Ficha del artista: biografía, redes y contacto
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
| Backend | NestJS + Postgres + TypeORM | Proceso persistente para PDF, webhooks y la reconciliación de pagos; stack conocido del equipo |
| Frontend | Next.js (App Router) consumiendo la API | SSR para catálogo y procedencia: primer render y previews sociales |
| Deploy | API en Railway/Render, web en Vercel | Proporcional al tamaño; Postgres administrado y cron incluidos |
| Imágenes | Cloudinary | Transformaciones y `f_auto`/`q_auto` sin montar pipeline |
| Video | Cloudflare Stream | URLs firmadas de vida corta, control de reproducción por sesión |
| Pagos | Wompi (Bancolombia) | PSE, Nequi, Bancolombia y tarjeta; webhooks firmados y buena documentación |
| PDF | `pdf-lib` en el servidor | Contrato generado con datos reales, sin proveedor externo |
| Correo | Resend | Contrato firmado, acceso al contenido, notas |
| Sesión | Magic link por correo | Sin contraseñas; la identidad es requisito para la firma y para el aforo |
| Checkout | Sin sesión previa | Reabierta el 26 de agosto de 2026 — ver «Checkout de invitado» más abajo |

Deliberadamente ausentes: Redis, colas, motor de búsqueda, CDN propio, carrito persistente complejo. Con un catálogo de piezas contadas, buscar es un `WHERE`.

### Checkout de invitado (actualización 2026-08-26)

Pedir un magic link *antes* de comprar mezclaba dos cosas distintas: quién es
el dueño de este pedido, y quién puede entrar a ver el historial de una
cuenta. Ya no. `POST /orders` no exige sesión: sin una, pide el correo del
comprador, encuentra o crea la cuenta (la misma consulta que ya usaba el magic
link) y el pedido queda a su nombre — sin haber probado que ese correo es
suyo.

Eso es seguro porque nada que importa depende de esa prueba: la firma de una
pieza sigue exigiendo su propio código OTP al correo real, y un video sin
contrato no tiene nada que firmar que dependa de la identidad. Lo que sí
habría sido inseguro es dejar que ese correo sin probar abriera una **sesión
de cuenta** — con ella se lee `/me/orders` y, si el correo resulta ser el del
artista, `/studio`. Por eso el token que se emite en el checkout de invitado
lleva un `scope` distinto: el id del pedido, no `'account'`. Sirve para seguir
*ese* pedido (contrato, pago, la página de resultado) y para nada más — `/me/*`
y `/admin/*` exigen `scope: 'account'` explícitamente, que solo un magic link
redimido entrega.

El magic link no desaparece: sigue siendo la única puerta a `/cuenta` — ver el
historial completo, no solo el pedido recién hecho.

Riesgo aceptado a propósito: alguien puede escribir el correo de otra persona
al comprar. Recibe un recibo que no pidió, o retiene brevemente una unidad
(se libera sola al vencer el plazo del pedido, §5). No puede leer su cuenta ni
sus pedidos anteriores.

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

**Principio rector:** todo estado peligroso —"quedan N unidades", "quedan N cupos", "esta vista ya se gastó"— vive **solo en Postgres, protegido por constraints**. Nunca en memoria de la aplicación, nunca duplicado. La API corre en varias instancias; cualquier secuencia de "leer, verificar, escribir" en TypeScript vende la misma pieza dos veces tarde o temprano.

Corolario: los invariantes se implementan en migraciones SQL escritas a mano. Las validaciones de entidad de TypeORM no protegen contra concurrencia y no se usan para esto.

**Sobre la piratería:** cualquiera puede grabar la pantalla. Con URLs firmadas y sin DRM se detiene la mayoría del abuso casual; el resto no se detiene sin un gasto desproporcionado. Se asume como decisión de diseño: el valor del producto es el gesto y la procedencia, no la imposibilidad técnica de copiar.

---

## 4. Modelo de datos

Dos tipos de cosa vendible, **no unificados** bajo un "producto" genérico. Una pieza física y un drop digital se comportan de forma tan distinta (envío frente a acceso, inventario frente a aforo, contrato frente a entitlement) que fusionarlos produce columnas nulas y condicionales por todas partes.

### users
```sql
id              uuid primary key
email           citext not null unique
full_name       text
document_id     text          -- cédula; requerida antes de firmar
phone           text
created_at      timestamptz not null default now()
```

### pieces — pieza física
```sql
id              uuid primary key
slug            text not null unique
title           text not null
description     text
story           text            -- procedencia: qué es, cuándo la usó el artista
personal_note   text            -- nota del artista para el comprador
price_cop       integer not null check (price_cop > 0)
images          jsonb not null default '[]'   -- public_ids de Cloudinary
stock           integer not null default 1 check (stock >= 0)
status          text not null default 'draft'
                check (status in ('draft','available','archived'))
published_at    timestamptz
sold_at         timestamptz     -- cuándo se agotó
```

`stock = 1` es una pieza irrepetible; más de uno, una edición. No existe un estado `reserved`: el plazo del checkout vive en la antigüedad del pedido, no en la pieza. Tampoco `sold`, que `stock = 0` ya expresa.

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

### 5.1 No se vende más de lo que hay

**Corregido el 14 de agosto de 2026.** El diseño original daba por hecho que toda pieza era irrepetible. No lo es: el artista puede publicar una edición de doce copias. `pieces.stock` sustituye al estado `reserved`, y con él cae el índice único parcial sobre `order_items(piece_id)`, que impedía justamente lo que ahora debe permitirse.

```sql
stock integer NOT NULL DEFAULT 1 CHECK (stock >= 0)
```

Una unidad es una pieza irrepetible; más de una, una edición. La tienda lo comunica distinto —`ÚNICA` frente a `QUEDAN 12`— pero el mecanismo es el mismo.

**Reserva por decremento condicional.** Postgres serializa las escrituras sobre una misma fila, así que dos compras simultáneas nunca leen el mismo saldo:

```sql
UPDATE pieces
SET stock = stock - 1
WHERE id = $1 AND stock > 0
RETURNING stock;
-- 0 filas afectadas: se agotó mientras tanto
```

El descuento ocurre al crear el pedido, no al pagar: quien llega primero al checkout tiene la unidad mientras completa datos, contrato y pago.

**Devolución del stock.** Si el pago se declina o el pedido expira, la unidad vuelve:

```sql
UPDATE pieces SET stock = stock + 1 WHERE id = $1;
```

Esto sustituye la expiración perezosa de la versión anterior: un contador no puede recuperarse solo al ser consultado. La devolución ocurre en el mismo sitio donde ya se detecta el fallo — la liquidación del webhook y la reconciliación periódica (§12) —, así que no añade ningún proceso nuevo al sistema.

El TTL por método de pago sigue vigente como plazo del pedido, pero ya no vive en la pieza: es la antigüedad del pedido `pending` la que decide cuándo se considera abandonado.

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

### Plazo del checkout y pagos tardíos

Al crear el pedido la unidad **ya está descontada**, así que nadie más puede comprarla mientras quien la tomó llena datos, lee el contrato, verifica el OTP y paga. No hay estado intermedio ni llave que caducar.

**El plazo depende del método de pago**, porque PSE es estructuralmente lento (redirección al banco, clave, token):

| Método | Plazo del pedido |
|---|---|
| Tarjeta | 15 minutos |
| PSE / Bancolombia | 45 minutos |
| Nequi | 20 minutos |

**La devolución del inventario no puede ser perezosa.** Una reserva marcada en la propia fila podía ignorarse al leerla; un contador no se recupera solo. Un pedido `pending` que supera su plazo se marca `expired` y devuelve sus unidades, y eso ocurre en la reconciliación de pagos que ya existe (§12) — sin añadir ningún proceso nuevo al sistema.

La ventana de visionado sí sigue siendo perezosa: `now() < expires_at` se evalúa en cada acceso.

**El sistema tiene un solo proceso periódico:** la reconciliación de pagos `pending` contra la API de Wompi, que es a la vez la red de seguridad ante un webhook perdido y quien devuelve el inventario abandonado.

**Pago aprobado que llega tarde.** Un plazo vencido no anula un pago real, y el inventario ya devuelto puede haberse agotado mientras tanto:

| Situación al llegar el pago | Resolución |
|---|---|
| El pedido sigue `pending` | Se confirma sin más. Caso normal y mayoritario |
| Expiró y **queda inventario** | Se vuelve a descontar una unidad y se confirma |
| Expiró y **está agotado** | Reembolso automático con correo explicando |

La regla general: **un pago real nunca se descarta si hay con qué cumplirlo.** Con los plazos diferenciados, la tercera fila es rara.

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

GET    /pieces                     catálogo publicado, con stock
GET    /pieces/:slug               detalle + procedencia
GET    /drops                      videos publicados
GET    /drops/:slug                detalle + cupos restantes

POST   /orders                     crear pedido y descontar   [Idempotency-Key]
POST   /orders/:id/contract        generar borrador de contrato
POST   /orders/:id/sign            verificar OTP y firmar     [Idempotency-Key]
POST   /orders/:id/pay             iniciar transacción Wompi
POST   /webhooks/wompi             webhook firmado

GET    /me/orders                  historial, con items y envío
GET    /me/entitlements            accesos digitales
GET    /me/entitlements/:id        un acceso concreto
POST   /entitlements/:id/play      abrir ventana y emitir URL firmada de video

PATCH  /admin/pieces/:id           editar
PATCH  /admin/pieces/:id/publish
PATCH  /admin/pieces/:id/unpublish
PATCH  /admin/drops/:id            editar
PATCH  /admin/drops/:id/publish
PATCH  /admin/drops/:id/unpublish
GET    /admin/orders               pedidos con dirección y correo
POST   /admin/orders/:id/ship      { carrier, trackingNumber }
GET    /admin/contracts            contratos firmados
```

## 10. Panel del artista

Mínimo deliberado, una sola persona lo usa:
- Crear/editar pieza: fotos (Cloudinary), título, historia de procedencia, precio, nota personal
- Publicar y despublicar. **Despublicar retira de la tienda y nada más:** quien ya compró conserva su pedido y su acceso al video. Revocarlos sería quitar algo pagado.
- Crear drop: video, precio, aforo, ventana de visionado
- Ver pedidos: marcar enviado con transportadora y guía; la URL de rastreo la compone el backend
- Ver contratos firmados y descargarlos
- Emitir reembolso

Sin analítica, sin roles, sin flujos de aprobación.

---

## 11. Principios de interfaz

Estilo: **monocromo minimalista**. La referencia es la sobriedad de yeezy.com, no el lujo decorativo: sin serifas de revista, sin vidrio esmerilado, sin color de acento.

### Paleta — dos temas, cuatro valores cada uno

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo | `#FAFAFA` | `#0A0A0A` |
| Tinta | `#101010` — 18.2:1 | `#EDEDED` — 16.9:1 |
| Tenue | `#5F5F5F` — 6.1:1 | `#8A8A8A` — 5.4:1 |
| Línea | `#E2E2E2` | `#242424` |

El tema claro es el de partida; el oscuro se aplica si el sistema lo pide, y la elección manual gana sobre ambas y se recuerda. Se aplica antes del primer pintado para que no haya fogonazo del tema equivocado.

**No se usa blanco puro sobre negro puro.** Da 21:1, pero produce halación —el texto vibra y cansa, sobre todo en OLED—. `#EDEDED` sobre `#0A0A0A` está muy por encima de AAA sin esa fatiga.

Los colores son **custom properties nativas**, nunca variables de preprocesador: viven en runtime, se inspeccionan y permiten cambiar de tema sin recompilar.

### Tipografía — Inter Variable, dos pesos

| Rol | Tamaño | Peso | Tracking |
|---|---|---|---|
| Etiqueta, navegación, estado | 12 px | 500 | `0.16em` |
| Cuerpo | 16 px | 400 | normal |
| Título | `clamp(1.875rem, 5vw, 3.5rem)` | 400 | `-0.03em` |

La jerarquía se construye con tamaño y espaciado entre letras, no con familias distintas ni negritas. No hay tamaños intermedios: si algo no es etiqueta, cuerpo ni título, no debería existir. El tope de 3.5 rem no es estético — por encima, un título desborda la columna de la ficha.

Cuerpo nunca por debajo de 16 px en móvil: menos provoca zoom automático en iOS al enfocar un campo.

### Forma y ritmo

- **Radio de borde 0 en todo el proyecto. Sin sombras, sin gradientes, sin translucidez.** La profundidad se construye con líneas de 1 px y con inversión de color.
- Los botones son el negativo de la página: fondo tinta, texto fondo, y se invierten al pasar por encima.
- Ritmo espacial en múltiplos de 8 px, con saltos grandes. El vacío es el material principal.

### Movimiento

Tres movimientos en todo el sitio, con una sola cadencia: `cubic-bezier(0.22, 1, 0.36, 1)`.

1. **Entrada de contenido:** desvanecido de 400 ms.
2. **Transición entre páginas:** avanzar entra desde la derecha, retroceder desde la izquierda, 420 ms. La dirección se detecta escuchando `popstate` —el único evento que distingue un «atrás» real de un clic—, nunca comparando rutas.
3. **Zoom de la rejilla:** el control `+` alterna entre seis piezas por fila y tres. El cambio ocurre dentro de una transición de vista para que el navegador interpole posición y tamaño de cada foto; animar solo las columnas se siente a cambio de retícula, no a acercamiento.

Nada rebota, nada escala por decoración. Bajo `prefers-reduced-motion` los tres desaparecen.

### Estructura y contenido

- La tienda se llama **La casa de Tory** y ocupa el ancho completo: la pieza manda, no un contenedor centrado.
- **Toryteler** lleva a la ficha del artista: retrato, biografía, redes y contacto.
- La foto de la pieza no se recorta ni se amplía en el detalle; en la rejilla sí se recorta, porque ahí es una miniatura. Nunca se sirve una imagen más ancha de 1400 px ni se amplía una pequeña.
- Sin banners, sin popups, sin chat, sin «productos relacionados».
- El estado se comunica con palabras, no con iconos de colores: `AGOTADO`, `VISTO 13 AGO 2026`, `QUEDAN 12`. El tono acompaña; quien no distinga los grises lee lo mismo.

### Accesibilidad — no se sacrifica al minimalismo

Contraste AA como mínimo en ambos temas, foco visible, navegación completa por teclado, `alt` en cada imagen, objetivos táctiles de 44 px, y ninguna información transmitida solo por color.

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

**Se prueba el núcleo, no todo.** Un ciclo de prueba-primero en cada endpoint y cada pantalla frena el trabajo sin comprar seguridad donde no hace falta. La línea se traza donde un error cuesta dinero o credibilidad:

| Lleva pruebas | No lleva |
|---|---|
| Los tres invariantes (unicidad, aforo, ventana) | Endpoints de lectura y CRUD |
| Idempotencia y liquidación de pagos | Panel de administración |
| Firma del contrato y acta de evidencias | Toda la interfaz |
| Formato de precios y fechas | Estilos y páginas |

Lo que no lleva pruebas automatizadas se verifica a mano con pasos concretos, escritos en el plan correspondiente.

Pruebas de integración contra un Postgres real, sin mocks, sobre los tres invariantes:

1. Dos compras concurrentes de la misma pieza → una gana, la otra recibe 409, la pieza queda vendida una vez.
2. `capacity + 1` compras concurrentes de un drop → se emiten exactamente `capacity` entitlements.
3. Drop con `capacity NULL` → todas las compras concurrentes tienen éxito.
4. Webhook entregado tres veces → un solo contrato, un solo correo, un solo entitlement.
5. Doble `POST /orders` con la misma `Idempotency-Key` → un solo pedido.
6. Dos `play` concurrentes sobre el mismo entitlement → una sola ventana abierta.
7. Acceso tras `expires_at` → 403.
8. Reserva vencida → el siguiente comprador la toma en la misma consulta, sin proceso de fondo.

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
