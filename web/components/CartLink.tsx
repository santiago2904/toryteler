'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CART_CHANGED, readCart } from '@/lib/cart';
import styles from './CartLink.module.scss';

/**
 * The counter starts empty and fills in after mount: reading localStorage
 * during render would cause a hydration mismatch, since the server cannot know
 * what is in each visitor's cart.
 */
export function CartLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(readCart().length);
    refresh();
    window.addEventListener(CART_CHANGED, refresh);
    window.addEventListener('storage', refresh); // other tabs
    return () => {
      window.removeEventListener(CART_CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <Link
      href="/carrito"
      className={styles.cart}
      aria-label={
        count === 0
          ? 'Carrito vacío'
          : `Carrito, ${count} ${count === 1 ? 'artículo' : 'artículos'}`
      }
    >
      <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" focusable="false">
        {/* Bag: two strokes, no fill, same weight as the site's rules. */}
        <path d="M1 5.5h14l-1 11.5H2L1 5.5Z" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M5 5.5V4a3 3 0 0 1 6 0v1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      {/* The number is already in the aria-label, so it is redundant here. */}
      <span className={styles.count} aria-hidden="true">
        {count}
      </span>
    </Link>
  );
}
