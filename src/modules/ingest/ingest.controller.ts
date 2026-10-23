import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { IngestService } from './ingest.service';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('ingest')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('ingest')
export class IngestController {
  constructor(
    private readonly ingest: IngestService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('status')
  status() {
    return this.ingest.status();
  }

  @Post('run')
  run(@Query('source') source?: string) {
    return this.ingest.start(source);
  }

  @Post('flush-mail')
  flushMail() {
    return this.notifications.processPending();
  }
}
