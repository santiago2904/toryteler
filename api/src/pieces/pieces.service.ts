import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { affectedRows, firstRow, returnedRows } from '../database/rows';

/** What the shop shows in the grid. Mirrored in web/lib/types.ts. */
export interface PieceSummary {
  slug: string;
  title: string;
  priceCop: number;
  images: string[];
  /** 1 is an irreplaceable piece; more than 1, an edition. */
  stock: number;
  available: boolean;
}

export interface PieceDetail extends PieceSummary {
  id: string;
  description: string | null;
  story: string | null;
  soldAt: Date | null;
}

interface PieceRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  story: string | null;
  price_cop: number;
  images: string[];
  stock: number;
  sold_at: Date | null;
}

@Injectable()
export class PiecesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * The catalogue. A sold-out piece stays listed on purpose: the grid is a body
   * of work before it is a shop, and what already went says as much as what is
   * left. Drafts and archived pieces are not published and never appear.
   */
  async listPublished(): Promise<PieceSummary[]> {
    const rows = returnedRows<PieceRow>(
      await this.ds.query(
        `SELECT slug, title, price_cop, images, stock
           FROM pieces
          WHERE status = 'available' AND published_at IS NOT NULL
          ORDER BY published_at DESC`,
      ),
    );
    return rows.map((r) => this.toSummary(r));
  }

  /**
   * One piece by its address. The personal note is deliberately absent: it is
   * written for whoever buys it and travels with the order, not with the page.
   */
  async findBySlug(slug: string): Promise<PieceDetail | null> {
    const row = firstRow<PieceRow>(
      await this.ds.query(
        `SELECT id, slug, title, description, story, price_cop, images, stock, sold_at
           FROM pieces
          WHERE slug = $1 AND status = 'available' AND published_at IS NOT NULL`,
        [slug],
      ),
    );
    if (!row) return null;

    return {
      ...this.toSummary(row),
      id: row.id,
      description: row.description,
      story: row.story,
      soldAt: row.sold_at,
    };
  }

  private toSummary(row: PieceRow): PieceSummary {
    return {
      slug: row.slug,
      title: row.title,
      priceCop: row.price_cop,
      images: row.images,
      stock: row.stock,
      available: row.stock > 0,
    };
  }

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
