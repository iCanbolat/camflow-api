import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators';
import { AuthService } from './auth.service';
import {
  AppleSignInDto,
  GoogleSignInDto,
  RefreshDto,
  SignInDto,
  SignUpDto,
} from './auth.dto';
import { requestContext } from './auth.util';

// Tighter throttle on credential endpoints than the global default.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() dto: SignUpDto, @Req() req: Request) {
    return this.auth.signUp(dto, requestContext(req));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: SignInDto, @Req() req: Request) {
    return this.auth.signIn(dto, requestContext(req));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('apple')
  @HttpCode(HttpStatus.OK)
  apple(@Body() dto: AppleSignInDto, @Req() req: Request) {
    return this.auth.appleSignIn(dto, requestContext(req));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google(@Body() dto: GoogleSignInDto, @Req() req: Request) {
    return this.auth.googleSignIn(dto, requestContext(req));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, requestContext(req));
  }

  // Authenticated: revokes the presented refresh token's whole family.
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(@Body() dto: RefreshDto) {
    return this.auth.signOut(dto.refreshToken);
  }
}
