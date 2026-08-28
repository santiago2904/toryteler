import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { PiecesService } from '../pieces/pieces.service';
import { ExchangeRateService } from '../payments/exchange-rate.service';
import { firstRow, returnedRows } from '../database/rows';
import { PaymentMethod } from './order.entity';

export interface CreateOrderInput {
  pieceSlugs: string[];
  dropSlugs: string[];
  paymentMethod: PaymentMethod;
  shippingAddress?: { line1: string; city: string; phone: string };
  /**
   * Which of the pieces the buyer wants signed by the artist. A subset of
   * `pieceSlugs`; anything else in it is ignored rather than rejected, because
   * a slug that names nothing being bought asks for nothing.
   */
  signedPieceSlugs?: string[];
}

export interface CreatedOrder {
  id: string;
  reference: string;
  totalCop: number;
  totalUsdCents: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly pieces: PiecesService,
    private readonly rates: ExchangeRateService,
  ) {}

  /**
   * Creates the order and takes the units right away, so whoever reaches the
   * checkout first holds them while filling in data, reading the contract and
   * paying.
   *
   * Prices are read from the database, never from the request: the browser
   * sends identifiers only. Otherwise editing localStorage would edit the
   * price.
   *
   * Videos are not taken here — their seat is issued when the payment settles,
   * because an entitlement is a right to watch and it must not exist before the
   * money does.
   */
  async create(userId: string, input: CreateOrderInput): Promise<CreatedOrder> {
    if (input.pieceSlugs.length === 0 && input.dropSlugs.length === 0) {
      throw new BadRequestException('EMPTY_ORDER');
    }
    if (input.pieceSlugs.length > 0 && !input.shippingAddress) {
      throw new BadRequestException('SHIPPING_REQUIRED');
    }

    const pieces = input.pieceSlugs.length
      ? returnedRows<{ id: string; slug: string; price_usd_cents: number }>(
          await this.ds.query(
            `SELECT id, slug, price_usd_cents FROM pieces
              WHERE slug = ANY($1) AND status = 'available'`,
            [input.pieceSlugs],
          ),
        )
      : [];
    if (pieces.length !== input.pieceSlugs.length) throw new ConflictException('PIECE_UNAVAILABLE');

    const drops = input.dropSlugs.length
      ? returnedRows<{ id: string; slug: string; price_usd_cents: number }>(
          await this.ds.query(
            `SELECT id, slug, price_usd_cents FROM drops
              WHERE slug = ANY($1) AND status = 'available'`,
            [input.dropSlugs],
          ),
        )
      : [];
    if (drops.length !== input.dropSlugs.length) throw new ConflictException('DROP_UNAVAILABLE');

    if (drops.length > 0) {
      // Owning one is forever, unless the window on it has already closed —
      // paying again for something you can still watch would be paying twice
      // for the same access. A consumed one (or none at all) is the only
      // thing that lets a second sale through.
      const stillUsable = firstRow<{ id: string }>(
        await this.ds.query(
          `SELECT id FROM entitlements
            WHERE user_id = $1 AND drop_id = ANY($2)
              AND (first_played_at IS NULL OR expires_at > now())`,
          [userId, drops.map((d) => d.id)],
        ),
      );
      if (stillUsable) throw new ConflictException('ALREADY_OWNED');
    }

    const copPerUsd = await this.rates.copPerUsd();
    const toCop = (usdCents: number) => Math.round((usdCents / 100) * copPerUsd);

    const taken: string[] = [];
    try {
      for (const piece of pieces) {
        if (!(await this.pieces.take(piece.id))) throw new ConflictException('PIECE_UNAVAILABLE');
        taken.push(piece.id);
      }

      const totalUsdCents =
        pieces.reduce((sum, p) => sum + p.price_usd_cents, 0) +
        drops.reduce((sum, d) => sum + d.price_usd_cents, 0);
      // Se suma lo ya redondeado por línea, no se redondea la suma: así el
      // total coincide con lo que un comprador vería sumando las líneas a mano.
      const totalCop =
        pieces.reduce((sum, p) => sum + toCop(p.price_usd_cents), 0) +
        drops.reduce((sum, d) => sum + toCop(d.price_usd_cents), 0);

      return await this.ds.transaction(async (m) => {
        const order = firstRow<{ id: string; reference: string; total_cop: number; total_usd_cents: number }>(
          await m.query(
            `INSERT INTO orders (user_id, total_cop, total_usd_cents, payment_method, shipping_address, reference)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, reference, total_cop, total_usd_cents`,
            [
              userId,
              totalCop,
              totalUsdCents,
              input.paymentMethod,
              input.shippingAddress ?? null,
              `ord_${randomBytes(12).toString('hex')}`,
            ],
          ),
        );
        if (!order) throw new Error('ORDER_INSERT_FAILED');

        const signed = new Set(input.signedPieceSlugs ?? []);
        for (const piece of pieces) {
          await m.query(
            `INSERT INTO order_items (order_id, piece_id, unit_price_cop, unit_price_usd_cents, wants_signature)
             VALUES ($1, $2, $3, $4, $5)`,
            [order.id, piece.id, toCop(piece.price_usd_cents), piece.price_usd_cents, signed.has(piece.slug)],
          );
        }
        for (const drop of drops) {
          await m.query(
            `INSERT INTO order_items (order_id, drop_id, unit_price_cop, unit_price_usd_cents)
             VALUES ($1, $2, $3, $4)`,
            [order.id, drop.id, toCop(drop.price_usd_cents), drop.price_usd_cents],
          );
        }

        return {
          id: order.id, reference: order.reference,
          totalCop: order.total_cop, totalUsdCents: order.total_usd_cents!,
        };
      });
    } catch (err) {
      // Nothing taken in this attempt may stay blocked: a failed checkout must
      // not park a unit nobody can buy.
      for (const pieceId of taken) await this.pieces.release(pieceId);
      throw err;
    }
  }
}
