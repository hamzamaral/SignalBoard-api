import { Injectable } from '@nestjs/common';
import { IlanGovAdapter } from './ilan-gov.adapter';

@Injectable()
export class IngestService {
  constructor(private readonly ilanGov: IlanGovAdapter) {}

  async run(source?: string) {
    const results: Record<string, unknown> = {};
    if (!source || source === 'ILAN_GOV') {
      results.ILAN_GOV = await this.ilanGov.fetchPersonnelAds();
    }
    // Diğer kaynaklar: manuel / paste / CSV (stub)
    if (source === 'KAMUILAN' || source === 'YEREL_YONETIMLER') {
      results[source] = {
        status: 'stub',
        message: 'HTML adapter henüz yok; paste-parse veya manuel kayıt kullanın',
      };
    }
    return results;
  }
}
