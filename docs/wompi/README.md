# Documentación de Wompi

Copiada de `checkout-commerce-api`, donde ya hay una integración de Wompi en
producción. Se guarda aquí para no depender de tener ese repo a mano.

- `transacciones.md` — crear una transacción, estados y consulta por id
- `metodos-de-pago.md` — los ocho métodos, con lo que exige cada uno

## Lo que ya está aplicado en `api/src/payments/wompi/`

Tres detalles que cuestan horas de depuración si no se saben:

1. **El checksum del webhook llega en MAYÚSCULAS.** Compararlo contra un digest
   en minúsculas rechaza todos los eventos legítimos.
2. **La firma de integridad se calcula sobre el monto en centavos**, la misma
   cifra que va en `amount_in_cents`. Firmarla sobre los pesos produce un
   checkout que Wompi rechaza sin decir por qué.
3. **Un evento se identifica por transacción _y_ estado.** Una transacción emite
   `PENDING` y luego `APPROVED`; si la clave de idempotencia fuera solo el id de
   transacción, el segundo evento se descartaría como duplicado y el pedido
   nunca se liquidaría.

Los cinco estados —`PENDING`, `APPROVED`, `DECLINED`, `VOIDED`, `ERROR`— se
normalizan a tres en `payment-gateway.ts`: `VOIDED` y `ERROR` se tratan como
`DECLINED`, porque para este sistema significan lo mismo (devolver el
inventario y anular el contrato).

## Lo que la doc ofrece y todavía no usamos

Wompi soporta **ocho métodos**: `CARD`, `PSE`, `NEQUI`, `DAVIPLATA`,
`BANCOLOMBIA_TRANSFER`, `BANCOLOMBIA_QR`, `BANCOLOMBIA_COLLECT` y `PCOL`.

La tabla `orders` solo admite `CARD`, `PSE` y `NEQUI`. **Es una restricción
nuestra, no de Wompi**, y existe porque el plazo del pedido depende del método
(15, 45 y 20 minutos). Al usar el checkout alojado, quien compra elige el método
allí, así que ampliar la lista es: añadir el método al `CHECK` de la tabla y
decidir su plazo.

`acceptance_token` y `financial_institutions` (el listado de bancos de PSE) solo
hacen falta si algún día se construye un formulario de pago propio en lugar de
redirigir al checkout de Wompi. Con el checkout alojado, la pasarela los maneja.
