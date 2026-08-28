'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { formatPrice } from '@/lib/format';
import { CART_CHANGED, CartLine, readCart, removeFromCart, cartTotalUsdCents } from '@/lib/cart';
import styles from './page.module.scss';

export default function CartPage() {
  const [lines, setLineas] = useState<CartLine[] | null>(null);

  useEffect(() => {
    const refresh = () => setLineas(readCart());
    refresh();
    window.addEventListener(CART_CHANGED, refresh);
    return () => window.removeEventListener(CART_CHANGED, refresh);
  }, []);

  // null until the browser has been read: showing "empty" before knowing would
  // flash that message on every visit with a full cart.
  if (lines === null) return <div className={styles.cart} />;

  if (lines.length === 0) {
    return (
      <div className={styles.cart}>
        <h1 className="label muted">Carrito</h1>
        <p>No tienes nada en el carrito.</p>
        <Link href="/" className="label">Ver la casa de Tory</Link>
      </div>
    );
  }

  const hasPiece = lines.some((l) => l.kind === 'piece');

  return (
    <div className={styles.cart}>
      <h1 className="label muted">Carrito</h1>

      <ul className={styles.list}>
        {lines.map((line) => (
          <li key={`${line.kind}-${line.slug}`} className={styles.line}>
            <div className={styles.thumb}>
              {line.image && <ProductImage publicId={line.image} alt={line.title} />}
            </div>

            <div className={styles.meta}>
              <Link
                href={`/${line.kind === 'piece' ? 'piezas' : 'drops'}/${line.slug}`}
                className="label"
              >
                {line.title}
              </Link>
              <span className="muted label">
                {line.kind === 'piece' ? 'Pieza' : 'Video'}
              </span>
              <span>{formatPrice(line.priceUsdCents)}</span>
            </div>

            <button
              type="button"
              className="link-button"
              onClick={() => removeFromCart(line.kind, line.slug)}
              aria-label={`Quitar ${line.title} del carrito`}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.total}>
        <span className="label">Total</span>
        <span className="label">{formatPrice(cartTotalUsdCents(lines))}</span>
      </div>

      {hasPiece && (
        <p className="muted">
          Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu
          cédula a mano.
        </p>
      )}

      <Link href="/checkout" className={styles.pay}>Pagar</Link>
    </div>
  );
}
