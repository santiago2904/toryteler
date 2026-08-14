import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('entitlements')
export class Entitlement {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'drop_id' }) dropId!: string;
  @Column({ type: 'uuid', name: 'order_id' }) orderId!: string;
  @Column({ type: 'timestamptz', name: 'granted_at' }) grantedAt!: Date;
  /** Opening the window is what starts the clock; null means untouched. */
  @Column({ type: 'timestamptz', name: 'first_played_at', nullable: true })
  firstPlayedAt!: Date | null;
  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true }) expiresAt!: Date | null;
  @Column({ type: 'int', name: 'views_used', default: 0 }) viewsUsed!: number;
}
