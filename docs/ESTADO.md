# Estado del proyecto

Última actualización: 14 de agosto de 2026

Este documento existe para retomar el trabajo sin contexto previo. Si algo aquí
contradice al código, manda el código: actualiza esto.

---

## Qué es

Tienda de un artista —**Toryteler**— donde se venden dos cosas en el mismo
carrito:

- **Piezas físicas**: bocetos, pruebas de portada, objetos del artista. La
  mayoría irrepetibles (una unidad), pero puede haber ediciones de varias. Cada
  compra incluye una nota personal del artista y un contrato de compraventa
  firmado electrónicamente antes de pagar.
- **Videos efímeros**: máster de una maqueta, una historia contada a cámara. Se
  venden con aforo limitado y **se ven una sola vez**: al darle play se abre una
  ventana de 24 o 48 horas y, cuando se cierra, no vuelve a abrirse.

Un artista, público colombiano, pagos en pesos. Estética monocroma minimalista;
la referencia es la sobriedad de yeezy.com.

## Dónde está

- Repo: https://github.com/santiago2904/toryteler — monorepo `web/` + `api/`
- Front desplegado en Vercel, *Root Directory* = `web`. Cada push a `main`
  actualiza producción.
- **`API_URL` no está definida en Vercel a propósito**: sin ella el front corre
  con datos simulados, que es lo que se quiere para enseñarlo.
- La API no está desplegada todavía.

---

## Front — 18 pantallas, conectado a la API

**Tienda:** `/` · `/piezas/[slug]` · `/drops/[slug]` · `/artista` · `/cuenta` ·
`/carrito` · `/ver/[id]`

**Compra:** `/entrar` · `/auth/verify` · `/checkout` · `/checkout/contrato` ·
`/checkout/pagar` · `/checkout/resultado`

**Studio:** `/studio` · `/studio/nuevo/pieza` · `/studio/nuevo/video` ·
`/studio/pieza/[slug]` · `/studio/video/[slug]` · `/studio/pedidos`

Con `API_URL` definida, el front lee y escribe contra la API de verdad. Sin
ella cae a `web/lib/mock-data.ts`, que es como corre el despliegue de Vercel.

Las escrituras pasan por `web/lib/checkout-actions.ts`: server actions, no
`fetch` desde el navegador, porque la cookie de sesión es `httpOnly` y la
dirección de la API no tiene por qué salir del servidor. Devuelven un resultado
en vez de lanzar: un código vencido o una pieza que alguien se llevó son
respuestas normales de un formulario, cada una con su frase.

**El flujo completo está probado a mano** contra la API y la base: entrar →
pedido → contrato firmado con código → URL de Wompi → webhook aprobado →
pedido pagado, contrato ejecutado, acceso emitido y stock en cero. Reenviar el
webhook no duplicó nada.

### Lo que sigue sin conectar

El panel ya publica piezas y videos, con sus archivos. Nada de eso pasa por la
API: las fotos van del navegador a Cloudinary con una firma, y los videos a
Cloudflare con una URL de un solo uso. Reenviarlos costaría tener el archivo en
memoria y pagar los bytes dos veces.
- **`web/lib/mock-data.ts` sigue ahí** a propósito: es lo que mantiene vivo el
  despliegue de Vercel mientras la API no esté desplegada.

---

## API — las 12 tareas, 142 pruebas de integración

Plan: `docs/superpowers/plans/2026-08-13-api-nucleo.md`. NestJS + Postgres +
TypeORM, pruebas contra un Postgres real en Docker.

| # | Tarea | Estado |
|---|---|---|
| 1 | Esqueleto, Postgres de pruebas, `users` y `pieces` | hecha |
| 2 | Inventario: `take()` / `release()` | hecha |
| 3 | Aforo de videos con bloqueo de fila | hecha |
| 4 | Idempotencia de escritura | hecha |
| 5 | Magic link, sesión y OTP | hecha |
| 6 | Crear pedido | hecha |
| 7 | Contrato en PDF, firma y acta de evidencias | hecha |
| 8 | Pagos con `PaymentGateway` intercambiable + Wompi | hecha |
| 9 | Reconciliación de pagos y expiración de pedidos | hecha |
| 10 | Visionado: abrir ventana y firmar acceso al video | hecha |
| 11 | Endpoints de lectura pública y de cuenta | hecha |
| 12 | Administración del artista con guard de rol | hecha |

### Endpoints que expone

**Públicos:** `GET /pieces` · `GET /pieces/:slug` · `GET /drops` ·
`GET /drops/:slug` · `POST /auth/magic-link` · `POST /auth/redeem` ·
`POST /payments/webhook`

**Con sesión:** `GET /me` · `POST /orders` · `POST /orders/:id/contract` ·
`POST /contracts/:id/sign` · `POST /orders/:id/pay` ·
`POST /entitlements/:id/play` · `GET /me/orders` · `GET /me/entitlements` ·
`GET /me/entitlements/:id`

**Solo el artista** (`SessionGuard` + `AdminGuard`): `GET /admin/pieces` ·
`GET /admin/pieces/:slug` · `POST|PATCH /admin/pieces` · `GET /admin/drops` ·
`GET /admin/drops/:slug` · `POST|PATCH /admin/drops` ·
`PATCH /admin/{pieces,drops}/:id/listed` · `POST /admin/uploads/signature` ·
`GET /admin/orders` · `POST /admin/orders/:id/ship` · `GET /admin/contracts`

Los de lectura del panel existen aparte de los públicos porque estos últimos
esconden los borradores —que es lo que los hace borradores—, así que una pieza
recién guardada sería invisible incluso para quien la escribió.

La sesión viaja como `Authorization: Bearer`, que es lo que manda el front. El
guard también acepta una cookie `session`, pero **no hay `cookie-parser`
montado**, así que ese camino no funciona todavía.

---

## Lo siguiente que hay que hacer

1. **Conectar el `/studio`** a los endpoints de `/admin`, incluida la subida de
   imágenes y video a Cloudinary.
2. **Desplegar la API** y crear el usuario artista (`UPDATE users SET is_admin
   = true`), sin el cual `/studio` no tiene a nadie que lo abra.
3. **Verificar un dominio en Resend.** Hoy los correos salen desde
   `onboarding@resend.dev`, que solo entrega a la dirección dueña de la cuenta:
   ningún comprador recibiría su enlace de acceso. Es lo único que falta para
   poder vender.
4. Definir `API_URL` en Vercel y borrar `web/lib/mock-data.ts`.
5. Reemplazar las imágenes de ejemplo, que son portadas de discos reales.

---

## Decisiones que no se reabren

| Decisión | Por qué |
|---|---|
| In-house, no Shopify | No resuelve el contenido efímero ni la firma en checkout, y dejaría dos sistemas con dos identidades |
| Un solo artista | Sin payouts multiparte, sin KYC de vendedores |
| Monorepo `web/` + `api/` | Una persona sola: un clon, los tipos a la vista |
| Código en inglés, producto en español | Las URLs las lee el público colombiano |
| El precio mínimo no se impone | El gesto artístico manda sobre el margen; el panel informa, no restringe |
| Prueba primero solo en el núcleo | Invariantes, idempotencia, firma y pagos. El resto va directo |
| Sin subastas, sin Q&A, sin reventa | Fuera de la fase 1 |

### Reglas técnicas que sostienen el sistema

- **Todo estado peligroso vive en Postgres, protegido por constraints.** Un
  «leer, verificar, escribir» en TypeScript vende de más tarde o temprano.
- **El inventario se descuenta con un `UPDATE` condicional** (`stock = stock - 1
  WHERE stock > 0`). No hay estado `reserved`. La devolución ocurre en la
  liquidación del pago y en la reconciliación.
- **El aforo se serializa bloqueando la fila del video** antes de contar. Sin el
  bloqueo, el límite es una sugerencia.
- **Todo endpoint que mueva dinero o entregue acceso es reintentable.**
- **Se firma antes de pagar**: al revés existiría un instante con dinero cobrado
  y sin contrato.
- **Los precios se releen de la base.** El navegador manda identificadores.
- **La URL del video se entrega solo al abrir la ventana.** Nunca en la página:
  aunque el reproductor no se dibuje, lo que recibe la página acaba en su código
  fuente.
- **Despublicar retira de la tienda y nada más.** Quien compró conserva su
  acceso. La capacidad sube pero nunca baja de lo vendido.
- **El rol se lee de la base en cada petición**, nunca del token. Quitarle el
  rol a alguien surte efecto en su siguiente clic, no cuando venza su sesión.
- **Quien no es el artista recibe 404 en `/studio`, no 403.** La segunda
  respuesta le cuenta que hay un panel que vale la pena forzar.
- **Hay una sola puerta de entrada.** No existe un acceso aparte para el
  artista: la diferencia la hace la cuenta, no el formulario, y se nota después
  de entrar —el artista aterriza en el studio, el resto en su cuenta—. El enlace
  al panel vive en `/cuenta` y no en la cabecera: ponerlo ahí obligaría a leer
  la sesión en todas las páginas y volvería la tienda entera dinámica por un
  enlace que ve una sola persona.
- **Nada fuera de `api/src/payments/wompi/` conoce Wompi.** `PaymentGateway`
  normaliza estado, referencia e id de evento.

### Trampas ya descubiertas, con su solución en el código

- **TypeORM 1.x** devuelve `[filas, afectadas]` en `UPDATE`/`DELETE`, y **nada
  en un `INSERT ... ON CONFLICT` sin `RETURNING`**. Todo pasa por
  `api/src/database/rows.ts`. Las pruebas negativas pasan igual, así que el
  fallo es silencioso.
- **Wompi:** checksum del webhook en MAYÚSCULAS, firma de integridad sobre
  centavos, y evento identificado por transacción **y** estado. Detalles en
  `docs/wompi/README.md`.
- **`<dialog>`**: cualquier `display` en su regla base anula el `display: none`
  del navegador y pinta todos los diálogos a la vez.
- **`overflow-x: hidden` en `body`** convierte el body en contenedor de scroll y
  rompe `position: sticky`. Usar `clip`.
- **`animation-fill-mode: both`** deja un transform permanente que descentra
  cualquier modal dentro. Usar `backwards`.
- **Las dos vías de liquidación tienen que producir la misma clave.** Wompi
  llama `VOIDED` a lo que aquí es `DECLINED`; con la palabra cruda como clave,
  un webhook tardío liquidaba dos veces y devolvía al inventario una unidad que
  nadie había devuelto. Todo pasa por `PaymentGateway.eventIdFor()`.
- **Un tipo usado en una firma decorada se importa con `import type`**, o
  `isolatedModules` + `emitDecoratorMetadata` rompen la compilación.
- **`inet::text` devuelve `190.0.0.1/32`.** Para el valor sin máscara, `host()`.
- **Abrir la ventana y firmar la URL van en la misma transacción.** Firmar es
  una llamada de red y puede fallar; si fallaba después de abrir, el comprador
  quemaba su única oportunidad sin ver un fotograma. Sin URL, no hay ventana.
- **`requireSignedURLs` se pone al reservar la subida**, no después. Así el
  video no es público ni en el hueco entre que llega el archivo y alguien se
  acuerda de protegerlo.
- **Un video no se puede reproducir en cuanto se sube:** Cloudflare lo procesa
  después, y publicarlo antes vende un cupo a una pantalla negra. El formulario
  espera a `readyToStream`, y si tarda demasiado guarda igual y lo dice.
- **Subir por POST tiene un techo de 200 MB.** Más grande exige el protocolo
  tus, que es otra dependencia; por ahora se avisa y se pide exportar más
  liviano.
- **Cloudflare Stream:** el host es `customer-<CODE>.cloudflarestream.com` y el
  código es de la cuenta, no hay uno genérico. El token firmado va **en lugar**
  del id del video. Y **nada de esto protege un video sin `requireSignedURLs`**:
  esa bandera es la que hace que el id por sí solo deje de servir, se pone al
  subirlo y tarda un par de minutos en propagarse.
- **El manifiesto es HLS y solo Safari lo reproduce nativo.** El resto necesita
  `hls.js`, que se importa dentro del efecto para no cargarlo donde no hace
  falta. Servir un MP4 sería más simple pero entrega un archivo, y un archivo
  que se reproduce es uno que se guarda.
- **Resend exige un dominio verificado como remitente.** Un Gmail no vale y
  nunca valdrá: `MAIL_FROM` tiene que ser un dominio propio. `MAIL_REPLY_TO` sí
  acepta cualquier dirección, porque nadie demuestra ser dueño de donde caen
  las respuestas.
- **Las pruebas leen el mismo `.env` que el desarrollo.** En cuanto entraron
  credenciales reales, una prueba que registra un usuario empezó a mandar
  correo de verdad. `api/test/setup/env.ts` neutraliza lo que cuesta dinero o
  sale de la máquina; todo lo de esa clase va ahí.

---

## Cómo correr

```bash
# Bases de datos (desde la raíz). Son dos y a propósito:
docker compose up -d                                # desarrollo, en disco, 5434
docker compose -f docker-compose.test.yml up -d     # pruebas, en memoria, 5433

# API — http://localhost:3000
cd api && npm install
npm run seed:fresh                                  # vacía y siembra la tienda
npm run start:dev
npx jest                                            # 144 pruebas
npm run build                                       # comprobación de tipos

# Front — http://localhost:3001
cd web && npm install && npm run dev -- -p 3001
npx jest                                            # 14 pruebas
```

Las pruebas usan su propia base y lo hacen ellas solas: `api/test/setup/env.ts`
fuerza `DATABASE_URL` a la de pruebas pase lo que pase en `.env`. Antes
compartían base con el desarrollo y correr la suite borraba en silencio lo
sembrado; el fallo aparecía una hora después y en otro sitio.

Para que el front hable con la API hace falta `web/.env.local` con
`API_URL=http://localhost:3000` (está en `.gitignore`). Sin ese archivo, el
front corre con datos simulados.

Los correos se registran en la consola de la API con su cuerpo entero mientras
`RESEND_API_KEY` sea el de ejemplo. Ahí salen el enlace de acceso y el código
para firmar, que es la única forma de recorrer el flujo a mano.

`npm run seed` deja la tienda con las 10 piezas y los 3 videos que se
maquetaron, dos cuentas —`tory@toryteler.co` es el artista y abre `/studio`,
`comprador@toryteler.co` tiene pedidos y los tres estados de un video— y el
público inventado que hace que los cupos vendidos sean un número real y no un
texto. Correrlo dos veces no duplica nada; `seed:fresh` vacía antes, que es lo
que hace falta después de trastear a mano. Se niega a correr con
`NODE_ENV=production`.

`api/.env` se copia de `api/.env.example`; con las credenciales de ejemplo, el
correo y la subida de PDF se simulan en consola en vez de fallar.

---

## Deuda declarada y avisos

- **`/studio` en el despliegue de Vercel sigue abierto**, y es a propósito: sin
  API no hay sesiones que comprobar, así que los datos simulados responden que
  quien mira es el artista. Con `API_URL` definida manda `GET /me` y quien no
  lo sea recibe un 404.
- **`/cuenta` con datos simulados** muestra pedidos de ejemplo a cualquiera. Con
  la API conectada exige sesión.
- **Las imágenes de ejemplo son portadas de discos reales** atribuidas a un
  artista ficticio. **No pueden quedarse** en una tienda pública.
- **El texto del contrato necesita revisión de un abogado.** Está versionado
  (`consent_text_version`), así que cambiarlo no afecta a lo ya firmado.
- **La cuenta comercial de Wompi tarda semanas.** Todo va contra el sandbox.
- **Deduplicación de correos en memoria**: basta con una instancia.
- **Wompi soporta ocho métodos de pago**; `orders` solo admite tres porque el
  plazo depende del método. Ampliarlo es añadirlo al `CHECK` y decidir su plazo.
- **La cuenta activa de `gh` se revierte a la del trabajo** entre sesiones y el
  push da 403. Comprobar con `gh api user --jq .login`, no con `auth status`,
  que puede mentir. Arreglo: `gh auth switch --user santiago2904`.

---

## Cómo se ha trabajado

Ciclo de Superpowers: brainstorming → spec → plan → ejecución. Los documentos de
`docs/superpowers/` se mantienen al día; cuando el código y un plan difieren, se
anota en el plan y manda el código.

Commits en español, formato convencional, con el motivo de la decisión en el
cuerpo cuando no es obvio. Los atajos deliberados llevan un comentario `lazy:`
que dice hasta dónde llegan y cuál es el camino de salida.
