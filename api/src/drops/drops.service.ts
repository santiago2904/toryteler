import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { firstRow, returnedRows } from '../database/rows';

/**
 * A video as the shop shows it. Mirrored in web/lib/types.ts.
 *
 * There is no video_asset_id here, and that is the point: the asset is the
 * video. It is handed out only by POST /entitlements/:id/play, to someone whose
 * window is open.
 */
export interface DropDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceUsdCents: number;
  posterImage: string | null;
  capacity: number | null;
  remaining: number | null;
  soldOut: boolean;
  viewWindowHours: number;
}

interface DropRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_usd_cents: number;
  poster_image: string | null;
  capacity: number | null;
  view_window_hours: number;
  granted: number;
}

const PUBLIC_COLUMNS = `d.id, d.slug, d.title, d.description, d.price_usd_cents, d.poster_image,
                        d.capacity, d.view_window_hours,
                        (SELECT count(*)::int FROM entitlements e WHERE e.drop_id = d.id) AS granted`;

@Injectable()
export class DropsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Issues the right to watch. Must run inside the transaction that settles the
   * payment: locking the drop's row is what serialises buyers and makes going
   * over capacity impossible.
   *
   * A plain "count then insert" would let two simultaneous buyers both read
   * capacity - 1 and both get in. The lock is not an optimisation; without it
   * the limit is a suggestion.
   *
   * Buying the same drop twice while an earlier access is still usable is
   * refused earlier, at `OrdersService.create()` — by the time money reaches
   * here that check already passed, so a conflict on `(order_id, drop_id)`
   * only ever means this exact order's settlement is being retried (a
   * webhook arriving twice), and a retry is success, not an error.
   */
  async grantEntitlement(
    m: EntityManager,
    dropId: string,
    userId: string,
    orderId: string,
  ): Promise<string> {
    const drop = firstRow<{ id: string; capacity: number | null; status: string }>(
      await m.query(`SELECT id, capacity, status FROM drops WHERE id = $1 FOR UPDATE`, [dropId]),
    );
    if (!drop) throw new NotFoundException('DROP_NOT_FOUND');
    if (drop.status !== 'available') throw new ConflictException('DROP_NOT_AVAILABLE');

    const already = firstRow<{ id: string }>(
      await m.query(
        `SELECT id FROM entitlements WHERE order_id = $1 AND drop_id = $2`,
        [orderId, dropId],
      ),
    );
    if (already) return already.id;

    if (drop.capacity !== null) {
      const granted = firstRow<{ count: number }>(
        await m.query(`SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`, [dropId]),
      );
      if ((granted?.count ?? 0) >= drop.capacity) throw new ConflictException('SOLD_OUT');
    }

    const rows = returnedRows<{ id: string }>(
      await m.query(
        `INSERT INTO entitlements (user_id, drop_id, order_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (order_id, drop_id) DO NOTHING
         RETURNING id`,
        [userId, dropId, orderId],
      ),
    );
    if (rows.length > 0) return rows[0].id;

    // Lost a race against another settlement of this exact order — the drop's
    // row lock above already makes this unreachable in practice, but the
    // fallback costs one query and keeps the method correct on its own.
    const raced = firstRow<{ id: string }>(
      await m.query(
        `SELECT id FROM entitlements WHERE order_id = $1 AND drop_id = $2`,
        [orderId, dropId],
      ),
    );
    return raced!.id;
  }

  /** Seats left, or null when the drop has no limit. */
  async seatsLeft(dropId: string): Promise<number | null> {
    const row = firstRow<{ capacity: number | null; granted: number }>(
      await this.ds.query(
        `SELECT d.capacity,
                (SELECT count(*)::int FROM entitlements e WHERE e.drop_id = d.id) AS granted
           FROM drops d WHERE d.id = $1`,
        [dropId],
      ),
    );
    if (!row || row.capacity === null) return null;
    return Math.max(0, row.capacity - row.granted);
  }

  /** The videos on sale, newest first. */
  async listPublished(): Promise<DropDetail[]> {
    const rows = returnedRows<DropRow>(
      await this.ds.query(
        `SELECT ${PUBLIC_COLUMNS}
           FROM drops d
          WHERE d.status = 'available' AND d.published_at IS NOT NULL
          ORDER BY d.published_at DESC`,
      ),
    );
    return rows.map((r) => this.toDetail(r));
  }

  async findBySlug(slug: string): Promise<DropDetail | null> {
    const row = firstRow<DropRow>(
      await this.ds.query(
        `SELECT ${PUBLIC_COLUMNS}
           FROM drops d
          WHERE d.slug = $1 AND d.status = 'available' AND d.published_at IS NOT NULL`,
        [slug],
      ),
    );
    return row ? this.toDetail(row) : null;
  }

  private toDetail(row: DropRow): DropDetail {
    // No capacity means no limit, which is not the same as no seats left.
    const remaining = row.capacity === null ? null : Math.max(0, row.capacity - row.granted);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      priceUsdCents: row.price_usd_cents,
      posterImage: row.poster_image,
      capacity: row.capacity,
      remaining,
      soldOut: remaining === 0,
      viewWindowHours: row.view_window_hours,
    };
  }
}
