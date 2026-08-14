import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { OrderSummary } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { formatDate, formatPrice } from '@/lib/format';
import styles from '../studio.module.scss';

export const metadata: Metadata = { title: 'Pedidos — Studio' };

const ORDER_STATUS: Record<OrderSummary['status'], string> = {
  pending: 'Confirmando pago',
  paid: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Vencido',
  refunded: 'Reembolsado',
};

export default async function OrdersPage() {
  // lazy: with no API yet, this lists the same mock orders as the account
  // page. The real admin endpoint also carries address and email.
  const orders = await apiGet<OrderSummary[]>('/me/orders', true);

  const toShip = orders.filter((p) => p.status === 'paid' && !p.tracking);

  return (
    <div className={styles.orders}>
      <h1 className="label muted">
        OrdersPage · {toShip.length} por despachar
      </h1>

      <ul className={styles.orderList}>
        {orders.map((order) => (
          <li key={order.id} className={styles.order}>
            <ul className={styles.thumbs}>
              {order.items.map((item) => (
                <li key={`${item.kind}-${item.slug}`} className={styles.thumb}>
                  {item.image && <ProductImage publicId={item.image} alt={item.title} />}
                </li>
              ))}
            </ul>

            <div className={styles.meta}>
              <span className="label">{order.reference}</span>
              <span className="muted">{order.items.map((i) => i.title).join(' · ')}</span>
              <span>{formatPrice(order.totalCop)}</span>
              <span className="label muted">
                {ORDER_STATUS[order.status]} · {formatDate(order.createdAt)}
              </span>

              {order.tracking ? (
                <span className="label muted">
                  Enviado · {order.tracking.carrier} {order.tracking.number}
                </span>
              ) : order.status === 'paid' ? (
                <form className={styles.shipping}>
                  <label htmlFor={`transportadora-${order.id}`}>Transportadora</label>
                  <select id={`transportadora-${order.id}`} defaultValue="Servientrega">
                    <option>Servientrega</option>
                    <option>Coordinadora</option>
                    <option>Interrapidísimo</option>
                    <option>TCC</option>
                  </select>

                  <label htmlFor={`guia-${order.id}`}>Número de guía</label>
                  <input id={`guia-${order.id}`} inputMode="numeric" />

                  <button type="submit" disabled>Marcar enviado</button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
