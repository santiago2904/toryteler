/**
 * Mirror of what the API returns (plan 1, tasks 11 and 12).
 * If these and the API diverge, the API wins.
 */

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  /** Decides whether /studio exists for this visitor. */
  isAdmin: boolean;
}

export interface PieceSummary {
  slug: string;
  title: string;
  priceCop: number;
  images: string[];
  /** Units on sale. 1 means an irreplaceable piece; more than 1, an edition. */
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
  /** The buyer asked for this piece signed. Always false on a video. */
  signed: boolean;
}

/**
 * The backend builds the tracking URL from the carrier: keeping that map in the
 * frontend would mean redeploying the site every time a carrier changes its
 * website. When null, the number is shown without a link.
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
  /** Only on a single access, never on the list: it is the watermark. */
  viewerEmail?: string;
}

/**
 * The catalogue as the studio sees it: drafts included, and with how many of
 * each have been sold. Mirrors AdminPiece/AdminDrop in the API.
 */
export interface AdminPiece {
  id: string;
  slug: string;
  title: string;
  priceCop: number;
  images: string[];
  stock: number;
  status: string;
  sold: number;
}

export interface AdminDrop {
  id: string;
  slug: string;
  title: string;
  priceCop: number;
  posterImage: string | null;
  capacity: number | null;
  viewWindowHours: number;
  status: string;
  sold: number;
}

/** One video in the studio, whatever its state. Mirrors AdminService.findDrop. */
export interface AdminDropDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCop: number;
  videoAssetId: string;
  posterImage: string | null;
  capacity: number | null;
  viewWindowHours: number;
  status: string;
  sold: number;
  remaining: number | null;
  soldOut: boolean;
}

/** A sale as the studio shows it. Mirrors AdminOrder in the API. */
export interface AdminOrder {
  id: string;
  reference: string;
  status: string;
  totalCop: number;
  createdAt: string;
  shippedAt: string | null;
  buyer: { email: string; fullName: string | null };
  shippingAddress: Record<string, string> | null;
  tracking: { carrier: string; number: string } | null;
  contract: { id: string; status: string } | null;
  items: OrderItem[];
  needsShipping: boolean;
}
