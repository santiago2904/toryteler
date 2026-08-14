import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { EntitlementSummary, OrderSummary, Profile } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { SignOutButton } from '@/components/SignOutButton';
import { formatDate, formatPrice, timeLeft } from '@/lib/format';
import styles from './page.module.scss';

export const metadata: Metadata = { title: 'Tu cuenta — Toryteler' };

const ORDER_STATUS: Record<OrderSummary['status'], string> = {
  pending: 'Confirmando pago',
  paid: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Vencido',
  refunded: 'Reembolsado',
};

/**
 * "Quedan" is reserved for a video's remaining seats in the store. Using the
 * same word for remaining time made two different things read alike.
 */
function entitlementText(entitlement: EntitlementSummary): string {
  if (entitlement.state === 'unopened') return 'Sin abrir';
  if (entitlement.state === 'open') return `Se cierra en ${timeLeft(entitlement.expiresAt!)}`;
  return `Visto ${formatDate(entitlement.firstPlayedAt!)}`;
}

export default async function AccountPage() {
  const [profile, orders, entitlements] = await Promise.all([
    apiGet<Profile>('/me', true),
    apiGet<OrderSummary[]>('/me/orders', true),
    apiGet<EntitlementSummary[]>('/me/entitlements', true),
  ]);

  return (
    <div className={styles.account}>
      <div className={styles.who}>
        <span className="label muted">{profile.email}</span>
        <SignOutButton />
      </div>

      {/*
        The only way into the studio from the site, and it is here rather than in
        the header on purpose: putting it in the header means reading the session
        on every page, which would turn the whole shop — the storefront included
        — into something rendered on demand for a link one person needs.
      */}
      {profile.isAdmin && (
        <section className={styles.studio}>
          <div>
            <p className="label">Entraste como el artista</p>
            <p className="muted">Desde el studio publicas piezas y videos, y ves los pedidos.</p>
          </div>
          <Link href="/studio" className="label">Abrir el studio →</Link>
        </section>
      )}

      <section className={styles.section}>
        <h1 className="label muted">Pedidos</h1>
        {orders.length === 0 ? (
          <p className="muted">Todavía no tienes pedidos.</p>
        ) : (
          <ul className={styles.list}>
            {orders.map((order) => (
              <li key={order.id} className={styles.order}>
                <ul className={styles.thumbs}>
                  {order.items.map((item) => (
                    <li key={`${item.kind}-${item.slug}`} className={styles.thumb}>
                      <Link href={`/${item.kind === 'piece' ? 'piezas' : 'drops'}/${item.slug}`}>
                        {item.image ? (
                          <ProductImage publicId={item.image} alt={item.title} />
                        ) : (
                          <span className="label muted">{item.title}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className={styles.meta}>
                  <span className="label">{order.reference}</span>
                  <span className="muted">
                    {order.items.map((item) => item.title).join(' · ')}
                  </span>
                  <span>{formatPrice(order.totalCop)}</span>
                  <span className="label muted">
                    {ORDER_STATUS[order.status]} · {formatDate(order.createdAt)}
                  </span>

                  {order.tracking && (
                    <span className="label">
                      {order.tracking.url ? (
                        <a href={order.tracking.url} target="_blank" rel="noopener noreferrer">
                          Rastrear · {order.tracking.carrier} {order.tracking.number}
                        </a>
                      ) : (
                        <span className="muted">
                          {order.tracking.carrier} {order.tracking.number}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.heading}>
          <h1 className="label muted">Videos</h1>
          {/* La regla no es evidente y de ella depende que alguien no pierda
              lo que pagó. Va aquí, no en unos términos que nadie abre. */}
          <p className={`${styles.note} muted`}>
            Cada video se ve una sola vez. Al darle play se abre tu ventana y, mientras esté
            abierta, puedes entrar y salir cuantas veces quieras. Cuando se cierra, no vuelve
            a abrirse.
          </p>
        </div>
        {entitlements.length === 0 ? (
          <p className="muted">Todavía no tienes videos.</p>
        ) : (
          <ul className={styles.list}>
            {entitlements.map((entitlement) => (
              <li key={entitlement.id} className={styles.row}>
                <span className="label">{entitlement.dropTitle}</span>
                <span className="label muted">{entitlementText(entitlement)}</span>
                {entitlement.state !== 'consumed' && (
                  <Link href={`/ver/${entitlement.id}`} className="label">
                    {entitlement.state === 'unopened' ? 'Abrir' : 'Continuar'}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
