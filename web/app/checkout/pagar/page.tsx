import { Suspense } from 'react';
import { apiGet } from '@/lib/api';
import { content } from '@/lib/content';
import { OrderSummary } from '@/lib/types';
import { Pay } from './Pay';
import styles from './page.module.scss';

async function PayLoader({ orderId }: { orderId: string }) {
  const order = await apiGet<OrderSummary>(`/orders/${orderId}`, true).catch(() => null);
  return <Pay orderId={orderId} order={order} />;
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) {
    return (
      <div className={styles.pay}>
        <p>{await content('checkout.invalidLink.body', 'Este enlace no lleva a ningún pedido.')}</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className={styles.pay} />}>
      <PayLoader orderId={orderId} />
    </Suspense>
  );
}
