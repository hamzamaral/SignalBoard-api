import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';

/** ilan.gov.tr site backend (dokümante resmi open API değil). */
@Injectable()
export class IlanGovAdapter {
  private readonly logger = new Logger(IlanGovAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchPersonnelAds(max = 30) {
    const url = 'https://www.ilan.gov.tr/api/api/services/app/Ad/AdsByFilter';
    try {
      const { data } = await axios.post(
        url,
        {
          keys: {
            // Personel / kamu personel kategorileri site tarafında değişebilir; txv geniş tutulur
            currentPage: [1],
          },
          sorting: 'publish_time desc',
          skipCount: 0,
          maxResultCount: max,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/plain',
            'X-Request-Origin': 'IGT-UI',
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 30_000,
        },
      );

      const items: Array<Record<string, unknown>> =
        data?.result?.items ?? data?.result?.ads ?? data?.items ?? [];

      let upserted = 0;
      for (const item of items.slice(0, max)) {
        const id = String(item.id ?? item.adId ?? item.hashId ?? '');
        const title = String(item.title ?? item.adTitle ?? 'ilan.gov ilanı');
        const advertiser = String(
          item.advertiserName ?? item.companyName ?? item.ownerName ?? 'Bilinmeyen kurum',
        );
        const link = item.url
          ? String(item.url)
          : id
            ? `https://www.ilan.gov.tr/ilan/${id}`
            : undefined;

        await this.listings.upsertFromSource({
          source: ListingSource.ILAN_GOV,
          externalKey: id || undefined,
          title,
          institutionName: advertiser,
          url: link,
          rawText: JSON.stringify(item).slice(0, 5000),
          publishedAt: item.publishTime ? new Date(String(item.publishTime)) : null,
        });
        upserted += 1;
      }
      return { upserted, rawCount: items.length };
    } catch (err) {
      this.logger.warn(`ilan.gov ingest failed: ${err instanceof Error ? err.message : err}`);
      return { upserted: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
