import { Injectable } from '@nestjs/common';
import { IlanGovAdapter } from './ilan-gov.adapter';
import { KamuilanAdapter } from './kamuilan.adapter';
import { YerelYonetimlerAdapter } from './yerel-yonetimler.adapter';

@Injectable()
export class IngestService {
  constructor(
    private readonly ilanGov: IlanGovAdapter,
    private readonly kamuilan: KamuilanAdapter,
    private readonly yerel: YerelYonetimlerAdapter,
  ) {}

  async run(source?: string) {
    const results: Record<string, unknown> = {};
    const all = !source;

    if (all || source === 'ILAN_GOV') {
      results.ILAN_GOV = await this.ilanGov.fetchPersonnelAds();
    }
    if (all || source === 'KAMUILAN') {
      results.KAMUILAN = await this.kamuilan.fetchActiveAds();
    }
    if (all || source === 'YEREL_YONETIMLER') {
      results.YEREL_YONETIMLER = await this.yerel.fetchAnnouncements();
    }
    if (source && !results[source] && !['ILAN_GOV', 'KAMUILAN', 'YEREL_YONETIMLER'].includes(source)) {
      results[source] = {
        status: 'manual',
        message: 'Bu kaynak için otomatik adapter yok; paste-parse veya manuel kayıt kullanın',
      };
    }
    return results;
  }
}
