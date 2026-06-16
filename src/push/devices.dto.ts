import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(400)
  token: string;

  @IsOptional()
  @IsIn(['ios'])
  platform?: 'ios';
}
