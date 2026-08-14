'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { CartLine, cartTotalCop, readCart } from '@/lib/cart';
import { createOrder, isSignedIn } from '@/lib/checkout-actions';
import { formatPrice } from '@/lib/format';
import styles from './page.module.scss';

const METHODS = [
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'NEQUI', label: 'Nequi' },
  { value: 'PSE', label: 'PSE' },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [method, setMethod] = useState<'CARD' | 'PSE' | 'NEQUI'>('CARD');
  const [address, setAddress] = useState({ line1: '', city: '', phone: '' });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * One key per attempt, minted once and kept for as long as this page lives.
   * Pressing the button twice, or retrying after a dropped connection, must
   * not take the units twice.
   */
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => { setLines(readCart()); }, []);

  useEffect(() => {
    // Sending someone to fill in an address only to bounce them to sign in
    // would be asking for work twice.
    void isSignedIn().then((signedIn) => {
      if (!signedIn) router.replace('/entrar?next=/checkout');
    });
  }, [router]);

  if (lines === null) return <div className={styles.checkout} />;

  if (lines.length === 0) {
    return (
      <div className={styles.checkout}>
        <h1 className="label muted">Pagar</h1>
        <p>No tienes nada en el carrito.</p>
      </div>
    );
  }

  const pieces = lines.filter((l) => l.kind === 'piece');
  const drops = lines.filter((l) => l.kind === 'drop');
  const needsAddress = pieces.length > 0;
  const addressComplete =
    !needsAddress ||
    (address.line1.trim() !== '' && address.city.trim() !== '' && address.phone.trim() !== '');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const result = await createOrder({
      pieceSlugs: pieces.map((l) => l.slug),
      dropSlugs: drops.map((l) => l.slug),
      paymentMethod: method,
      shippingAddress: needsAddress ? address : undefined,
      idempotencyKey,
    });

    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }

    // The units are taken from here on. The cart is cleared only once the
    // order exists, so a failure leaves the buyer exactly where they were.
    // It is emptied in the result screen, not here: the order can still fail.
    router.push(
      needsAddress
        ? `/checkout/contrato?order=${result.data.id}`
        : `/checkout/pagar?order=${result.data.id}`,
    );
  }

  return (
    <div className={styles.checkout}>
      <h1 className="label muted">Pagar</h1>

      <ul className={styles.summary}>
        {lines.map((line) => (
          <li key={`${line.kind}-${line.slug}`} className={styles.line}>
            <div className={styles.thumb}>
              {line.image && <ProductImage publicId={line.image} alt={line.title} />}
            </div>
            <div className={styles.meta}>
              <span className="label">{line.title}</span>
              <span className="muted label">{line.kind === 'piece' ? 'Pieza' : 'Video'}</span>
            </div>
            <span>{formatPrice(line.priceCop)}</span>
          </li>
        ))}
      </ul>

      <div className={styles.total}>
        <span className="label">Total</span>
        <span className="label">{formatPrice(cartTotalCop(lines))}</span>
      </div>

      <form onSubmit={submit} className={styles.form}>
        <fieldset className={styles.fieldset}>
          <legend className="label muted">Cómo pagas</legend>
          {METHODS.map((m) => (
            <label key={m.value} className={styles.radio}>
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
              />
              {m.label}
            </label>
          ))}
        </fieldset>

        {needsAddress && (
          <fieldset className={styles.fieldset}>
            <legend className="label muted">A dónde la enviamos</legend>

            <label htmlFor="line1">Dirección</label>
            <input
              id="line1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              autoComplete="street-address"
              required
            />

            <label htmlFor="city">Ciudad</label>
            <input
              id="city"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              autoComplete="address-level2"
              required
            />

            <label htmlFor="phone">Teléfono</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              autoComplete="tel"
              required
            />
          </fieldset>
        )}

        {needsAddress && (
          <p className="muted">
            En el siguiente paso firmarás el contrato de compraventa. Ten a mano tu cédula.
          </p>
        )}

        {error && <p role="alert" className={styles.error}>{error}</p>}

        <button type="submit" disabled={working || !addressComplete}>
          {working ? 'Apartando…' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}
