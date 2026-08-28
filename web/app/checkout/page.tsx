'use client';

import Link from 'next/link';
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
  const [address, setAddress] = useState({ line1: '', city: '', country: '', phone: '' });
  /** Slugs of the pieces the buyer wants signed. Empty is the default. */
  const [signed, setSigned] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * null while unknown, then true/false. Buying does not need a magic link
   * first: someone without a session just types an email here, and the order
   * is placed under it — the same account a magic link would have found.
   */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');

  /**
   * One key per attempt, minted once and kept for as long as this page lives.
   * Pressing the button twice, or retrying after a dropped connection, must
   * not take the units twice.
   */
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => { setLines(readCart()); }, []);
  useEffect(() => { void isSignedIn().then(setSignedIn); }, []);

  if (lines === null || signedIn === null) return <div className={styles.checkout} />;

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
    (address.line1.trim() !== '' && address.city.trim() !== ''
      && address.country.trim() !== '' && address.phone.trim() !== '');
  const emailComplete = signedIn || email.trim() !== '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const result = await createOrder({
      pieceSlugs: pieces.map((l) => l.slug),
      dropSlugs: drops.map((l) => l.slug),
      paymentMethod: method,
      shippingAddress: needsAddress ? address : undefined,
      signedPieceSlugs: signed,
      email: signedIn ? undefined : email.trim(),
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
        {!signedIn && (
          <fieldset className={styles.fieldset}>
            <legend className="label muted">Tu correo</legend>
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
            <p className="muted">
              Ahí te llegan el recibo y, si compras una pieza, el código para firmar el
              contrato. ¿Ya tienes cuenta? <Link href="/entrar?next=/checkout">Entra</Link> para
              ver tus pedidos anteriores.
            </p>
          </fieldset>
        )}

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

        {/*
          One checkbox per piece rather than one for the order: an order can
          carry two pieces and only one of them be wanted signed. Unchecked by
          default — a signature is something asked for, not something opted out
          of, and the artist has to be able to trust the flag.
        */}
        {pieces.length > 0 && (
          <fieldset className={styles.fieldset}>
            <legend className="label muted">Firma del artista</legend>
            {pieces.map((piece) => (
              <label key={piece.slug} className={styles.check}>
                <input
                  type="checkbox"
                  checked={signed.includes(piece.slug)}
                  onChange={(e) =>
                    setSigned((current) =>
                      e.target.checked
                        ? [...current, piece.slug]
                        : current.filter((slug) => slug !== piece.slug),
                    )
                  }
                />
                Quiero «{piece.title}» firmada a mano
              </label>
            ))}
            <p className="muted">
              Sin costo. Firmarla toma unos días más antes de que salga el envío.
            </p>
          </fieldset>
        )}

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

            <label htmlFor="country">País</label>
            <input
              id="country"
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
              autoComplete="country-name"
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

        <button type="submit" disabled={working || !addressComplete || !emailComplete}>
          {working ? 'Apartando…' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}
