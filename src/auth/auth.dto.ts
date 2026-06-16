import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  @MaxLength(200)
  password: string;

  @IsString()
  @MaxLength(200)
  displayName: string;
}

export class SignInDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class AppleSignInDto {
  @IsString()
  identityToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;
}

export class GoogleSignInDto {
  @IsString()
  idToken: string;
}
