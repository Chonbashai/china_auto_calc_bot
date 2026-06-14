import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('calculation_history')
export class CalculationHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'telegram_user_id', type: 'bigint' })
  telegramUserId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username!: string | null;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  model!: string | null;

  @Column({ type: 'int', default: 1 })
  month!: number;

  @Column({ type: 'int' })
  year!: number;

  @Column({ name: 'bank_commission_rate', type: 'decimal', precision: 6, scale: 4, default: 0.025 })
  bankCommissionRate!: number;

  @Column({ name: 'engine_volume', type: 'int' })
  engineVolume!: number;

  @Column({ type: 'int' })
  kw!: number;

  @Column({ name: 'cost_yuan', type: 'decimal', precision: 14, scale: 2 })
  costYuan!: number;

  @Column({ name: 'yuan_rate', type: 'decimal', precision: 10, scale: 4 })
  yuanRate!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  customs!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  invoice!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  total!: number;
}
