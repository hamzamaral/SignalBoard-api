import { Module, forwardRef } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { SettingsModule } from '../settings/settings.module';
import { LlmService } from './llm.service';
import { ParseService } from './parse.service';

@Module({
  imports: [SettingsModule, forwardRef(() => ListingsModule)],
  providers: [LlmService, ParseService],
  exports: [ParseService, LlmService],
})
export class ParseModule {}
