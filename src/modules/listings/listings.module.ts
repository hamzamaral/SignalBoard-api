import { Module, forwardRef } from '@nestjs/common';
import { InstitutionsModule } from '../institutions/institutions.module';
import { MatchingModule } from '../matching/matching.module';
import { ParseModule } from '../parse/parse.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [InstitutionsModule, forwardRef(() => ParseModule), MatchingModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
