import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'order_id' }) orderId!: string;
  @Column({ type: 'uuid', name: 'piece_id', nullable: true }) pieceId!: string | null;
  @Column({ type: 'uuid', name: 'drop_id', nullable: true }) dropId!: string | null;
  /** Price at the moment of purchase: a later edit must not rewrite history. */
  @Column({ type: 'int', name: 'unit_price_cop' }) unitPriceCop!: number;
}
