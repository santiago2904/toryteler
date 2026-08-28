# Editor de contenido desde /studio — diseño

**Fecha:** 2026-08-28
**Estado:** aprobado, pendiente de plan de implementación.

## Problema

Todo el texto de interfaz de la tienda vive hardcodeado en JSX, repartido en
decenas de archivos de `web/app` y `web/components`. El artista no puede
cambiar ni una palabra sin pedirle a alguien que toque código y despliegue.

## Alcance

**No** es un rediseño de i18n de toda la app. Es un editor para un conjunto
acotado de ~35 textos "editoriales" — los que un artista razonablemente
querría cambiar sin tocar código: copy de marca, mensajes de momentos clave
del flujo de compra, estados vacíos con tono. Quedan fuera, deliberadamente:
labels de campos de formulario técnicos, mensajes de error de
validación/API, cualquier texto del propio panel `/studio` (es para el
artista, no necesita editarse a sí mismo), y cualquier texto que tenga una
parte dinámica incrustada (un `{título}`, una fecha, un número de horas) —
ver "Fuera de alcance".

### Las 35 claves

Formato: clave → texto original (el que se usa como fallback si no hay
override) → dónde vive hoy.

**Home**
- `home.empty.body` → "Aún no hay nada publicado." → `web/app/page.tsx:19`

**Artista**
- `artist.meta.title` → "Toryteler — quién es" → `web/app/artista/page.tsx:7`
- `artist.meta.description` → "Quién es el artista detrás de las piezas." → `web/app/artista/page.tsx:8`
- `artist.role` → "Músico y archivista de lo suyo" → `web/lib/artist.ts:10`
- `artist.bio.paragraph1` → "Grabo desde 2019, casi siempre de noche y casi siempre en cuartos prestados. Lo que hago no cabe en un disco: cabe en las cajas donde guardo lo que sobró." → `web/lib/artist.ts:13`
- `artist.bio.paragraph2` → "Esta tienda existe porque me cansé de que esas cajas se quedaran cerradas. Cada pieza que está aquí estuvo antes en un estudio, en un bus o en el piso de mi casa, y tiene una historia que puedo contar entera." → `web/lib/artist.ts:14`
- `artist.bio.paragraph3` → "No hay reediciones. Lo que se va, se fue." → `web/lib/artist.ts:15`
- `artist.socials.title` → "Dónde encontrarlo" → `web/app/artista/page.tsx:32`

**Marca global**
- `site.meta.description` → "Piezas únicas y contenido personal del artista." → `web/app/layout.tsx:20`
- `site.nav.homeLabel` → "La casa de Tory" → `web/app/layout.tsx:49`

**Carrito**
- `cart.empty.body` → "No tienes nada en el carrito." → `web/app/carrito/page.tsx:28`
- `cart.empty.cta` → "Ver la casa de Tory" → `web/app/carrito/page.tsx:29`
- `cart.contractNotice.body` → "Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu cédula a mano." → `web/app/carrito/page.tsx:79-81`

**Checkout**
- `checkout.empty.body` → "No tienes nada en el carrito." → `web/app/checkout/page.tsx:51`
- `checkout.emailNotice.body` → "Ahí te llegan el recibo y, si compras una pieza, el código para firmar el contrato. ¿Ya tienes cuenta? Entra para ver tus pedidos anteriores." → `web/app/checkout/page.tsx:134-138`
- `checkout.signature.note` → "Sin costo. Firmarla toma unos días más antes de que salga el envío." → `web/app/checkout/page.tsx:183-185`
- `checkout.addressNotice.body` → "En el siguiente paso firmarás el contrato de compraventa. Ten a mano tu cédula." → `web/app/checkout/page.tsx:234-236`

**Contrato**
- `checkout.invalidLink.body` → "Este enlace no lleva a ningún pedido." → `web/app/checkout/contrato/page.tsx:23` y `web/app/checkout/pagar/page.tsx:21` (misma clave, dos sitios)
- `checkout.contract.intro` → "Estos datos van en el documento que vas a firmar, así que tienen que coincidir con tu cédula." → `web/app/checkout/contrato/page.tsx:74-75`
- `checkout.contract.otpIntro` → "Te enviamos un código de seis dígitos a tu correo. Lee el documento y fírmalo con ese código." → `web/app/checkout/contrato/page.tsx:123-124`
- `checkout.contract.mustOpenNotice` → "Abre el documento para poder confirmarlo." → `web/app/checkout/contrato/page.tsx:155`
- `checkout.contract.signBeforePayNotice` → "Firmas antes de pagar. Si el pago no se completa, el contrato queda anulado." → `web/app/checkout/contrato/page.tsx:176-178`

**Pagar**
- `checkout.pay.gatewayNotice` → "Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar." → `web/app/checkout/pagar/Pay.tsx:44`
- `checkout.pay.securityNotice` → "Los datos de tu tarjeta no pasan por esta tienda." → `web/app/checkout/pagar/Pay.tsx:52`

**Resultado del pago** (título + cuerpo por cada uno de los 6 estados)
- `checkout.result.pending.title` / `checkout.result.pending.body` → "Confirmando tu pago" / "La pasarela todavía no nos ha confirmado el cobro. Esto suele tardar segundos; te escribimos al correo en cuanto quede." → `web/app/checkout/resultado/page.tsx:16-17`
- `checkout.result.paid.title` / `checkout.result.paid.body` → "Listo" / "Tu compra quedó confirmada. Te enviamos el correo con el detalle y, si compraste una pieza, el contrato firmado." → `:20-21`
- `checkout.result.failed.title` / `checkout.result.failed.body` → "El pago no se completó" / "No te cobramos nada y lo que habías apartado volvió a la tienda. Puedes intentarlo otra vez." → `:24-25`
- `checkout.result.expired.title` / `checkout.result.expired.body` → "El pedido venció" / "Pasó demasiado tiempo sin completar el pago, así que soltamos lo que tenías apartado." → `:28-29`
- `checkout.result.refunded.title` / `checkout.result.refunded.body` → "Te devolvimos el dinero" / "Alguien se adelantó con lo que compraste, así que reembolsamos el valor completo." → `:32-33`
- `checkout.result.notFound.title` / `checkout.result.notFound.body` → "No encontramos ese pedido" / "Puede que sea de otra cuenta. Mira tus pedidos para comprobarlo." → `:54-55`

**Pieza**
- `piece.detail.includesNote` → "Incluye una nota escrita por el artista y el contrato de compraventa firmado." → `web/app/piezas/[slug]/page.tsx:67-69`
- `piece.detail.soldBody` → "Esta pieza ya encontró dueño." → `:85`
- `piece.detail.notForSaleBody` → "No está a la venta." → `:85`

**Drop**
- `drop.detail.soldOutBody` → "Ya no quedan seats." → `web/app/drops/[slug]/page.tsx:75`

**Reproductor efímero**
- `watch.closed.title` → "Tu ventana se cerró." → `web/components/EphemeralPlayer.tsx:87`
- `watch.intro.title` → "Antes de reproducir" → `:101`
- `watch.intro.warning` → "Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez." → `:106`

Tres textos quedan deliberadamente fuera del editor por tener una parte
dinámica incrustada en la frase (`checkout.signature.checkboxLabel` con el
título de la pieza, `watch.closed.body` con la fecha en que se vio, y
`watch.intro.body` con el número de horas de la ventana) — ver
"Fuera de alcance".

## Arquitectura y flujo de datos

Un solo endpoint público, `GET /content`, devuelve el mapa completo de
overrides activos: `{ [key: string]: string }`. Solo contiene las claves que
el artista ya cambió — nunca las 35 completas. En cada uno de los 35 lugares
del código, el texto hardcodeado se envuelve así:

```ts
await content('home.hero.title', 'Texto original tal como está hoy')
```

Si `/content` no trae esa clave, se usa el segundo argumento — el texto que
ya existe en el código, sin cambios. Esto significa que **no hay que sembrar
nada** al lanzar la función: día uno, sin overrides, la tienda se ve
exactamente igual que hoy. El artista solo "gasta" una fila en la tabla el
día que efectivamente cambia algo.

## Lado API

### Migración y entidad

Tabla `content_overrides`:

| columna | tipo | notas |
|---|---|---|
| `key` | `varchar` PK | una de las 35 claves conocidas |
| `value` | `text` | el texto que reemplaza al original |
| `updated_at` | `timestamptz` | `now()` en cada `PUT` |
| `updated_by` | `uuid` | FK a `users.id`, quién lo cambió |

No hay tabla de versiones: el "historial" que necesita el artista es poder
volver al texto original, no ver cada cambio intermedio. Eso lo cubre el
`DELETE` (ver abajo) — borra la fila, `content()` vuelve a caer en el
fallback del código. Si más adelante se necesitan versiones múltiples por
clave, es una ampliación aparte, fuera de este alcance.

Las 35 claves y sus textos originales viven en una lista fija en el código
del API (`api/src/content/content-keys.ts` o similar), la misma tabla de
arriba — es la fuente de verdad de "qué claves existen" para el panel de
admin, independiente de si tienen override o no.

### Endpoints

- `GET /content` — público, sin auth. Devuelve `{ [key]: value }` con todas
  las filas actuales de `content_overrides`. Lo consume la tienda pública.
- `GET /admin/content` — requiere admin. Devuelve las 35 claves conocidas,
  cada una con `{ key, section, defaultValue, currentValue, hasOverride }`
  (`currentValue` es el override si existe, si no el `defaultValue`).
- `PUT /admin/content/:key` — requiere admin. Body `{ value: string }`.
  Rechaza (400, `UNKNOWN_KEY`) una clave que no esté en la lista fija de 35.
  Hace `UPSERT` con `updated_by` = el admin autenticado.
- `DELETE /admin/content/:key` — requiere admin. Borra la fila si existe
  (204 igual si no existía — restablecer algo que ya está en su valor
  original no es un error).

## Lado web

`web/lib/content.ts`, mismo patrón que `web/lib/api.ts`:

```ts
export async function content(key: string, fallback: string): Promise<string> {
  const overrides = await getOverrides();
  return overrides[key] ?? fallback;
}
```

`getOverrides()` hace `fetch('${API_URL}/content', { next: { tags: ['content'] } })`
— Next.js cachea la respuesta y la reusa entre requests hasta que algo
invalide la tag. `web/lib/studio-actions.ts` gana dos acciones nuevas,
`updateContent(key, value)` y `resetContent(key)`, que llaman
`PUT`/`DELETE /admin/content/:key` y terminan con
`revalidateTag('content')` — mismo mecanismo que ya usan `createPiece`/
`updateDrop` con `revalidatePath`, adaptado a `revalidateTag` porque el
contenido se lee desde muchas rutas a la vez, no una sola.

Como los 35 lugares están en Server Components (páginas `page.tsx` async o
funciones que ya son `async`), `content(...)` se llama con `await` directo
en el JSX. `EphemeralPlayer.tsx` es la única excepción (`'use client'`): sus
3 claves editables (`watch.closed.title`, `watch.intro.title`,
`watch.intro.warning` — las que sí llevan texto dinámico incrustado quedan
fuera, ver "Fuera de alcance") se resuelven en el `page.tsx` que lo
renderiza y se le pasan como props ya resueltas, igual que hace hoy con
cualquier otro dato del servidor.

Sin `API_URL` configurado (modo maqueta), `content()` devuelve siempre el
`fallback` — no hay overrides posibles sin API real, igual que el resto de
`lib/api.ts`.

## Panel `/studio/contenido`

Una sola pantalla, agrupada por sección exactamente como en la tabla de
arriba (Home, Artista, Marca global, Carrito, Checkout, Contrato, Pagar,
Resultado del pago, Pieza, Drop, Reproductor). Por cada uno de los 35
textos: un `<textarea>` con el valor actual (override si existe, si no el
original), un botón "Guardar" habilitado solo si el valor cambió, y un
botón "Restablecer" visible solo si esa clave tiene `hasOverride: true`.
Sin buscador ni paginación: 35 campos en una sola página con anclas por
sección es navegable sin necesitar más estructura.

Se agrega al menú de `/studio` como una entrada más, junto a "Piezas",
"Videos", "Pedidos", "Equipo".

## Pruebas

- **API:** integración para los 4 endpoints — `GET /content` sin overrides
  (mapa vacío) y con overrides; `GET /admin/content` trae las 35 con
  `hasOverride` correcto; `PUT` crea y actualiza; `DELETE` borra y es
  idempotente; los 3 endpoints de `/admin/*` devuelven 401/403 sin sesión de
  admin; `PUT` con una clave fuera de la lista fija devuelve 400
  (`UNKNOWN_KEY`).
- **Web:** `content()` con y sin override (fallback correcto); smoke test de
  que `updateContent`/`resetContent` llaman `revalidateTag('content')`.

## Fuera de alcance

- Cualquier texto no listado en las 35 claves — agregar una clave nueva más
  adelante es una tarea de una línea de código (envolver el texto en
  `content(...)`) más una fila en la lista fija del API, no un cambio de
  arquitectura.
- Los 3 textos con una parte dinámica incrustada en la frase —
  `checkout.signature.checkboxLabel` ("Quiero «{título}» firmada a mano"),
  `watch.closed.body` (con la fecha en que se vio) y `watch.intro.body` (con
  el número de horas de la ventana) — quedan fuera del editor y siguen
  hardcodeados como hoy. Sacarlos evita construir un mecanismo de
  interpolación (`vars`, validación de marcadores obligatorios) solo para 3
  textos; si más adelante se quieren editables, es una extensión aparte del
  mecanismo base descrito aquí, no algo que este editor resuelva ahora.
- Versiones múltiples por clave / deshacer más de un paso atrás.
- Edición de textos del propio panel `/studio`.
- Cualquier soporte multi-idioma — el mecanismo permite un texto por clave,
  no un texto por idioma.
- Vista previa en vivo dentro del panel — se guarda y se ve reflejado en la
  tienda real, no hay una vista previa aparte.
