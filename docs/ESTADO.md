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

## Front — 13 pantallas, con datos simulados

**Tienda:** `/` · `/piezas/[slug]` · `/drops/[slug]` · `/artista` · `/cuenta` ·
`/carrito` · `/ver/[id]`

**Studio:** `/studio` · `/studio/nuevo/pieza` · `/studio/nuevo/video` ·
`/studio/pieza/[slug]` · `/studio/video/[slug]` · `/studio/pedidos`

Lo único que funciona de verdad es el carrito (vive en el navegador), el cálculo
de comisión, la ventana de visionado simulada y el reproductor. Todo lo demás
lee de `web/lib/mock-data.ts`. 14 pruebas de lógica pura.

### Faltan 5 pantallas, todas del flujo de compra

`/entrar` · `/checkout` · `/checkout/contrato` · `/checkout/pagar` ·
`/checkout/resultado`

Crean un pedido, descuentan inventario, firman y cobran: maquetarlas sería
escribir código para tirarlo. **Ya se pueden construir**: la API tiene los
servicios que necesitan.

---

## API — 8 de 12 tareas, 76 pruebas de integración

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
| 9 | Reconciliación de pagos y expiración de pedidos | **falta** |
| 10 | Visionado: abrir ventana y firmar acceso al video | **falta** |
| 11 | Endpoints de lectura pública y de cuenta | **falta** |
| 12 | Administración del artista con guard de rol | **falta** |

### Lo que falta además de esas cuatro tareas

**La API no expone ni un endpoint todavía.** Existen los servicios, las
migraciones y las pruebas, pero no hay controladores ni módulos cableados en
`app.module.ts`, que solo carga configuración y TypeORM. El cableado va con las
tareas 11 y 12.

Tampoco está el proxy `/api/*` del front hacia la API, ni el borrado de
`web/lib/mock-data.ts` y `web/app/api/mock-playback/`.

---

## Lo siguiente que hay que hacer

1. **Arrancar Docker Desktop** y levantar el Postgres de pruebas:
   `docker compose -f docker-compose.test.yml up -d`
2. Tarea 9: reconciliación. Un cron cada 10 minutos que busca pedidos `pending`
   con más de su plazo, pregunta a la pasarela y liquida o expira devolviendo
   inventario. Es el único proceso periódico del sistema.
3. Tarea 10: `POST /entitlements/:id/play` — abre la ventana con un `UPDATE`
   condicional y devuelve una URL firmada de Cloudflare Stream.
4. Tareas 11 y 12: endpoints de lectura y administración, y el cableado de
   controladores y módulos.
5. Conectar: `API_URL` en el front, borrar los simulados, construir las 5
   pantallas del checkout.

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

---

## Cómo correr

```bash
# Front
cd web && npm install && npm run dev -- -p 3001    # http://localhost:3001
npx jest                                            # 14 pruebas

# API
docker compose -f docker-compose.test.yml up -d     # desde la raíz
cd api && npm install && npx jest                   # 76 pruebas
npm run build                                       # comprobación de tipos
```

`api/.env` se copia de `api/.env.example`; con las credenciales de ejemplo, el
correo y la subida de PDF se simulan en consola en vez de fallar.

---

## Deuda declarada y avisos

- **`/studio` no tiene control de acceso** y está público en Vercel. El guard de
  rol es la tarea 12.
- **`/cuenta` no tiene sesión**: muestra los pedidos simulados a cualquiera.
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
