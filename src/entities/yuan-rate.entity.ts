import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('yuan_rates')
export class YuanRate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  rate!: number;

  @Column({ type: 'varchar', length: 64, default: 'vtb' })
  source!: string;

  @CreateDateColumn({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;
}
