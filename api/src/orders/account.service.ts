import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstRow, returnedRows } from '../database/rows';

export interface OrderItem {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
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
  createdAt: Date;
  items: OrderItem[];
  tracking: OrderTracking | null;
}

export interface EntitlementSummary {
  id: string;
  dropSlug: string;
  dropTitle: string;
  firstPlayedAt: Date | null;
  expiresAt: Date | null;
  state: 'unopened' | 'open' | 'consumed';
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
  created_at: Date;
  tracking_carrier: string | null;
  tracking_number: string | null;
}

interface ItemRow {
  order_id: string;
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
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
   * Someone's own orders. An order is recognised by its photograph long before
   * its reference, so every line carries an image.
   */
  async orders(userId: string): Promise<OrderSummary[]> {
    const orders = returnedRows<OrderRow>(
      await this.ds.query(
        `SELECT id, reference, status, total_cop, created_at, tracking_carrier, tracking_number
           FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
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
                COALESCE(p.images ->> 0, d.poster_image) AS image
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
      createdAt: o.created_at,
      items: items
        .filter((i) => i.order_id === o.id)
        .map(({ kind, slug, title, image }) => ({ kind, slug, title, image })),
      tracking: this.tracking(o),
    }));
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
    const row = firstRow<EntitlementRow>(
      await this.ds.query(
        `SELECT e.id, d.slug, d.title, e.first_played_at, e.expires_at
           FROM entitlements e JOIN drops d ON d.id = e.drop_id
          WHERE e.id = $1 AND e.user_id = $2`,
        [id, userId],
      ),
    );
    return row ? this.toEntitlement(row) : null;
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
