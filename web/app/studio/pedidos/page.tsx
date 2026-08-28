import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { AdminOrder } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { ShipOrder } from '@/components/ShipOrder';
import { formatDate, formatPrice } from '@/lib/format';
import styles from '../studio.module.scss';

export const metadata: Metadata = { title: 'Pedidos — Studio' };

/** Whatever is happening with the orders is happening right now. */
export const dynamic = 'force-dynamic';

const ORDER_STATUS: Record<string, string> = {
  pending: 'Confirmando pago',
  paid: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Vencido',
  refunded: 'Reembolsado',
};

export default async function OrdersPage() {
  // Every order, not the artist's own: this is the shop's ledger. It also
  // carries the address and the contract, which is what packing one needs.
  const orders = await apiGet<AdminOrder[]>('/admin/orders', true);

  const toShip = orders.filter((o) => o.status === 'paid' && o.needsShipping && !o.tracking);

  return (
    <div className={styles.orders}>
      <h1 className="label muted">
        {orders.length} pedidos
        {toShip.length > 0 && ` · ${toShip.length} por despachar`}
      </h1>

      {orders.length === 0 && <p className="muted">Todavía no hay pedidos.</p>}

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
                {ORDER_STATUS[order.status] ?? order.status} · {formatDate(order.createdAt)}
              </span>

              <span className="label muted">
                {order.buyer.fullName ?? 'Sin nombre'} · {order.buyer.email}
              </span>

              {order.shippingAddress && (
                <span className="muted">
                  {[
                    order.shippingAddress.line1, order.shippingAddress.city,
                    order.shippingAddress.country, order.shippingAddress.phone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}

              {order.contract && (
                <a
                  href={`/contratos/${order.contract.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label"
                >
                  Ver contrato
                  {order.contract.status === 'signed_pending_payment' && ' · firmado, sin pagar'}
                  {order.contract.status === 'void' && ' · anulado'}
                </a>
              )}

              {/*
                The one thing on this screen that has to happen before the box
                is closed, so it sits right above the button that closes it.
              */}
              {order.items.some((i) => i.signed) && (
                <span className={styles.signature}>
                  Firmar antes de empacar ·{' '}
                  {order.items.filter((i) => i.signed).map((i) => i.title).join(' · ')}
                </span>
              )}

              {order.tracking ? (
                <span className="label muted">
                  Enviado · {order.tracking.carrier} {order.tracking.number}
                </span>
              ) : order.status === 'paid' && order.needsShipping ? (
                <ShipOrder orderId={order.id} />
              ) : order.status === 'paid' ? (
                <span className="label muted">Nada que enviar: solo video</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
