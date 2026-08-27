# Pagos en USD vía Stripe

Extiende `docs/superpowers/specs/2026-08-13-tienda-artista-design.md`. Donde
este documento no dice algo, manda el original.

## 1. Qué cambia y por qué

Toryteler empieza a vender a compradores internacionales, no solo
colombianos. Wompi no cobra en dólares — es una pasarela pensada para el
mercado colombiano. Se agrega Stripe como la pasarela activa, cobrando en
USD.

**Wompi no se borra.** `PaymentGateway` ya existía como interfaz
intercambiable a propósito ("nada fuera de `api/src/payments/wompi/` conoce
Wompi", spec original §9). Stripe se suma como una segunda implementación,
hermana de Wompi, y una variable de entorno decide cuál está activa en el
backend. Volver a vender en pesos más adelante no exige rehacer la
integración con Wompi — la parte cara, firma y checksum incluidos — solo esa
variable más un par de ajustes chicos de UI en el front (§5).

## 2. Decisiones tomadas en esta sesión

| Decisión | Razón |
|---|---|
| Reemplazo completo en el front: solo Stripe/USD, Wompi queda dormido | El público ahora es internacional; no hay convivencia de monedas en un mismo pedido |
| `PAYMENT_PROVIDER=stripe\|wompi` decide la pasarela activa, no un flag por pedido | Un solo mercado a la vez; simplifica todo lo demás (moneda de la base, plazos, UI) |
| Columnas de dinero pasan a centavos de dólar (`*_usd_cents`) | Stripe cobra en centavos reales; los pesos existentes no tienen equivalente automático en dólares — hay que volver a poner precio a mano desde `/studio` |
| El checkout deja de preguntar el método de pago | Stripe Checkout ya ofrece sus propios medios en su página; `PSE`/`NEQUI` solo tenían sentido para Wompi |
| El contrato sigue en español, con la Ley 1480 colombiana intacta | Ya es deuda declarada ("el texto necesita revisión de un abogado"); esto se suma a esa deuda, no la duplica. Se sigue vendiendo mientras se resuelve con un abogado de verdad |
| Se agrega `country` a la dirección de envío | Sin esto una pieza física vendida a alguien fuera de Colombia no tiene a dónde enviarse |
| Las pruebas del núcleo de pagos dejan de depender de un gateway real | Con dos pasarelas activas o inactivas según el entorno, el núcleo (idempotencia, aforo, reconciliación) no debe casarse con ninguna |

## 3. La interfaz `PaymentGateway`

Dos cambios, ambos para que Stripe quepa sin forzar nada:

```ts
export interface CheckoutRequest {
  reference: string;
  amountInCents: number;   // antes: amountCop. Stripe cobra en centavos reales.
  customerEmail: string;
  redirectUrl: string;
}

export abstract class PaymentGateway {
  abstract buildCheckoutUrl(request: CheckoutRequest): Promise<string>; // antes: string
  abstract verifyWebhook(body: unknown): boolean;
  abstract parseWebhook(body: unknown): PaymentEvent;
  abstract eventIdFor(transactionId: string, status: PaymentStatus): string;
  abstract fetchTransaction(transactionId: string): Promise<{...}>;
  abstract findByReference(reference: string): Promise<{...} | null>;
}
```

`buildCheckoutUrl` pasa a `Promise<string>` porque Stripe no arma una URL
firmada a mano como Wompi — crea una *Checkout Session* con una llamada a su
API, y esa llamada es async. `WompiGateway.buildCheckoutUrl` sigue haciendo
exactamente lo mismo, solo que ahora la firma del método dice `async` y
envuelve su valor de siempre en una promesa resuelta. Su único llamador,
`PaymentsService.startPayment()`, gana un `await`.

`amountCop` se renombra a `amountInCents`: ya es el nombre que usa
`PaymentEvent` para lo mismo, y es lo que de verdad necesita Stripe — pesos
colombianos no tienen centavos en la práctica, pero dólares sí, y la
interfaz no puede seguir llamándose por una moneda que ya no es la única.
`WompiGateway` sigue multiplicando por 100 internamente para su propio
formato (Wompi exige `amount_in_cents` aunque el resultado sean pesos
enteros ×100); ese detalle es suyo y no sale de su archivo.

## 4. `api/src/payments/stripe/stripe.gateway.ts`

Implementación nueva, hermana de `wompi.gateway.ts`, sin que nada fuera de
esta carpeta sepa que existe Stripe:

- **`buildCheckoutUrl`**: `stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price_data: { currency: 'usd', unit_amount: request.amountInCents, product_data: { name: ... } }, quantity: 1 }], customer_email: request.customerEmail, success_url: request.redirectUrl, cancel_url: ... })`, devuelve `session.url`.
- **`verifyWebhook`**: `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)` — necesita el **cuerpo crudo** de la petición, no el JSON ya parseado (ver §7).
- **`parseWebhook`**: traduce `checkout.session.completed` → `APPROVED`, `checkout.session.expired` / `payment_intent.payment_failed` → `DECLINED`, cualquier otro → ignorado (equivalente a `PENDING`). `providerEventId` es el `event.id` de Stripe (`evt_...`), que ya viene deduplicado por Stripe pero se vuelve a verificar contra `payment_events` igual que con Wompi — la garantía vive en nuestra base, no confiada al proveedor.
- **`eventIdFor`**: igual que Wompi, `` `${transactionId}:${status}` `` — mismo formato, mismo propósito (dos vías de liquidación, misma clave).
- **`fetchTransaction` / `findByReference`**: `stripe.checkout.sessions.retrieve(id)` / `stripe.checkout.sessions.list({ payment_intent: ... })` según haga falta para el flujo de confirmación al volver de pagar (`POST /orders/:id/confirm`, spec original §12).

## 5. Selección de pasarela

```ts
// app.module.ts
{
  provide: PaymentGateway,
  useFactory: (config: ConfigService) =>
    config.get('PAYMENT_PROVIDER') === 'wompi'
      ? new WompiGateway(config)
      : new StripeGateway(config),
  inject: [ConfigService],
}
```

`PAYMENT_PROVIDER` por defecto `stripe`. Cambiar a `wompi` resucita la
*lógica* de pesos completa sin tocar una línea de código de pagos — que es
la parte cara de rehacer (firma, checksum, mapeo de eventos). Lo que sí
sigue hardcodeado en el front por la decisión de esta sesión (§2, reemplazo
completo) es el formato del precio en dólares y que no se muestra el
selector de método de pago (§6): volver a vender en pesos de verdad exige
además esos dos cambios de UI, chicos y mecánicos, no una reconstrucción de
la integración de pagos.

## 6. Checkout sin selector de método

Con Stripe activo, `/checkout` deja de mostrar «Cómo pagas» (Tarjeta / Nequi
/ PSE). El pedido se crea con `paymentMethod: 'CARD'` fijo — Stripe Checkout
ya ofrece sus propios medios dentro de su página, y `PSE`/`NEQUI` no
significan nada para Stripe.

`orders.payment_method` y su `CHECK` no cambian: siguen aceptando los tres
valores porque Wompi, dormido, los sigue necesitando. El plazo de expiración
(`ORDER_DEADLINE_MINUTES.CARD = 15`, spec original §5) se reutiliza tal cual.

## 7. El webhook de Stripe necesita el cuerpo crudo

Nest parsea el `Content-Type: application/json` a un objeto antes de que el
controlador lo vea. La verificación de firma de Stripe
(`stripe.webhooks.constructEvent`) necesita los **bytes exactos** que Stripe
firmó — un objeto ya parseado y vuelto a serializar no produce el mismo
hash. La ruta `POST /payments/webhook` necesita el cuerpo crudo disponible
solo para Stripe (Wompi firma sobre el JSON, sin este problema).

Solución: `NestFactory.create(AppModule, { rawBody: true })` en `main.ts`,
que expone `req.rawBody` sin desactivar el parseo normal para el resto de
rutas; `PaymentsController.webhook` pasa `req.rawBody` (no `body`) al
gateway activo. `WompiGateway.verifyWebhook` sigue recibiendo el body
parseado — cada gateway declara qué forma necesita.

Documentado en `docs/stripe/README.md` (nuevo), espejo de
`docs/wompi/README.md`: cuerpo crudo, moneda `usd`, evento identificado por
`checkout.session.id` + tipo de evento, y las claves de prueba (`sk_test_…`)
y el CLI (`stripe listen --forward-to`) para probar webhooks en local.

## 8. Moneda en la base de datos

Migración nueva (no transforma valores, solo columnas — un peso no tiene
equivalente automático en dólares):

| Antes | Después |
|---|---|
| `pieces.price_cop` | `pieces.price_usd_cents` |
| `drops.price_cop` | `drops.price_usd_cents` |
| `orders.total_cop` | `orders.total_usd_cents` |
| `order_items.unit_price_cop` | `order_items.unit_price_usd_cents` |

Los `CHECK (... > 0)` se renombran junto con la columna, sin cambiar la
condición. **Después de desplegar, cada pieza y video publicado necesita que
alguien le vuelva a poner precio desde `/studio`** — los enteros que hoy
dicen "250000" significaban pesos; como centavos de dólar serían $2.500,00,
que no es lo que nadie quiso decir.

`PriceInput.tsx` (panel) sigue pidiendo un número al artista (ej. escribe
`25`) y lo envía multiplicado por 100 (`2500`) a `POST/PATCH /admin/pieces`
y `/admin/drops`. `formatPrice` en `web/lib/format.ts`:

```ts
export function formatPrice(usdCents: number): string {
  return `$${(usdCents / 100).toFixed(2)} USD`;
}
```

Se pierde el `Intl.NumberFormat('es-CO', ...)` porque ya no aplica — el
separador de miles/decimales de dólares es distinto al de pesos. El resto
del copy de la tienda sigue en español (spec original: "el producto en
español"); esto es solo el formato del número, no un cambio de idioma del
sitio.

`web/lib/fees.ts` (`FLAT_COP`, `SUGGESTED_PRICE_COP`) se renombra en el
mismo sentido (`FLAT_USD_CENTS`, `SUGGESTED_PRICE_USD_CENTS`) con los montos
convertidos a una sugerencia razonable en dólares — cifra a decidir con el
artista al implementar, no una conversión automática de pesos.

`ContractPdfService` dibuja el precio en el PDF: cambia el formateo de
`Intl.NumberFormat('es-CO')` + `"COP"` a dólares, mismo patrón que
`formatPrice`. El resto del texto legal no se toca (§2).

## 9. Envío internacional

```ts
class ShippingAddressDto {
  @IsString() line1!: string;
  @IsString() city!: string;
  @IsString() country!: string;   // nuevo
  @IsString() phone!: string;
}
```

Sin migración: `orders.shipping_address` ya es `jsonb`. El formulario de
`/checkout` gana un campo «País»; se muestra donde ya se muestra la
dirección — recibo, `/cuenta`, `/studio/pedidos`.

## 10. Pruebas: una pasarela falsa para el núcleo

Hoy `payment-settlement.spec.ts` y `reconciliation.spec.ts` instancian
`WompiGateway` de verdad y firman webhooks reales con un helper `wompiEvent()`
— acoplan el núcleo de liquidación (idempotencia, aforo, reembolsos) a los
detalles de una pasarela concreta. Con dos pasarelas activables por
configuración, ese acoplamiento ya no tiene sentido.

Se agrega `test/setup/fake-payment-gateway.ts`: una clase que implementa
`PaymentGateway` con lo mínimo — `parseWebhook`/`verifyWebhook` que aceptan
cualquier `PaymentEvent` ya armado por la prueba misma (sin firmar nada de
verdad), y `fetchTransaction`/`findByReference` como `jest.fn()` que cada
prueba configura según necesite. `payment-settlement.spec.ts` y
`reconciliation.spec.ts` migran a usarla; el helper `wompiEvent()` se
elimina de ambos (ya no hace falta simular una firma real para probar qué
hace `PaymentsService` con el evento). Ninguna prueba de Wompi se pierde:
las que sí prueban a `WompiGateway` en sí mismo (firma, checksum, mapeo de
eventos) siguen intactas, solo dejan de ser el vehículo para probar el
núcleo de pagos.

## 11. Variables de entorno

`api/.env.example` gana:
```
PAYMENT_PROVIDER=stripe        # o wompi, para volver al flujo en pesos
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```
Las variables `WOMPI_*` no se tocan — siguen ahí para cuando `PAYMENT_PROVIDER=wompi`.

## 12. Fuera de alcance (a propósito)

- Revisión legal del contrato (deuda ya declarada, no nueva).
- Traducir el sitio a inglés — el producto sigue en español; solo cambia el
  formato del precio.
- Cobrar en más de una moneda a la vez, o dejar que el comprador elija.
- Convertir automáticamente los precios existentes de pesos a dólares.
