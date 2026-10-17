import { Body, Controller, Get, Header, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RemindersService } from './reminders.service';

class CreateReminderDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsDateString()
  remindAt!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}

@ApiTags('reminders')
@ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.reminders.list(userId);
  }

  @Get('export.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async exportIcs(@CurrentUser('id') userId: string, @Res() res: Response) {
    const ics = await this.reminders.exportIcs(userId);
    res.setHeader('Content-Disposition', 'attachment; filename="signalboard-reminders.ics"');
    res.send(ics);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReminderDto) {
    return this.reminders.create(userId, {
      title: dto.title,
      remindAt: new Date(dto.remindAt),
      note: dto.note,
      listingId: dto.listingId,
    });
  }

  @Patch(':id/complete')
  complete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.reminders.complete(userId, id);
  }
}
