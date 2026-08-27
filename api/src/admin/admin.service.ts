import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { affectedRows, firstRow, returnedRows } from '../database/rows';

export interface TeamMember {
  id: string;
  email: string;
}

/** The catalogue as the artist sees it, drafts included. */
export interface AdminPiece {
  id: string;
  slug: string;
  title: string;
  priceCop: number;
  images: string[];
  stock: number;
  status: string;
  /** Copies already paid for, which decides what the unpublish dialog warns about. */
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

export interface AdminOrderItem {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
  /** The buyer asked for this one signed. Always false on a video. */
  signed: boolean;
}

/** A sale as the artist needs to see it: enough to pack it and to answer for it. */
export interface AdminOrder {
  id: string;
  reference: string;
  status: string;
  totalCop: number;
  createdAt: Date;
  shippedAt: Date | null;
  buyer: { email: string; fullName: string | null };
  shippingAddress: Record<string, string> | null;
  tracking: { carrier: string; number: string } | null;
  contract: { id: string; status: string } | null;
  items: AdminOrderItem[];
  needsShipping: boolean;
}

export interface NewPiece {
  title: string;
  description?: string | null;
  story?: string | null;
  personalNote?: string | null;
  priceCop: number;
  stock: number;
  images: string[];
}

export interface NewDrop {
  title: string;
  description?: string | null;
  priceCop: number;
  videoAssetId: string;
  posterImage?: string | null;
  capacity: number | null;
  viewWindowHours: number;
}

/** Columns the artist may change after the fact, mapped to their table names. */
const PIECE_FIELDS: Record<string, string> = {
  title: 'title',
  description: 'description',
  story: 'story',
  personalNote: 'personal_note',
  priceCop: 'price_cop',
  stock: 'stock',
  images: 'images',
};

const DROP_FIELDS: Record<string, string> = {
  title: 'title',
  description: 'description',
  priceCop: 'price_cop',
  posterImage: 'poster_image',
  capacity: 'capacity',
  viewWindowHours: 'view_window_hours',
};

@Injectable()
export class AdminService {
  private readonly log = new Logger(AdminService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auth: AuthService,
  ) {}

  /**
   * Creates a piece as a draft. The artist never types an address: it is built
   * from the title, because a form asking for a URL is a form that gets a URL
   * nobody meant to publish.
   */
  async createPiece(piece: NewPiece): Promise<{ id: string; slug: string }> {
    const slug = await this.uniqueSlug('pieces', piece.title);
    const row = firstRow<{ id: string }>(
      await this.ds.query(
        `INSERT INTO pieces (slug, title, description, story, personal_note, price_cop, stock, images)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          slug,
          piece.title,
          piece.description ?? null,
          piece.story ?? null,
          piece.personalNote ?? null,
          piece.priceCop,
          piece.stock,
          JSON.stringify(piece.images),
        ],
      ),
    );
    return { id: row!.id, slug };
  }

  async createDrop(drop: NewDrop): Promise<{ id: string; slug: string }> {
    const slug = await this.uniqueSlug('drops', drop.title);
    const row = firstRow<{ id: string }>(
      await this.ds.query(
        `INSERT INTO drops (slug, title, description, price_cop, video_asset_id, poster_image,
                            capacity, view_window_hours)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          slug,
          drop.title,
          drop.description ?? null,
          drop.priceCop,
          drop.videoAssetId,
          drop.posterImage ?? null,
          drop.capacity,
          drop.viewWindowHours,
        ],
      ),
    );
    return { id: row!.id, slug };
  }

  async updatePiece(id: string, changes: Partial<NewPiece>): Promise<void> {
    await this.applyChanges('pieces', PIECE_FIELDS, id, changes, 'PIECE_NOT_FOUND');
  }

  /**
   * Editing a video, capacity included.
   *
   * Capacity is the one field with a floor: it may rise freely, but lowering it
   * below what has already been sold would revoke access somebody paid for.
   * The row is locked first so a sale landing mid-edit is counted.
   */
  async updateDrop(id: string, changes: Partial<NewDrop>): Promise<void> {
    await this.ds.transaction(async (m) => {
      const drop = firstRow<{ id: string }>(
        await m.query(`SELECT id FROM drops WHERE id = $1 FOR UPDATE`, [id]),
      );
      if (!drop) throw new NotFoundException('DROP_NOT_FOUND');

      if (changes.capacity !== undefined && changes.capacity !== null) {
        const granted = firstRow<{ count: number }>(
          await m.query(`SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`, [id]),
        );
        if (changes.capacity < (granted?.count ?? 0)) {
          throw new ConflictException('CAPACITY_BELOW_GRANTED');
        }
      }

      await this.applyChanges('drops', DROP_FIELDS, id, changes, 'DROP_NOT_FOUND', m);
    });
  }

  /**
   * Puts something in the shop, or takes it out.
   *
   * Taking it out only removes it from the shop. Whoever bought it keeps what
   * they bought — the catalogue is a shelf, not the ledger.
   *
   * The original publication date survives an unlisting: the catalogue is
   * ordered by it, and coming back after a correction should not push a piece
   * to the front as if it were new.
   */
  async setPieceListed(id: string, listed: boolean): Promise<void> {
    await this.setListed('pieces', id, listed, 'PIECE_NOT_FOUND');
  }

  async setDropListed(id: string, listed: boolean): Promise<void> {
    await this.setListed('drops', id, listed, 'DROP_NOT_FOUND');
  }

  /**
   * Records a shipment. Only against a paid order: a tracking number on
   * anything else means a package left for a sale that never happened.
   *
   * Re-running it overwrites, because the usual reason to run it twice is a
   * number typed wrong the first time.
   */
  async markShipped(orderId: string, tracking: { carrier: string; number: string }): Promise<void> {
    const result = await this.ds.query(
      `UPDATE orders
          SET tracking_carrier = $2, tracking_number = $3, shipped_at = now()
        WHERE id = $1 AND status = 'paid'`,
      [orderId, tracking.carrier, tracking.number],
    );
    if (affectedRows(result) === 0) throw new BadRequestException('ORDER_NOT_PAID');
  }

  /**
   * The catalogue as the artist sees it: drafts included, and with how many of
   * each have already been sold.
   *
   * The public endpoint cannot serve this — it hides drafts by design, so a
   * piece saved as a draft would vanish the moment it was created. The sold
   * count is what the unpublish dialog needs to say whether anybody is holding
   * one already.
   */
  async listPieces(): Promise<AdminPiece[]> {
    const rows = returnedRows<{
      id: string; slug: string; title: string; price_cop: number; images: string[];
      stock: number; status: string; sold: number;
    }>(
      await this.ds.query(
        `SELECT p.id, p.slug, p.title, p.price_cop, p.images, p.stock, p.status,
                (SELECT count(*)::int
                   FROM order_items i JOIN orders o ON o.id = i.order_id
                  WHERE i.piece_id = p.id AND o.status = 'paid') AS sold
           FROM pieces p
          WHERE p.status <> 'archived'
          -- Drafts first: they are the ones waiting for a decision.
          ORDER BY p.published_at DESC NULLS FIRST, p.slug`,
      ),
    );
    return rows.map((r) => ({
      id: r.id, slug: r.slug, title: r.title, priceCop: r.price_cop,
      images: r.images, stock: r.stock, status: r.status, sold: r.sold,
    }));
  }

  async listDrops(): Promise<AdminDrop[]> {
    const rows = returnedRows<{
      id: string; slug: string; title: string; price_cop: number; poster_image: string | null;
      capacity: number | null; view_window_hours: number; status: string; sold: number;
    }>(
      await this.ds.query(
        `SELECT d.id, d.slug, d.title, d.price_cop, d.poster_image, d.capacity,
                d.view_window_hours, d.status,
                (SELECT count(*)::int FROM entitlements e WHERE e.drop_id = d.id) AS sold
           FROM drops d
          WHERE d.status <> 'archived'
          ORDER BY d.published_at DESC NULLS FIRST, d.slug`,
      ),
    );
    return rows.map((r) => ({
      id: r.id, slug: r.slug, title: r.title, priceCop: r.price_cop,
      posterImage: r.poster_image, capacity: r.capacity,
      viewWindowHours: r.view_window_hours, status: r.status, sold: r.sold,
    }));
  }

  /**
   * One piece for the edit form, whatever its state.
   *
   * The public endpoint refuses drafts — that is its job — so editing one
   * through it is impossible, which is exactly what a draft is for. The
   * personal note comes along: the artist wrote it and has to be able to see
   * what it says before changing it.
   */
  async findPiece(slug: string) {
    const row = firstRow<Record<string, unknown>>(
      await this.ds.query(
        `SELECT id, slug, title, description, story, personal_note, price_cop,
                images, stock, status, sold_at
           FROM pieces WHERE slug = $1`,
        [slug],
      ),
    );
    if (!row) throw new NotFoundException('PIECE_NOT_FOUND');

    return {
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      story: row.story, personalNote: row.personal_note, priceCop: row.price_cop,
      images: row.images, stock: row.stock, status: row.status, soldAt: row.sold_at,
      available: (row.stock as number) > 0,
    };
  }

  async findDrop(slug: string) {
    const row = firstRow<Record<string, unknown>>(
      await this.ds.query(
        `SELECT d.id, d.slug, d.title, d.description, d.price_cop, d.video_asset_id,
                d.poster_image, d.capacity, d.view_window_hours, d.status,
                (SELECT count(*)::int FROM entitlements e WHERE e.drop_id = d.id) AS sold
           FROM drops d WHERE d.slug = $1`,
        [slug],
      ),
    );
    if (!row) throw new NotFoundException('DROP_NOT_FOUND');

    const capacity = row.capacity as number | null;
    const sold = row.sold as number;
    return {
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      priceCop: row.price_cop, videoAssetId: row.video_asset_id,
      posterImage: row.poster_image, capacity,
      viewWindowHours: row.view_window_hours, status: row.status, sold,
      remaining: capacity === null ? null : Math.max(0, capacity - sold),
      soldOut: capacity !== null && sold >= capacity,
    };
  }

  /**
   * Everything sold, newest first, with who bought it and where it goes.
   *
   * This is the screen the artist works from, so it carries what packing a box
   * needs — address, phone, what is in it — and the contract, which is the
   * other thing worth opening from here.
   */
  async orders(limit = 200): Promise<AdminOrder[]> {
    const orders = returnedRows<{
      id: string; reference: string; status: string; total_cop: number;
      created_at: Date; shipped_at: Date | null;
      tracking_carrier: string | null; tracking_number: string | null;
      shipping_address: Record<string, string> | null;
      email: string; full_name: string | null;
      contract_id: string | null; contract_status: string | null;
    }>(
      await this.ds.query(
        `SELECT o.id, o.reference, o.status, o.total_cop, o.created_at, o.shipped_at,
                o.tracking_carrier, o.tracking_number, o.shipping_address,
                u.email, u.full_name,
                c.id AS contract_id, c.status AS contract_status
           FROM orders o
           JOIN users u ON u.id = o.user_id
           LEFT JOIN contracts c ON c.order_id = o.id
          ORDER BY o.created_at DESC
          LIMIT $1`,
        [limit],
      ),
    );
    if (orders.length === 0) return [];

    const items = returnedRows<{
      order_id: string; kind: 'piece' | 'drop'; slug: string; title: string;
      image: string | null; signed: boolean;
    }>(
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
      createdAt: o.created_at,
      shippedAt: o.shipped_at,
      buyer: { email: o.email, fullName: o.full_name },
      shippingAddress: o.shipping_address,
      tracking: o.tracking_number && o.tracking_carrier
        ? { carrier: o.tracking_carrier, number: o.tracking_number }
        : null,
      contract: o.contract_id ? { id: o.contract_id, status: o.contract_status! } : null,
      items: items
        .filter((i) => i.order_id === o.id)
        .map(({ kind, slug, title, image, signed }) => ({ kind, slug, title, image, signed })),
      // What decides whether a box has to be packed at all.
      needsShipping: items.some((i) => i.order_id === o.id && i.kind === 'piece'),
    }));
  }

  /** Signed contracts. The PDF link is authenticated: it carries an ID number. */
  async contracts(limit = 200) {
    return returnedRows(
      await this.ds.query(
        `SELECT c.id, c.pdf_url, c.status, c.signed_at, o.reference, u.full_name, u.document_id
           FROM contracts c
           JOIN orders o ON o.id = c.order_id
           JOIN users u ON u.id = o.user_id
          ORDER BY c.signed_at DESC NULLS LAST
          LIMIT $1`,
        [limit],
      ),
    );
  }

  /** Who can open the studio, right now. */
  async listTeam(): Promise<TeamMember[]> {
    return returnedRows<TeamMember>(
      await this.ds.query(`SELECT id, email FROM users WHERE is_admin ORDER BY email`),
    );
  }

  /**
   * Gives someone the artist's role. The same `upsertUserByEmail` a magic
   * link uses — there is still no "register" step, admin or otherwise.
   *
   * A magic link goes out right away: the point of adding someone is that
   * they can get in, not that they have to separately ask for a way in. A
   * bounced invite does not undo the promotion — it already happened — so a
   * failure here only gets logged, the same way a receipt that fails to send
   * does not undo a payment.
   */
  async addToTeam(email: string): Promise<TeamMember> {
    const userId = await this.auth.upsertUserByEmail(email);
    await this.ds.query(`UPDATE users SET is_admin = true WHERE id = $1`, [userId]);

    try {
      await this.auth.requestMagicLink(email);
    } catch (err) {
      this.log.warn(`No se pudo enviar el enlace de acceso a ${email}: ${String(err)}`);
    }

    return { id: userId, email };
  }

  /**
   * Takes it away. Two things it must never do: let someone remove their own
   * access by mistake — the only way back in then would be the SQL escape
   * hatch this screen exists to avoid — and empty the studio of everyone who
   * could open it. The admin list is locked for the length of the check so
   * two removals racing each other cannot both leave zero.
   */
  async removeFromTeam(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) throw new BadRequestException('CANNOT_REMOVE_SELF');

    await this.ds.transaction(async (m) => {
      const admins = returnedRows<{ id: string }>(
        await m.query(`SELECT id FROM users WHERE is_admin FOR UPDATE`),
      );
      if (!admins.some((a) => a.id === id)) throw new NotFoundException('NOT_ADMIN');
      if (admins.length <= 1) throw new BadRequestException('LAST_ADMIN');

      await m.query(`UPDATE users SET is_admin = false WHERE id = $1`, [id]);
    });
  }

  private async setListed(
    table: 'pieces' | 'drops',
    id: string,
    listed: boolean,
    notFound: string,
  ): Promise<void> {
    const result = listed
      ? await this.ds.query(
          `UPDATE ${table} SET status = 'available', published_at = COALESCE(published_at, now())
            WHERE id = $1 AND status <> 'archived'`,
          [id],
        )
      : await this.ds.query(
          `UPDATE ${table} SET status = 'draft' WHERE id = $1 AND status = 'available'`,
          [id],
        );
    if (affectedRows(result) === 0) throw new NotFoundException(notFound);
  }

  /**
   * Writes only the fields that were sent. A missing field means "leave it",
   * which is not the same as a field sent empty — and an edit form that posts
   * three fields must not blank out the other five.
   */
  private async applyChanges(
    table: 'pieces' | 'drops',
    allowed: Record<string, string>,
    id: string,
    changes: Record<string, unknown>,
    notFound: string,
    manager?: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  ): Promise<void> {
    const entries = Object.entries(changes).filter(([key]) => key in allowed);
    if (entries.length === 0) return;

    const assignments = entries.map(([key], i) => `${allowed[key]} = $${i + 2}`);
    const values = entries.map(([key, value]) =>
      key === 'images' ? JSON.stringify(value) : value,
    );

    const runner = manager ?? this.ds;
    const result = await runner.query(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $1`,
      [id, ...values],
    );
    if (affectedRows(result) === 0) throw new NotFoundException(notFound);
  }

  /**
   * "Prueba de color — Casa 42" becomes "prueba-de-color-casa-42".
   *
   * A collision gets a short suffix rather than an error: two pieces may
   * honestly share a title, and the artist should not have to invent one.
   */
  private async uniqueSlug(table: 'pieces' | 'drops', title: string): Promise<string> {
    const base =
      title
        .normalize('NFD')
        // Strips the accents NFD just separated, so "canción" survives as
        // "cancion" instead of losing the letter entirely.
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'sin-titulo';

    const taken = firstRow<{ id: string }>(
      await this.ds.query(`SELECT id FROM ${table} WHERE slug = $1`, [base]),
    );
    if (!taken) return base;

    return `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
