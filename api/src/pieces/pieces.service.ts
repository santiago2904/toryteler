import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { affectedRows } from '../database/rows';

@Injectable()
export class PiecesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Takes one unit. Postgres serialises writes to the same row, so two
   * simultaneous buyers never read the same balance, and the column's CHECK
   * makes dropping below zero impossible even if this query were wrong.
   *
   * Accepts an EntityManager so payment settlement can take a unit inside its
   * own transaction.
   */
  async take(pieceId: string, manager?: EntityManager): Promise<boolean> {
    const runner = manager ?? this.ds;
    const result = await runner.query(
      `UPDATE pieces
          SET stock = stock - 1,
              -- Stamp the moment it ran out, only on the unit that empties it.
              sold_at = CASE WHEN stock - 1 = 0 THEN now() ELSE sold_at END
        WHERE id = $1 AND stock > 0 AND status = 'available'`,
      [pieceId],
    );
    return affectedRows(result) === 1;
  }

  /** Gives a unit back when a payment fails or an order expires. */
  async release(pieceId: string, manager?: EntityManager): Promise<void> {
    const runner = manager ?? this.ds;
    await runner.query(
      `UPDATE pieces SET stock = stock + 1, sold_at = NULL WHERE id = $1`,
      [pieceId],
    );
  }
}
