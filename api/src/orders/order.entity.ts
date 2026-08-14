import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type PaymentMethod = 'CARD' | 'PSE' | 'NEQUI';

/**
 * How long an order may sit unpaid before its units go back. PSE is
 * structurally slow — the buyer leaves for their bank, types a password and a
 * token — so a single deadline would strand those payments.
 */
export const ORDER_DEADLINE_MINUTES: Record<PaymentMethod, number> = {
  CARD: 15,
  PSE: 45,
  NEQUI: 20,
};

export const PAYMENT_METHODS = Object.keys(ORDER_DEADLINE_MINUTES) as PaymentMethod[];

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'text', default: 'pending' }) status!: OrderStatus;
  @Column({ type: 'int', name: 'total_cop' }) totalCop!: number;
  @Column({ type: 'text', name: 'payment_method' }) paymentMethod!: PaymentMethod;
  @Column({ type: 'jsonb', name: 'shipping_address', nullable: true })
  shippingAddress!: Record<string, string> | null;
  @Column({ type: 'text' }) reference!: string;
  @Column({ type: 'text', name: 'wompi_transaction_id', nullable: true })
  wompiTransactionId!: string | null;
  @Column({ type: 'text', name: 'tracking_carrier', nullable: true })
  trackingCarrier!: string | null;
  @Column({ type: 'text', name: 'tracking_number', nullable: true })
  trackingNumber!: string | null;
  @Column({ type: 'timestamptz', name: 'shipped_at', nullable: true }) shippedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true }) paidAt!: Date | null;
}
