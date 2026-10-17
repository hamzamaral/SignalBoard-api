import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import type { IngestSourceResult } from './kamuilan.adapter';

/** ilan.gov.tr site backend (dokümante resmi open API değil). */
@Injectable()
export class IlanGovAdapter {
  private readonly logger = new Logger(IlanGovAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchPersonnelAds(max = 80): Promise<IngestSourceResult> {
    const url = 'https://www.ilan.gov.tr/api/api/services/app/Ad/AdsByFilter';
    const categoryAttempts = [[44], [5], [693], [672], []];

    let lastError: string | undefined;
    for (const txv of categoryAttempts) {
      try {
        const body: Record<string, unknown> = {
          keys: {
            currentPage: [1],
            ...(txv.length ? { txv } : {}),
          },
          sorting: 'publish_time desc',
          skipCount: 0,
          maxResultCount: max,
        };
        const { data } = await axios.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/plain',
            'X-Request-Origin': 'IGT-UI',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
          },
          timeout: 30_000,
        });

        const items: Array<Record<string, unknown>> =
          data?.result?.items ?? data?.result?.ads ?? data?.items ?? [];
        if (!items.length && txv.length) continue;

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
            city: item.cityName ? String(item.cityName) : undefined,
            rawText: JSON.stringify(item).slice(0, 5000),
            publishedAt: item.publishTime ? new Date(String(item.publishTime)) : null,
          });
          upserted += 1;
          await new Promise((r) => setTimeout(r, 60));
        }

        if (upserted === 0) {
          return {
            source: 'ILAN_GOV',
            upserted: 0,
            rawCount: items.length,
            error: 'API yanıt verdi ama kaydedilecek ilan yok',
            hint: 'Kategori filtresi boş gelebilir; yapıştır ile ekleyin.',
          };
        }
        return { source: 'ILAN_GOV', upserted, rawCount: items.length };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`ilan.gov attempt failed (${txv}): ${lastError}`);
      }
    }
    return {
      source: 'ILAN_GOV',
      upserted: 0,
      rawCount: 0,
      error: lastError ?? 'Bilinmeyen hata',
      hint: 'ilan.gov API erişilemedi. Daha sonra tekrar deneyin veya yapıştırın.',
    };
  }
}
