'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { markShipped } from '@/lib/studio-actions';
import styles from '@/app/studio/studio.module.scss';

/**
 * The carriers the shop builds tracking links for. Anything else is accepted
 * too — the number is shown as plain text — but these are the ones that turn
 * into a link the buyer can follow.
 */
const CARRIERS = ['servientrega', 'coordinadora', 'interrapidisimo', 'envia'];

const LABELS: Record<string, string> = {
  servientrega: 'Servientrega',
  coordinadora: 'Coordinadora',
  interrapidisimo: 'Interrapidísimo',
  envia: 'Envía',
};

export function ShipOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [number, setNumber] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const result = await markShipped(orderId, { carrier, number: number.trim() });
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={styles.shipping}>
      <label htmlFor={`transportadora-${orderId}`}>Transportadora</label>
      <select
        id={`transportadora-${orderId}`}
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
      >
        {CARRIERS.map((value) => (
          <option key={value} value={value}>{LABELS[value]}</option>
        ))}
      </select>

      <label htmlFor={`guia-${orderId}`}>Número de guía</label>
      <input
        id={`guia-${orderId}`}
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        autoComplete="off"
      />

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <button type="submit" disabled={working || number.trim().length < 3}>
        {working ? 'Guardando…' : 'Marcar enviado'}
      </button>
    </form>
  );
}
