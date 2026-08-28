import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstRow, returnedRows } from '../database/rows';

export interface OrderItem {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
  /** The buyer asked for this piece signed. Always false on a video. */
  signed: boolean;
}

export interface OrderTracking {
  number: string;
  carrier: string;
  url: string | null;
}

export interface OrderSummary {
  id: string;
  reference: string;
  status: string;
  totalCop: number;
  totalUsdCents: number | null;
  createdAt: Date;
  items: OrderItem[];
  tracking: OrderTracking | null;
  /**
   * The signed contract, so the buyer has somewhere to read it back. Only sent
   * once it has been signed: a void one describes a sale that did not happen,
   * and offering it to open would be offering a document about nothing.
   */
  contractId: string | null;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  /** Read from the database on every call, never baked into the session. */
  isAdmin: boolean;
}

export interface EntitlementSummary {
  id: string;
  dropSlug: string;
  dropTitle: string;
  firstPlayedAt: Date | null;
  expiresAt: Date | null;
  state: 'unopened' | 'open' | 'consumed';
  /**
   * Stamped over the video as a watermark. It does not stop a recording; it
   * makes a shared one traceable. Only sent for the single access being
   * watched, never in the list.
   */
  viewerEmail?: string;
}

/**
 * Where to follow a shipment, by carrier.
 *
 * This map lives here and not in the frontend: keeping it there would mean
 * redeploying the website every time a carrier reorganises its site. An
 * unknown carrier yields no link and the number is shown as plain text, which
 * is better than sending someone to a page that no longer exists.
 */
const TRACKING_URLS: Record<string, (n: string) => string> = {
  servientrega: (n) => `https://www.servientrega.com/wps/portal/rastreo-envio?guia=${n}`,
  coordinadora: (n) => `https://www.coordinadora.com/portafolio-de-servicios/rastreo-de-guias/?guia=${n}`,
  interrapidisimo: (n) => `https://www.interrapidisimo.com/sigue-tu-envio/?guia=${n}`,
  envia: (n) => `https://envia.co/rastreo?guia=${n}`,
};

interface OrderRow {
  id: string;
  reference: string;
  status: string;
  total_cop: number;
  total_usd_cents: number | null;
  created_at: Date;
  tracking_carrier: string | null;
  tracking_number: string | null;
  contract_id: string | null;
}

interface ItemRow {
  order_id: string;
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
  signed: boolean;
}

interface EntitlementRow {
  id: string;
  slug: string;
  title: string;
  first_played_at: Date | null;
  expires_at: Date | null;
}

@Injectable()
export class AccountService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Who the session belongs to, and whether they are the artist.
   *
   * The frontend needs this to decide whether to draw the studio at all.
   * Answering it from the database rather than from the token means revoking
   * the role takes effect on the next click, not whenever the session expires.
   */
  async profile(userId: string): Promise<Profile | null> {
    const row = firstRow<{ id: string; email: string; full_name: string | null; is_admin: boolean }>(
      await this.ds.query(
        `SELECT id, email, full_name, is_admin FROM users WHERE id = $1`,
        [userId],
      ),
    );
    return row
      ? { id: row.id, email: row.email, fullName: row.full_name, isAdmin: row.is_admin }
      : null;
  }

  /**
   * Someone's own orders. An order is recognised by its photograph long before
   * its reference, so every line carries an image.
   */
  async orders(userId: string): Promise<OrderSummary[]> {
    const orders = returnedRows<OrderRow>(
      await this.ds.query(
        `SELECT o.id, o.reference, o.status, o.total_cop, o.total_usd_cents, o.created_at,
                o.tracking_carrier, o.tracking_number,
                c.id AS contract_id
           FROM orders o
           -- Only a contract the buyer actually signed. One still awaiting the
           -- signature is not theirs to read back, and a void one is a sale
           -- that did not happen.
           LEFT JOIN contracts c
                  ON c.order_id = o.id
                 AND c.status IN ('signed_pending_payment', 'executed')
          WHERE o.user_id = $1
          ORDER BY o.created_at DESC`,
        [userId],
      ),
    );
    if (orders.length === 0) return [];

    // One query for every line of every order: a query per order would grow
    // with the buyer's history, and this page is the one they return to.
    const items = returnedRows<ItemRow>(
      await this.ds.query(
        `SELECT i.order_id,
                CASE WHEN i.piece_id IS NOT NULL THEN 'piece' ELSE 'drop' END AS kind,
                COALESCE(p.slug, d.slug)   AS slug,
                COALESCE(p.title, d.title) AS title,
                COALESCE(p.images ->> 0, d.poster_image) AS image,
                i.wants_signature AS signed
           FROM order_items i
           LEFT JOIN pieces p ON p.id = i.piece_id
           LEFT JOIN drops  d ON d.id = i.drop_id
          WHERE i.order_id = ANY($1)`,
        [orders.map((o) => o.id)],
      ),
    );

    return orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      status: o.status,
      totalCop: o.total_cop,
      totalUsdCents: o.total_usd_cents,
      createdAt: o.created_at,
      contractId: o.contract_id,
      items: items
        .filter((i) => i.order_id === o.id)
        .map(({ kind, slug, title, image, signed }) => ({ kind, slug, title, image, signed })),
      tracking: this.tracking(o),
    }));
  }

  /**
   * One order by id, with its owner attached so the caller can decide whether
   * this request is allowed to see it. Used by the checkout result page,
   * which a guest can reach without an account session.
   */
  async orderById(orderId: string): Promise<(OrderSummary & { userId: string }) | null> {
    const order = firstRow<OrderRow & { user_id: string }>(
      await this.ds.query(
        `SELECT o.id, o.user_id, o.reference, o.status, o.total_cop, o.total_usd_cents, o.created_at,
                o.tracking_carrier, o.tracking_number,
                c.id AS contract_id
           FROM orders o
           LEFT JOIN contracts c
                  ON c.order_id = o.id
                 AND c.status IN ('signed_pending_payment', 'executed')
          WHERE o.id = $1`,
        [orderId],
      ),
    );
    if (!order) return null;

    const items = returnedRows<ItemRow>(
      await this.ds.query(
        `SELECT i.order_id,
                CASE WHEN i.piece_id IS NOT NULL THEN 'piece' ELSE 'drop' END AS kind,
                COALESCE(p.slug, d.slug)   AS slug,
                COALESCE(p.title, d.title) AS title,
                COALESCE(p.images ->> 0, d.poster_image) AS image,
                i.wants_signature AS signed
           FROM order_items i
           LEFT JOIN pieces p ON p.id = i.piece_id
           LEFT JOIN drops  d ON d.id = i.drop_id
          WHERE i.order_id = $1`,
        [orderId],
      ),
    );

    return {
      id: order.id,
      userId: order.user_id,
      reference: order.reference,
      status: order.status,
      totalCop: order.total_cop,
      totalUsdCents: order.total_usd_cents,
      createdAt: order.created_at,
      contractId: order.contract_id,
      items: items.map(({ kind, slug, title, image, signed }) => ({ kind, slug, title, image, signed })),
      tracking: this.tracking(order),
    };
  }

  async entitlements(userId: string): Promise<EntitlementSummary[]> {
    const rows = returnedRows<EntitlementRow>(
      await this.ds.query(
        `SELECT e.id, d.slug, d.title, e.first_played_at, e.expires_at
           FROM entitlements e JOIN drops d ON d.id = e.drop_id
          WHERE e.user_id = $1 ORDER BY e.granted_at DESC`,
        [userId],
      ),
    );
    return rows.map((r) => this.toEntitlement(r));
  }

  /**
   * One access by id. Scoped to its owner, so a guessed id returns nothing
   * rather than telling a stranger the access exists.
   */
  async findEntitlement(id: string, userId: string): Promise<EntitlementSummary | null> {
    const row = firstRow<EntitlementRow & { email: string }>(
      await this.ds.query(
        `SELECT e.id, d.slug, d.title, e.first_played_at, e.expires_at, u.email
           FROM entitlements e
           JOIN drops d ON d.id = e.drop_id
           JOIN users u ON u.id = e.user_id
          WHERE e.id = $1 AND e.user_id = $2`,
        [id, userId],
      ),
    );
    return row ? { ...this.toEntitlement(row), viewerEmail: row.email } : null;
  }

  private toEntitlement(row: EntitlementRow): EntitlementSummary {
    const open = row.expires_at !== null && row.expires_at.getTime() > Date.now();
    return {
      id: row.id,
      dropSlug: row.slug,
      dropTitle: row.title,
      firstPlayedAt: row.first_played_at,
      expiresAt: row.expires_at,
      state: row.first_played_at === null ? 'unopened' : open ? 'open' : 'consumed',
    };
  }

  private tracking(order: OrderRow): OrderTracking | null {
    if (!order.tracking_number || !order.tracking_carrier) return null;
    const build = TRACKING_URLS[order.tracking_carrier.trim().toLowerCase()];
    return {
      number: order.tracking_number,
      carrier: order.tracking_carrier,
      url: build ? build(encodeURIComponent(order.tracking_number)) : null,
    };
  }
}
