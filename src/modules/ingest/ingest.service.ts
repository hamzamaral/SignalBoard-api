import { Injectable } from '@nestjs/common';
import { IlanGovAdapter } from './ilan-gov.adapter';
import { KamuilanAdapter, type IngestSourceResult } from './kamuilan.adapter';
import { YerelYonetimlerAdapter } from './yerel-yonetimler.adapter';

@Injectable()
export class IngestService {
  constructor(
    private readonly ilanGov: IlanGovAdapter,
    private readonly kamuilan: KamuilanAdapter,
    private readonly yerel: YerelYonetimlerAdapter,
  ) {}

  async run(source?: string) {
    const sources: IngestSourceResult[] = [];
    const all = !source;

    if (all || source === 'ILAN_GOV') {
      sources.push(await this.ilanGov.fetchPersonnelAds());
    }
    if (all || source === 'KAMUILAN') {
      sources.push(await this.kamuilan.fetchActiveAds());
    }
    if (all || source === 'YEREL_YONETIMLER') {
      sources.push(await this.yerel.fetchAnnouncements());
    }
    if (
      source &&
      sources.length === 0 &&
      !['ILAN_GOV', 'KAMUILAN', 'YEREL_YONETIMLER'].includes(source)
    ) {
      sources.push({
        source,
        upserted: 0,
        rawCount: 0,
        error: 'Bu kaynak için otomatik adapter yok',
        hint: 'Paste-parse veya manuel kayıt kullanın',
      });
    }

    const totalUpserted = sources.reduce((n, s) => n + s.upserted, 0);
    const totalRaw = sources.reduce((n, s) => n + s.rawCount, 0);
    const failed = sources.filter((s) => s.upserted === 0 && (s.error || s.rawCount === 0));

    return {
      sources,
      totalUpserted,
      totalRaw,
      ok: totalUpserted > 0,
      summary:
        totalUpserted > 0
          ? `${totalUpserted} kayıt (ham ${totalRaw})`
          : failed.length
            ? `Çekilemedi: ${failed.map((f) => f.source).join(', ')}`
            : 'Kayıt yok',
    };
  }
}
