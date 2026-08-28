import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PieceStatus = 'draft' | 'available' | 'archived';

@Entity('pieces')
export class Piece {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  /** Provenance: where it comes from and why it matters. */
  @Column({ type: 'text', nullable: true }) story!: string | null;
  @Column({ type: 'text', name: 'personal_note', nullable: true }) personalNote!: string | null;
  @Column({ type: 'int', name: 'price_usd_cents' }) priceUsdCents!: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) images!: string[];
  /** 1 is an irreplaceable piece; more than 1, an edition. */
  @Column({ type: 'int' }) stock!: number;
  @Column({ type: 'text', default: 'draft' }) status!: PieceStatus;
  @Column({ type: 'timestamptz', name: 'published_at', nullable: true }) publishedAt!: Date | null;
  /** When it ran out. */
  @Column({ type: 'timestamptz', name: 'sold_at', nullable: true }) soldAt!: Date | null;
}
