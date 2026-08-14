/**
 * Espejo exacto de lo que devuelve la API (plan 1, tareas 11 y 12).
 * Si esto y la API divergen, la API manda.
 */

export interface PieceSummary {
  slug: string;
  title: string;
  priceCop: number;
  images: string[];
  /** Unidades disponibles. 1 es una pieza irrepetible; más de 1, una edición. */
  stock: number;
  available: boolean;
}

export interface PieceDetail extends PieceSummary {
  id: string;
  description: string | null;
  story: string | null;
  soldAt: string | null;
}

export interface DropDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCop: number;
  posterImage: string | null;
  capacity: number | null;
  remaining: number | null;
  soldOut: boolean;
  viewWindowHours: number;
}

export interface OrderItem {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
}

/**
 * La URL de rastreo la arma el backend a partir de la transportadora: mantener
 * ese mapa en el front obligaría a desplegar la web cada vez que una cambia su
 * sitio. Si viene en null, se muestra el número sin enlace.
 */
export interface OrderTracking {
  number: string;
  carrier: string;
  url: string | null;
}

export interface OrderSummary {
  id: string;
  reference: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  totalCop: number;
  createdAt: string;
  items: OrderItem[];
  tracking: OrderTracking | null;
}

export interface EntitlementSummary {
  id: string;
  dropSlug: string;
  dropTitle: string;
  firstPlayedAt: string | null;
  expiresAt: string | null;
  state: 'unopened' | 'open' | 'consumed';
}
