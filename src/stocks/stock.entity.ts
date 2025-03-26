import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('stocks')
export class Stock {
  @PrimaryColumn({ name: 'symbol' })
  symbol: string;

  @Column({ name: 'name' })
  name: string;

  @Column('decimal', { precision: 10, scale: 2, name: 'price' })
  price: number;

  @Index()
  @Column({ nullable: true, name: 'last_fetched_at' })
  lastFetchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
