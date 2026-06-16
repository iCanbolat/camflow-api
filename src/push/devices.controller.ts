import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(user.id, dto);
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  unregister(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.devices.unregister(user.id, token);
  }
}
