import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import { scrapeHttpsAgent } from './http-agent';
import type { IngestSourceResult } from './kamuilan.adapter';

/** Parent category “Kamu-Akademik Personel”: kamu personel + akademik alımlar. */
export const ILAN_GOV_PERSONNEL_TAX = 8;
export const ILAN_GOV_PAGE_SIZE = 20;
export const ILAN_GOV_MAX = 500;

const ILAN_GOV_ORIGIN = 'https://www.ilan.gov.tr';
const ILAN_GOV_FILTER = 'https://www.ilan.gov.tr/api/api/services/app/Ad/AdsByFilter';

export type IlanGovCard = {
  id: string;
  title: string;
  advertiser: string;
  city?: string;
  link?: string;
  publishedAt: Date | null;
  rawText: string;
};

/** ilan.gov.tr site backend (dokümante resmi open API değil). Sayfa boyu 20; skipCount ile gezilir. */
@Injectable()
export class IlanGovAdapter {
  private readonly logger = new Logger(IlanGovAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchPersonnelAds(max = ILAN_GOV_MAX): Promise<IngestSourceResult> {
    try {
      const items = await this.fetchAllPersonnel(max);
      let created = 0;
      let updated = 0;
      for (const item of items) {
        const { created: isNew } = await this.listings.upsertFromSourceMeta({
          source: ListingSource.ILAN_GOV,
          externalKey: item.id || undefined,
          title: item.title,
          institutionName: item.advertiser,
          url: item.link,
          city: item.city,
          rawText: item.rawText,
          publishedAt: item.publishedAt,
        });
        if (isNew) created += 1;
        else updated += 1;
        await new Promise((r) => setTimeout(r, 40));
      }

      const upserted = created + updated;
      if (upserted === 0) {
        return {
          source: 'ILAN_GOV',
          upserted: 0,
          rawCount: items.length,
          error: 'API yanıt verdi ama kaydedilecek ilan yok',
          hint: 'Kategori filtresi boş gelebilir; yapıştır ile ekleyin.',
        };
      }
      return {
        source: 'ILAN_GOV',
        upserted,
        created,
        updated,
        uniqueCount: items.length,
        rawCount: items.length,
        hint: `${created} yeni · ${updated} güncellendi (kamu personel listesinin tamamı)`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ilan.gov scrape failed: ${message}`);
      return {
        source: 'ILAN_GOV',
        upserted: 0,
        rawCount: 0,
        error: message,
        hint: 'ilan.gov API erişilemedi. Daha sonra tekrar deneyin veya yapıştırın.',
      };
    }
  }

  private async fetchAllPersonnel(max: number): Promise<IlanGovCard[]> {
    const collected: IlanGovCard[] = [];
    const seen = new Set<string>();
    let skip = 0;
    let numFound = Number.POSITIVE_INFINITY;

    while (collected.length < max && skip < numFound) {
      const { data } = await axios.post(
        ILAN_GOV_FILTER,
        {
          keys: { txv: [ILAN_GOV_PERSONNEL_TAX] },
          sorting: 'publish_time desc',
          skipCount: skip,
          maxResultCount: ILAN_GOV_PAGE_SIZE,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/plain',
            'X-Request-Origin': 'IGT-UI',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
          },
          timeout: 30_000,
          httpsAgent: scrapeHttpsAgent,
        },
      );
      const result = data?.result ?? {};
      const ads: Array<Record<string, unknown>> = result.ads ?? result.items ?? [];
      if (typeof result.numFound === 'number') numFound = result.numFound;
      if (!ads.length) break;

      let added = 0;
      for (const ad of ads) {
        const card = mapIlanGovAd(ad);
        if (!card.id || seen.has(card.id)) continue;
        seen.add(card.id);
        collected.push(card);
        added += 1;
        if (collected.length >= max) break;
      }
      if (added === 0) break;
      skip += ads.length;
    }
    return collected;
  }
}

export function mapIlanGovAd(item: Record<string, unknown>): IlanGovCard {
  const id = String(item.id ?? item.adId ?? '');
  const title = String(item.title ?? item.adTitle ?? 'ilan.gov ilanı').slice(0, 240);
  const advertiser = String(item.advertiserName ?? item.companyName ?? 'Bilinmeyen kurum').slice(0, 160);
  const urlStr = item.urlStr ? String(item.urlStr) : item.url ? String(item.url) : '';
  const link = urlStr
    ? urlStr.startsWith('http')
      ? urlStr
      : `${ILAN_GOV_ORIGIN}${urlStr.startsWith('/') ? '' : '/'}${urlStr}`
    : id
      ? `${ILAN_GOV_ORIGIN}/ilan/${id}`
      : undefined;
  const publishedRaw = item.publishStartDate ?? item.publishTime;
  const publishedAt = publishedRaw ? new Date(String(publishedRaw)) : null;
  return {
    id,
    title,
    advertiser,
    city: item.addressCityName ? String(item.addressCityName) : item.cityName ? String(item.cityName) : undefined,
    link,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    rawText: JSON.stringify(item).slice(0, 5000),
  };
}
