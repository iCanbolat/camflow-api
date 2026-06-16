import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import {
  CommitUploadDto,
  MediaScopeQueryDto,
  UploadTicketDto,
} from './media.dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Request a signed direct-upload ticket (no bytes here). */
  @Post('upload-ticket')
  ticket(@CurrentUser() user: AuthUser, @Body() dto: UploadTicketDto) {
    return this.media.createUploadTicket(user.id, dto);
  }

  /**
   * Authenticated streaming-proxy upload. Authorized by the signed token in the
   * query (not JWT). The raw body is piped straight to storage — this route is
   * excluded from body parsing in main.ts.
   */
  @Public()
  @Put('upload')
  upload(@Query('token') token: string, @Req() req: Request) {
    return this.media.handleUpload(
      token,
      req,
      req.headers['content-type'],
    );
  }

  /** Link the uploaded object to the photo and enqueue processing. */
  @Post('commit')
  commit(@CurrentUser() user: AuthUser, @Body() dto: CommitUploadDto) {
    return this.media.commit(user.id, dto);
  }

  /** Signed CDN URLs for a photo's processed variants. */
  @Get(':id/urls')
  urls(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MediaScopeQueryDto,
  ) {
    return this.media.urls(user.id, id, query.organizationId);
  }

  @Post(':id/reprocess')
  reprocess(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaScopeQueryDto,
  ) {
    return this.media.reprocess(user.id, id, dto.organizationId);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthUser, @Query() query: MediaScopeQueryDto) {
    return this.media.usage(user.id, query.organizationId);
  }

  /** Dev-only file serving for the local storage driver. */
  @Public()
  @Get('file/*key')
  async file(
    @Param('key') key: string | string[],
    @Res() res: Response,
  ) {
    const path = Array.isArray(key) ? key.join('/') : key;
    const data = await this.media.download(path);
    res.send(data);
  }
}
