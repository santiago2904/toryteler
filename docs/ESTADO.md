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
  compra incluye una nota personal escrita a mano por el artista y un contrato
  de compraventa firmado electrónicamente antes de pagar.
- **Videos efímeros**: máster de una maqueta, una historia contada a cámara. Se
  venden con aforo limitado y **se ven una sola vez**: al darle play se abre una
  ventana de 24 o 48 horas y, cuando se cierra, no vuelve a abrirse.

Un artista, público colombiano, pagos en pesos. Estética monocroma minimalista;
la referencia es la sobriedad de yeezy.com.

## Dónde está

- Repo: https://github.com/santiago2904/toryteler
- Front desplegado en Vercel, con *Root Directory* = `web`. Cada push a `main`
  actualiza producción.
- **`API_URL` no está definida en Vercel a propósito**: sin ella el front corre
  con datos simulados, que es lo que se quiere para enseñarlo.

---

## Estado: front hecho, API sin empezar

### Front — 13 pantallas funcionando con datos simulados

**Tienda:** `/` · `/piezas/[slug]` · `/drops/[slug]` · `/artista` · `/cuenta` ·
`/carrito` · `/ver/[id]`

**Studio:** `/studio` · `/studio/nuevo/pieza` · `/studio/nuevo/video` ·
`/studio/pieza/[slug]` · `/studio/video/[slug]` · `/studio/pedidos`

Lo único que funciona de verdad es el carrito (vive en el navegador), el cálculo
de comisión y la ventana de visionado simulada. Todo lo demás lee de
`web/lib/mock-data.ts`.

### Faltan 5 pantallas, todas del flujo de compra

`/entrar` · `/checkout` · `/checkout/contrato` · `/checkout/pagar` ·
`/checkout/resultado`

No se pueden maquetar de forma útil: crean un pedido, descuentan inventario,
firman un contrato y cobran. Simularlas es escribir código para tirarlo.

### API — nada construido

El plan está en `docs/superpowers/plans/2026-08-13-api-nucleo.md`: 12 tareas,
NestJS + Postgres + TypeORM. **Es el siguiente paso** y desbloquea las 5
pantallas restantes.

---

## Lo siguiente que hay que hacer

1. **Arrancar Docker Desktop.** La tarea 1 de la API levanta un Postgres de
   pruebas con `docker compose`, y sin el demonio corriendo no empieza.
2. Ejecutar el plan de la API tarea por tarea. Prueba primero solo en el núcleo
   —tareas 2, 3, 4, 7, 8 y 10—; el resto se implementa directo.
3. Al terminar la API: definir `API_URL` en el front, borrar
   `web/lib/mock-data.ts` y el endpoint `web/app/api/mock-playback/`, y
   construir las 5 pantallas del checkout.

---

## Decisiones que no se reabren

Están razonadas en el spec; aquí solo el resumen para no volver a discutirlas.

| Decisión | Por qué |
|---|---|
| In-house, no Shopify | Shopify no resuelve el contenido efímero ni la firma en checkout, y dejaría dos sistemas con dos identidades de usuario |
| Un solo artista | Sin payouts multiparte, sin KYC de vendedores, sin responsabilidad de marketplace |
| Monorepo `web/` + `api/` | Una persona sola: un clon, los tipos a la vista, un commit para cambios que tocan ambos lados |
| Código en inglés, producto en español | Convención habitual; las URLs las lee y comparte el público colombiano |
| El precio mínimo no se impone | El gesto artístico manda sobre el margen. El panel informa de la comisión, no la restringe |
| Sin subastas, sin Q&A, sin reventa | Fuera de la fase 1 |

### Reglas técnicas que sostienen el sistema

- **Todo estado peligroso vive en Postgres, protegido por constraints.** Nunca
  en memoria de la aplicación. Cualquier "leer, verificar, escribir" en
  TypeScript vende de más tarde o temprano.
- **El inventario se descuenta con un `UPDATE` condicional** (`stock = stock - 1
  WHERE stock > 0`). No hay estado `reserved`; el plazo vive en la antigüedad
  del pedido. La devolución del stock ocurre en la reconciliación de pagos.
- **Todo endpoint que mueva dinero o entregue acceso es reintentable** sin
  consecuencias. Idempotencia en cuatro puntos: clave de idempotencia,
  webhooks, transiciones condicionales y claves naturales para PDF y correos.
- **Se firma antes de pagar.** Firmando después existiría un instante con dinero
  cobrado y sin contrato.
- **La URL del video se entrega solo al abrir la ventana**, como respuesta de
  `POST /entitlements/:id/play`. Nunca dentro de la página: aunque el
  reproductor no se dibuje, cualquier dato que reciba la página acaba en su
  código fuente.
- **Despublicar retira de la tienda y nada más.** Quien ya compró conserva su
  pedido y su acceso. La capacidad de un video sube libremente pero nunca baja
  de lo ya vendido.
- **Los precios se releen siempre de la base de datos.** Lo que manda el
  navegador son identificadores, nunca importes.
- **Un solo proceso periódico** en todo el sistema: la reconciliación de pagos
  contra Wompi, que además devuelve el inventario abandonado.

---

## Cómo correr el front

```bash
cd web
npm install
npm run dev -- -p 3001     # http://localhost:3001
npx jest                   # 14 pruebas de lógica pura
npm run build              # comprobación de tipos incluida
```

`web/.env.local` solo necesita el nombre de la cuenta de Cloudinary, que es
público y ya va como valor por defecto en el código.

### Lenguaje visual

Vive en `web/app/globals.scss` y está descrito en el spec §11. Dos temas —claro
por defecto, oscuro si el sistema lo pide— con cuatro colores cada uno, Inter
en dos pesos, radio de borde 0 y cero sombras en todo el proyecto. Los colores
son custom properties nativas: **nunca variables de SCSS**, o el cambio de tema
dejaría de funcionar.

---

## Deuda declarada y avisos

- **`/studio` no tiene control de acceso** y está público en Vercel. Hoy no
  guarda nada, pero el guard de rol tiene que existir antes del primer endpoint
  real (tarea 12 del plan de la API).
- **`/cuenta` no tiene sesión**: muestra los pedidos simulados a cualquiera.
- **Las imágenes de ejemplo son portadas de discos reales** (Pink Floyd,
  Rihanna, Rolling Stones) atribuidas a un artista ficticio. Sirven para
  maquetar; **no pueden quedarse** en una tienda pública. Sustituirlas antes de
  cualquier lanzamiento.
- **Los videos de ejemplo están en HEVC** y pesan decenas de megas. Cloudinary
  los transcodifica al vuelo a H.264 en la URL; los originales no se tocan.
- **El texto del contrato necesita revisión de un abogado** antes de publicar.
  El sistema ya versiona ese texto (`consent_text_version`).
- **La cuenta comercial de Wompi tarda semanas.** Todo el desarrollo va contra
  el sandbox; el trámite bloquea el lanzamiento, no el trabajo.
- **Deduplicación de correos en memoria** en el plan de la API: basta con una
  instancia, hay que moverla a tabla si escala horizontalmente.

---

## Cómo se ha trabajado

Ciclo de Superpowers: brainstorming → spec → plan → ejecución. Los tres
documentos de `docs/superpowers/` se mantienen al día; cuando el código y un
plan difieren, se anota en el plan y manda el código.

Commits en español, formato convencional (`feat(web):`, `fix(api):`), con el
motivo de la decisión en el cuerpo cuando no es obvio.

Los atajos deliberados se marcan con un comentario `lazy:` que dice hasta dónde
llega y cuál es el camino de salida.
