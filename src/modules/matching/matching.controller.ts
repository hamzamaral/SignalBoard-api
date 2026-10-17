import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MatchingService } from './matching.service';

class RecQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query() query: RecQuery) {
    return this.matching.recommendationsForUser(userId, query.limit);
  }
}
