import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DropStatus = 'draft' | 'available' | 'closed' | 'archived';

@Entity('drops')
export class Drop {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'int', name: 'price_usd_cents' }) priceUsdCents!: number;
  @Column({ type: 'text', name: 'video_asset_id' }) videoAssetId!: string;
  @Column({ type: 'text', name: 'poster_image', nullable: true }) posterImage!: string | null;
  /** null means no limit. */
  @Column({ type: 'int', nullable: true }) capacity!: number | null;
  @Column({ type: 'int', name: 'view_window_hours', default: 24 }) viewWindowHours!: number;
  @Column({ type: 'int', name: 'max_views_per_buyer', default: 1 }) maxViewsPerBuyer!: number;
  @Column({ type: 'text', default: 'draft' }) status!: DropStatus;
  @Column({ type: 'timestamptz', name: 'published_at', nullable: true }) publishedAt!: Date | null;
}
