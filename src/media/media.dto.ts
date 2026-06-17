import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class UploadTicketDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  photoId: string;

  @IsIn(['photo', 'video'])
  mediaType: 'photo' | 'video';

  @Matches(/^[a-z0-9]{1,5}$/i, { message: 'ext must be 1-5 alphanumerics' })
  ext: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  byteSize: number;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class CommitUploadDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  photoId: string;

  @IsString()
  objectKey: string;

  @IsIn(['photo', 'video'])
  mediaType: 'photo' | 'video';

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class MediaScopeQueryDto {
  @IsUUID()
  organizationId: string;
}
