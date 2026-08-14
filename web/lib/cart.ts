export interface CartLine {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
  priceCop: number;
}

const KEY = 'cart';

/**
 * The cart lives in the browser. It will stay there once the API exists: what
 * gets sent when creating an order are the identifiers, and prices are re-read
 * from the database. Nothing stored here is trusted at charge time.
 *
 * `storage` only notifies other tabs, so a custom event is emitted as well so
 * the header updates in the current one.
 */
export const CART_CHANGED = 'cart:changed';

export function readCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? (value as CartLine[]) : [];
  } catch {
    return [];
  }
}

function save(lines: CartLine[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked: the cart lasts as long as the page does.
  }
  window.dispatchEvent(new CustomEvent(CART_CHANGED));
}

/** Pieces have their own stock and videos go one per buyer: no quantities. */
export function addToCart(line: CartLine): void {
  const lines = readCart();
  if (lines.some((l) => l.kind === line.kind && l.slug === line.slug)) return;
  save([...lines, line]);
}

export function removeFromCart(kind: CartLine['kind'], slug: string): void {
  save(readCart().filter((l) => !(l.kind === kind && l.slug === slug)));
}

/** Emptied once an order exists, not when the checkout starts. */
export function clearCart(): void {
  save([]);
}

export function isInCart(kind: CartLine['kind'], slug: string): boolean {
  return readCart().some((l) => l.kind === kind && l.slug === slug);
}

export function cartTotalCop(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCop, 0);
}
