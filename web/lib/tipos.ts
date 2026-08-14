/**
 * Espejo exacto de lo que devuelve la API (plan 1, tareas 11 y 12).
 * Si esto y la API divergen, la API manda.
 */

export interface PieceSummary {
  slug: string;
  title: string;
  priceCop: number;
  images: string[];
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

export interface OrderSummary {
  id: string;
  reference: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  totalCop: number;
  createdAt: string;
  trackingNumber: string | null;
}

export interface EntitlementSummary {
  id: string;
  dropSlug: string;
  dropTitle: string;
  firstPlayedAt: string | null;
  expiresAt: string | null;
  state: 'unopened' | 'open' | 'consumed';
}
