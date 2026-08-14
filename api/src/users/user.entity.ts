import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) email!: string;
  @Column({ type: 'text', name: 'full_name', nullable: true }) fullName!: string | null;
  /** Cédula. Required before signing a contract, not before browsing. */
  @Column({ type: 'text', name: 'document_id', nullable: true }) documentId!: string | null;
  @Column({ type: 'text', nullable: true }) phone!: string | null;
  @Column({ type: 'boolean', name: 'is_admin', default: false }) isAdmin!: boolean;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}
