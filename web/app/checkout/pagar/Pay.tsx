'use client';

import { useState } from 'react';
import { startPayment } from '@/lib/checkout-actions';
import { useContent } from '@/components/ContentProvider';
import { formatPrice } from '@/lib/format';
import { OrderSummary } from '@/lib/types';
import styles from './page.module.scss';

export function Pay({ orderId, order }: { orderId: string; order: OrderSummary | null }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gatewayNotice = useContent(
    'checkout.pay.gatewayNotice',
    'Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.',
  );
  const securityNotice = useContent('checkout.pay.securityNotice', 'Los datos de tu tarjeta no pasan por esta tienda.');

  async function pay() {
    setWorking(true);
    setError(null);

    const result = await startPayment(orderId);
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }
    window.location.replace(result.data.checkoutUrl);
  }

  return (
    <div className={styles.pay}>
      <h1 className="label muted">Pagar</h1>

      {/* totalUsdCents es null solo en un pedido de antes de esta función —
          en ese caso se muestra nada más el peso, que es lo único que hubo. */}
      {order && order.totalUsdCents !== null && (
        <p className="muted">
          Total: {formatPrice(order.totalUsdCents)} — se cobra como{' '}
          {new Intl.NumberFormat('es-CO').format(order.totalCop)} COP (tasa de hoy)
        </p>
      )}
      {order && order.totalUsdCents === null && (
        <p className="muted">
          Total: {new Intl.NumberFormat('es-CO').format(order.totalCop)} COP
        </p>
      )}

      <p>{gatewayNotice}</p>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <button type="button" onClick={pay} disabled={working}>
        {working ? 'Abriendo…' : 'Ir a pagar'}
      </button>

      <p className="muted">{securityNotice}</p>
    </div>
  );
}
