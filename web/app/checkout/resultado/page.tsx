import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { OrderSummary } from '@/lib/types';
import { OrderWatcher } from './OrderWatcher';
import styles from './page.module.scss';

export const metadata: Metadata = { title: 'Tu compra — Toryteler' };

/** Nothing here is cached: the whole point is the state right now. */
export const dynamic = 'force-dynamic';

const OUTCOMES: Record<OrderSummary['status'], { title: string; body: string }> = {
  pending: {
    title: 'Confirmando tu pago',
    body: 'La pasarela todavía no nos ha confirmado el cobro. Esto suele tardar segundos; te escribimos al correo en cuanto quede.',
  },
  paid: {
    title: 'Listo',
    body: 'Tu compra quedó confirmada. Te enviamos el correo con el detalle y, si compraste una pieza, el contrato firmado.',
  },
  failed: {
    title: 'El pago no se completó',
    body: 'No te cobramos nada y lo que habías apartado volvió a la tienda. Puedes intentarlo otra vez.',
  },
  expired: {
    title: 'El pedido venció',
    body: 'Pasó demasiado tiempo sin completar el pago, así que soltamos lo que tenías apartado.',
  },
  refunded: {
    title: 'Te devolvimos el dinero',
    body: 'Alguien se adelantó con lo que compraste, así que reembolsamos el valor completo.',
  },
};

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; id?: string }>;
}) {
  const { order: orderId, id: transactionId } = await searchParams;
  // A single order, not the whole account: a guest lands here on a
  // checkout-scoped session that only opens this one order, never a list of
  // everything they have ever bought. A 404 — wrong order, someone else's —
  // reads the same as "nothing here", not a crash.
  const order = orderId
    ? await apiGet<OrderSummary>(`/orders/${orderId}`, true).catch(() => null)
    : null;

  if (!order) {
    return (
      <div className={styles.result}>
        <h1 className="label muted">No encontramos ese pedido</h1>
        <p>Puede que sea de otra cuenta. Mira tus pedidos para comprobarlo.</p>
        <Link href="/cuenta" className="label">Ver mis pedidos</Link>
      </div>
    );
  }

  const outcome = OUTCOMES[order.status];

  return (
    <div className={styles.result}>
      <OrderWatcher status={order.status} orderId={order.id} transactionId={transactionId ?? null} />

      <h1 className="label muted">{outcome.title}</h1>
      <p>{outcome.body}</p>

      <dl className={styles.detail}>
        <dt className="label muted">Pedido</dt>
        <dd>{order.reference}</dd>
        <dt className="label muted">Total</dt>
        <dd>
          {order.totalUsdCents !== null
            ? formatPrice(order.totalUsdCents)
            : `${new Intl.NumberFormat('es-CO').format(order.totalCop)} COP`}
        </dd>
      </dl>

      <ul className={styles.items}>
        {order.items.map((item) => (
          <li key={`${item.kind}-${item.slug}`} className="muted">
            {item.title}
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <Link href="/cuenta" className="label">Ver mis pedidos</Link>
        {(order.status === 'failed' || order.status === 'expired') && (
          <Link href="/carrito" className="label">Volver al carrito</Link>
        )}
      </div>
    </div>
  );
}
