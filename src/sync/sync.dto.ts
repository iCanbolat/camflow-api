import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SyncMutationDto {
  /** Client-unique key for replay-safe idempotency (e.g. a UUID per mutation). */
  @IsString()
  @MaxLength(200)
  idempotencyKey: string;

  /** Entity key from the push registry (e.g. 'project', 'photo', 'task'). */
  @IsString()
  @MaxLength(60)
  entity: string;

  @IsIn(['upsert', 'delete'])
  op: 'upsert' | 'delete';

  @IsUUID()
  id: string;

  @IsUUID()
  organizationId: string;

  /** Client's last-modified timestamp; drives Last-Write-Wins resolution. */
  @IsISO8601()
  updatedAt: string;

  @IsOptional()
  @IsISO8601()
  createdAt?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class SyncPushDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationDto)
  mutations: SyncMutationDto[];
}

export class SyncPullQueryDto {
  @IsUUID()
  organizationId: string;

  /** Last row_version the client has seen; 0/absent = full bootstrap. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  since?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
