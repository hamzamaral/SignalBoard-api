import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { RemindersModule } from '../reminders/reminders.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [MatchingModule, RemindersModule],
  controllers: [PipelineController],
  providers: [PipelineService],
})
export class PipelineModule {}
