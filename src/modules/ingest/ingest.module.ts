import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IlanGovAdapter } from './ilan-gov.adapter';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { KamuilanAdapter } from './kamuilan.adapter';
import { YerelYonetimlerAdapter } from './yerel-yonetimler.adapter';

@Module({
  imports: [ListingsModule, NotificationsModule],
  controllers: [IngestController],
  providers: [IngestService, IlanGovAdapter, KamuilanAdapter, YerelYonetimlerAdapter],
})
export class IngestModule {}
