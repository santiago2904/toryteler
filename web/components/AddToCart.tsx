'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { addToCart, isInCart, CART_CHANGED, CartLine } from '@/lib/cart';
import styles from './AddToCart.module.scss';

/**
 * Adds to the cart and, once inside, stops offering to add: pieces track their
 * own stock and a video goes one per buyer, so pressing twice means nothing.
 * Instead of repeating the action, it offers a way to the cart.
 */
export function AddToCart({ line }: { line: CartLine }) {
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    const refresh = () => setInCart(isInCart(line.kind, line.slug));
    refresh();
    window.addEventListener(CART_CHANGED, refresh);
    return () => window.removeEventListener(CART_CHANGED, refresh);
  }, [line.kind, line.slug]);

  if (inCart) {
    return (
      <div className={styles.inCart}>
        <span className="label muted">En tu carrito</span>
        <Link href="/carrito" className={styles.link}>
          <button type="button">Ir al carrito</button>
        </Link>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => addToCart(line)}>
      Añadir al carrito
    </button>
  );
}
