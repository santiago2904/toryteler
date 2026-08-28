import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El precio de catálogo pasa a fijarse en dólares — pieces.price_cop y
 * drops.price_cop se renombran a price_usd_cents. orders.total_cop y
 * order_items.unit_price_cop NO se tocan: siguen siendo lo que Wompi cobra
 * de verdad, congelado en pesos al crear el pedido (ver
 * OrdersService.create). Lo que sí se agrega es el lado en dólares de esos
 * dos, para poder mostrarlo después — nulo a propósito: nada que mueve
 * dinero los lee nunca, así que no hace falta retrocompletar cada fixture
 * de prueba que inserta un pedido por SQL directo.
 */
export class CurrencyUsd1756100000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE pieces RENAME COLUMN price_cop TO price_usd_cents`);
    await q.query(`ALTER TABLE pieces RENAME CONSTRAINT pieces_price_cop_check TO pieces_price_usd_cents_check`);

    await q.query(`ALTER TABLE drops RENAME COLUMN price_cop TO price_usd_cents`);
    await q.query(`ALTER TABLE drops RENAME CONSTRAINT drops_price_cop_check TO drops_price_usd_cents_check`);

    await q.query(`
      ALTER TABLE orders ADD COLUMN total_usd_cents integer
        CHECK (total_usd_cents IS NULL OR total_usd_cents > 0)`);
    await q.query(`
      ALTER TABLE order_items ADD COLUMN unit_price_usd_cents integer
        CHECK (unit_price_usd_cents IS NULL OR unit_price_usd_cents > 0)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE order_items DROP COLUMN unit_price_usd_cents`);
    await q.query(`ALTER TABLE orders DROP COLUMN total_usd_cents`);

    await q.query(`ALTER TABLE drops RENAME CONSTRAINT drops_price_usd_cents_check TO drops_price_cop_check`);
    await q.query(`ALTER TABLE drops RENAME COLUMN price_usd_cents TO price_cop`);

    await q.query(`ALTER TABLE pieces RENAME CONSTRAINT pieces_price_usd_cents_check TO pieces_price_cop_check`);
    await q.query(`ALTER TABLE pieces RENAME COLUMN price_usd_cents TO price_cop`);
  }
}
