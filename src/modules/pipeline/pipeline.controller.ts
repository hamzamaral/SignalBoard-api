import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PipelineStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PipelineService } from './pipeline.service';

class TrackDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsEnum(PipelineStatus)
  status?: PipelineStatus;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsString()
  applyChannel?: string;

  @IsOptional()
  @IsBoolean()
  mailOk?: boolean;

  @IsOptional()
  @IsBoolean()
  formOk?: boolean;
}

class StatusDto {
  @IsOptional()
  @IsEnum(PipelineStatus)
  status?: PipelineStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsString()
  applyChannel?: string;

  @IsOptional()
  @IsBoolean()
  mailOk?: boolean;

  @IsOptional()
  @IsBoolean()
  formOk?: boolean;
}

@ApiTags('pipeline')
@ApiBearerAuth()
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('status') status?: PipelineStatus,
  ) {
    return this.pipeline.list(userId, status);
  }

  @Post()
  track(@CurrentUser('id') userId: string, @Body() dto: TrackDto) {
    return this.pipeline.track(userId, dto.listingId, {
      status: dto.status,
      positionId: dto.positionId,
      applyChannel: dto.applyChannel,
      mailOk: dto.mailOk,
      formOk: dto.formOk,
    });
  }

  @Patch(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.pipeline.updateStatus(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.pipeline.remove(userId, id);
  }
}
