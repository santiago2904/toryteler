# Precios en USD, cobro en pesos a la TRM

Extiende `docs/superpowers/specs/2026-08-13-tienda-artista-design.md`. Donde
este documento no dice algo, manda el original. **Reemplaza y descarta**
`docs/superpowers/specs/2026-08-27-stripe-usd-pagos-design.md` (nunca
ejecutado) — Stripe no acepta cuentas de Colombia sin una entidad legal en
otro país, así que esa ruta se abandonó antes de escribir código.

## 1. Qué cambia y por qué

Toryteler empieza a vender a compradores internacionales. La tienda muestra
precios en dólares — es lo que un comprador de afuera entiende — pero el
cobro real sigue pasando por Wompi, que solo procesa pesos colombianos.

**Wompi no se toca.** Nada en `PaymentGateway`, `WompiGateway`,
`PaymentsService`, `ReconciliationService`, el webhook, el selector de
método de pago o los plazos por método cambia. El dólar es una capa de
presentación y de conversión al crear el pedido — no una segunda pasarela.

## 2. Decisiones tomadas en esta sesión

| Decisión | Razón |
|---|---|
| Sin pasarela nueva; Wompi sigue siendo la única | Stripe exige una entidad legal en un país que soporte (EE.UU. típicamente) — costo y trámite que no se justifican todavía. Wompi ya cobra tarjetas internacionales; el comprador extranjero paga con su tarjeta y su banco hace su propia conversión si hace falta |
| Los precios se fijan en USD (`price_usd_cents`), el cobro se congela en COP al crear el pedido | El artista pone precio en dólares una sola vez; la tasa del día decide cuántos pesos cobra Wompi ese pedido en particular |
| Tasa de cambio: TRM oficial de Banco de la República, vía `datos.gov.co` | Es la tasa que Colombia usa de verdad para esto — pública, gratis, sin llave, actualizada un día hábil por día |
| El monto en pesos se congela en el pedido, nunca se recalcula | Si la TRM cambia al día siguiente, un pedido ya creado no debe cambiar de precio a mitad de camino |
| Si la consulta a la TRM falla, se usa la última tasa cacheada; si nunca hubo una, se rechaza el pedido con un error claro | Nunca cobrar con una tasa inventada. Una venta pospuesta unos minutos es mejor que una mal cobrada |
| Se agrega `country` a la dirección de envío | Ya decidido en la sesión anterior: sin esto una pieza física vendida a alguien fuera de Colombia no tiene a dónde enviarse. Sigue en pie, es independiente de la pasarela |

## 3. Moneda en la base de datos

Migración nueva:

| Antes | Después |
|---|---|
| `pieces.price_cop` | `pieces.price_usd_cents` |
| `drops.price_cop` | `drops.price_usd_cents` |

`orders.total_cop` y `order_items.unit_price_cop` **no se renombran** — sí
cambia lo que significan: dejan de ser "el precio tal cual se fijó" y pasan a
ser "lo que se cobró de verdad, ya convertido y congelado al crear el
pedido". Es la columna que `WompiGateway` y `PaymentsService` ya leen; no
tocarla es lo que evita cualquier cambio en el núcleo de pagos.

Se agregan `orders.total_usd_cents` y `order_items.unit_price_usd_cents`
(nuevas, `integer NULL CHECK (total_usd_cents IS NULL OR total_usd_cents > 0)`)
— **nulas a propósito**: son informativas (para mostrar después "pagaste $25
USD, cobrados como $78.607 COP"), nada en `WompiGateway` ni en
`PaymentsService` las lee nunca. Hacerlas `NOT NULL` obligaría a tocar cada
fixture de prueba que inserta un pedido por SQL directo sin pasar por
`OrdersService.create()` — un costo real sin beneficio, porque ninguna de
esas pruebas necesita el dato en dólares. Solo `OrdersService.create()` las
llena a partir de aquí en adelante.

Como en la sesión anterior: **después de desplegar, cada pieza y video
publicado necesita que alguien le vuelva a poner precio desde `/studio`** —
los enteros que hoy dicen "250000" significaban pesos; como centavos de
dólar serían $2.500,00, que no es lo que nadie quiso decir.

## 4. `ExchangeRateService`

Nuevo, en `api/src/payments/exchange-rate.service.ts` — vive junto a pagos
porque solo se usa para congelar el precio de un pedido, no es de uso
general.

```ts
@Injectable()
export class ExchangeRateService {
  private cached: { copPerUsd: number; fetchedAt: number } | null = null;
  private readonly TTL_MS = 24 * 3_600_000; // la TRM se publica una vez por día hábil

  /** Pesos que vale un dólar, ahora mismo, según la TRM oficial. */
  async copPerUsd(): Promise<number> {
    if (this.cached && Date.now() - this.cached.fetchedAt < this.TTL_MS) {
      return this.cached.copPerUsd;
    }

    try {
      const res = await fetch(
        'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1',
      );
      if (!res.ok) throw new Error(`TRM_QUERY_FAILED_${res.status}`);

      const [row] = (await res.json()) as { valor: string }[];
      const rate = Number.parseFloat(row?.valor ?? '');
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('TRM_MALFORMED_RESPONSE');

      this.cached = { copPerUsd: rate, fetchedAt: Date.now() };
      return rate;
    } catch (err) {
      // Una TRM de ayer sigue siendo una tasa real; inventar una no lo es.
      if (this.cached) return this.cached.copPerUsd;
      throw new ServiceUnavailableException('EXCHANGE_RATE_UNAVAILABLE');
    }
  }
}
```

Sin caché en Postgres ni en Redis: una sola instancia de Railway, y la tasa
se recupera sola en la próxima consulta exitosa —
`lazy: caché en memoria de proceso; si el día que haya más de una instancia
esto reaparece, mover a un valor compartido`.

## 5. Congelar el precio al crear el pedido

`OrdersService.create()` (`api/src/orders/orders.service.ts`) — hoy suma
`price_cop` de piezas y drops para `total_cop`. Pasa a:

1. Leer `price_usd_cents` de piezas y drops (en vez de `price_cop`).
2. Pedir `copPerUsd()` a `ExchangeRateService` — una sola vez por pedido, no
   una vez por línea, para que todas las líneas del mismo pedido usen la
   misma tasa.
3. Por cada línea: `unitPriceCop = Math.round(unitPriceUsdCents / 100 * copPerUsd)`.
4. `totalUsdCents = suma de los usd_cents`; `totalCop = suma de los unitPriceCop ya redondeados` — se suma lo redondeado, no se redondea la suma, para que el total coincida con lo que un comprador vería sumando las líneas a mano.
5. `INSERT INTO orders (..., total_cop, total_usd_cents)` y
   `INSERT INTO order_items (..., unit_price_cop, unit_price_usd_cents)` —
   ambas columnas, ambos INSERT existentes ganan un valor más.

Si `ExchangeRateService` lanza `EXCHANGE_RATE_UNAVAILABLE`, `create()` lo
deja propagarse — mismo tratamiento que `PIECE_UNAVAILABLE`: la orden
simplemente no se crea, nada quedó tomado.

**Nada más de `OrdersService` cambia.** El resto del método (reservar stock,
la transacción, `signedPieceSlugs`) sigue igual — `PaymentsService` y
`WompiGateway`, después de este punto, siguen leyendo `total_cop` exactamente
como siempre.

## 6. Mostrar el precio

`web/lib/format.ts` — `formatPrice` pasa a mostrar dólares:

```ts
export function formatPrice(usdCents: number): string {
  return `$${(usdCents / 100).toFixed(2)} USD`;
}
```

Todo el catálogo, el carrito y el resumen de `/checkout` usan
`priceUsdCents`/`totalUsdCents` (antes `priceCop`/`totalCop`) — mismo patrón
de campo renombrado que ya se usó en la ronda anterior de esta sesión.

**Antes de mandar a pagar**, `/checkout` muestra el equivalente en pesos que
la API ya congeló, para que el comprador no se sorprenda con lo que ve en su
tarjeta:

> Total: $25.00 USD — se cobra como $78.607 COP (tasa de hoy)

Ese texto lee `order.totalCop` que ya viene en la respuesta de
`POST /orders` (`orders.controller.ts` ya devuelve `totalCop`; gana
`totalUsdCents` al lado). Nada que calcular en el navegador — los dos
números ya vienen congelados desde el servidor.

`PriceInput.tsx` (panel): el artista sigue escribiendo un número, ahora en
dólares (`25` → se guarda como `2500`), sufijo visual `USD` en vez de `COP`.

`ContractPdfService`: el contrato es un documento de compraventa bajo ley
colombiana sobre una venta cobrada en pesos — mostrar solo el dólar ahí
sería menos preciso que lo que de verdad se cobró. `ContractData` gana
`priceUsdCents` junto al ya existente `priceCop` (que pasa a significar,
como en el pedido, "lo que se cobró"), y el PDF muestra ambos: `$25.00 USD
($78.607 COP)`.

`web/lib/fees.ts`: `calculateFees` se recalcula con la comisión real de
Wompi sobre el monto en pesos que de verdad se cobra (`totalCop`), no sobre
el dólar — la comisión de Wompi es sobre pesos, siempre fue así, y eso no
cambió.

## 7. Envío internacional

Sin cambios respecto al diseño anterior: `ShippingAddressDto` gana
`country`, se muestra donde ya se muestra la dirección de envío. Ver
`docs/superpowers/specs/2026-08-13-tienda-artista-design.md` §7 para el
resto del flujo de contrato y envío, que no cambia.

## 8. Contrato legal

Sin cambios. Sigue la deuda ya declarada ("el texto necesita revisión de un
abogado"); esto se suma a esa deuda, no la duplica.

## 9. Pruebas

- `ExchangeRateService`: caché honra el TTL, una consulta fallida devuelve
  la última tasa cacheada, y sin caché previa lanza
  `EXCHANGE_RATE_UNAVAILABLE`. Sin llamadas reales a `datos.gov.co` — el
  `fetch` global se sustituye por uno de prueba, mismo patrón que ya usan
  `WompiGateway`'s consumidores en las pruebas existentes.
- `OrdersService.create()`: dado un `ExchangeRateService` de prueba con una
  tasa fija, el pedido creado tiene `total_cop` y `total_usd_cents`
  coherentes con esa tasa; una tasa no disponible impide crear el pedido sin
  tomar stock.
- El resto de la suite de pagos (`payment-settlement.spec.ts`,
  `reconciliation.spec.ts`, todo lo que usa `WompiGateway`) **no cambia una
  línea** — siguen leyendo `total_cop`, que sigue significando lo mismo para
  ellas.

## 10. Fuera de alcance (a propósito)

- Cualquier pasarela nueva (Stripe u otra) — descartado, ver §1.
- Revisión legal del contrato.
- Traducir el sitio a inglés — el producto sigue en español.
- Dejar que el comprador elija en qué moneda pagar, o cobrar en más de una.
- Un panel para que el artista fije la tasa a mano — la TRM se toma tal cual
  la publica el Banco de la República.
