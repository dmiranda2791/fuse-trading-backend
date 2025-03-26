import {
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';

export abstract class BaseEntity {
  @ApiHideProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiHideProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiHideProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export abstract class BaseEntityWithSymbol extends BaseEntity {
  abstract symbol: string;
}

export abstract class BaseEntityWithUserId extends BaseEntity {
  abstract userId: string;
}
