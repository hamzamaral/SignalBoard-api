import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PipelineStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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
}

class StatusDto {
  @IsEnum(PipelineStatus)
  status!: PipelineStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
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
    return this.pipeline.track(userId, dto.listingId, dto.status, dto.positionId);
  }

  @Patch(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.pipeline.updateStatus(userId, id, dto.status, dto.notes, dto.positionId);
  }
}
