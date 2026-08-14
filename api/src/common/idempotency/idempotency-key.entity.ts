import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'text' }) key!: string;
  @Column({ type: 'uuid', name: 'user_id', nullable: true }) userId!: string | null;
  @Column({ type: 'text' }) endpoint!: string;
  @Column({ type: 'text', name: 'request_hash' }) requestHash!: string;
  @Column({ type: 'jsonb', name: 'response_body', nullable: true }) responseBody!: unknown;
  @Column({ type: 'int', name: 'status_code', nullable: true }) statusCode!: number | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}
