import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { firstRow, returnedRows } from '../database/rows';

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
         ON CONFLICT (user_id, drop_id) DO NOTHING
         RETURNING id`,
        [userId, dropId, orderId],
      ),
    );
    if (rows.length === 0) throw new ConflictException('ALREADY_OWNED');
    return rows[0].id;
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
}
