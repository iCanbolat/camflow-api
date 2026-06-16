import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ASSIGNABLE_ROLES } from './permissions';

const PLAN_TIERS = ['basic', 'pro', 'premium'] as const;
const STORAGE_ADD_ONS = ['none', 'plus50', 'plus250', 'plus1tb'] as const;

export class CreateOrganizationDto {
  /** Optional client UUID so an offline-created org keeps its id when it syncs. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  website?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoFileName?: string;
}

export class SetPlanDto {
  @IsIn(PLAN_TIERS)
  planTier: (typeof PLAN_TIERS)[number];
}

export class SetStorageAddOnDto {
  @IsIn(STORAGE_ADD_ONS)
  storageAddOn: (typeof STORAGE_ADD_ONS)[number];
}

export class InviteMemberDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: (typeof ASSIGNABLE_ROLES)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  projectIds?: string[];
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class SetMemberRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role: (typeof ASSIGNABLE_ROLES)[number];
}
