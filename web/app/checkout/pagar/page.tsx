'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { startPayment } from '@/lib/checkout-actions';
import styles from './page.module.scss';

function Pay() {
  const orderId = useSearchParams().get('order');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!orderId) {
    return (
      <div className={styles.pay}>
        <p>Este enlace no lleva a ningún pedido.</p>
      </div>
    );
  }

  /**
   * The redirect is deliberately behind a button rather than automatic on
   * load. Being thrown at a payment page without pressing anything reads like
   * something went wrong, and a failed redirect would loop on a mounted page.
   */
  async function pay() {
    setWorking(true);
    setError(null);

    const result = await startPayment(orderId!);
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }

    // Leaving the site: replace so the back button does not land the buyer on
    // a page whose only purpose was to send them away.
    window.location.replace(result.data.checkoutUrl);
  }

  return (
    <div className={styles.pay}>
      <h1 className="label muted">Pagar</h1>
      <p>Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.</p>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <button type="button" onClick={pay} disabled={working}>
        {working ? 'Abriendo…' : 'Ir a pagar'}
      </button>

      <p className="muted">
        Los datos de tu tarjeta no pasan por esta tienda.
      </p>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className={styles.pay} />}>
      <Pay />
    </Suspense>
  );
}
