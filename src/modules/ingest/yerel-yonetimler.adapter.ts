import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import { scrapeHttpsAgent } from './http-agent';
import type { IngestSourceResult } from './kamuilan.adapter';

@Injectable()
export class YerelYonetimlerAdapter {
  private readonly logger = new Logger(YerelYonetimlerAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchAnnouncements(max = 120): Promise<IngestSourceResult> {
    const base = 'https://yerelyonetimler.csb.gov.tr/duyurular';
    try {
      const items: Array<{ title: string; link: string }> = [];
      // Ana liste + basit sayfa parametreleri (site destekliyorsa)
      const pageUrls = [base, `${base}?page=1`, `${base}?page=2`, `${base}?sayfa=2`];

      for (const pageUrl of pageUrls) {
        if (items.length >= max) break;
        let html: string;
        try {
          const res = await axios.get(pageUrl, {
            timeout: 30_000,
            headers: {
              'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
              Accept: 'text/html',
            },
            httpsAgent: scrapeHttpsAgent,
          });
          html = res.data;
        } catch {
          continue;
        }
        const $ = cheerio.load(html);
        $('a').each((_, el) => {
          if (items.length >= max) return;
          const title = $(el).text().replace(/\s+/g, ' ').trim();
          let link = $(el).attr('href') || '';
          if (!/personel|memur|sözleşmeli|alım|ilan|işçi|kadrol/i.test(title)) return;
          if (!link) return;
          if (!link.startsWith('http')) link = new URL(link, base).toString();
          items.push({ title, link: normalizeUrl(link) });
        });
      }

      const seen = new Set<string>();
      let created = 0;
      let updated = 0;
      let duplicatesSkipped = 0;

      for (const item of items) {
        if (seen.has(item.link)) {
          duplicatesSkipped += 1;
          continue;
        }
        seen.add(item.link);
        const institutionName =
          item.title.split(/\s+(SÖZLEŞMELİ|MEMUR|PERSONEL)/i)[0]?.trim() ||
          'Yerel yönetim';
        const { created: isNew } = await this.listings.upsertFromSourceMeta({
          source: ListingSource.YEREL_YONETIMLER,
          externalKey: item.link,
          title: item.title.slice(0, 240),
          institutionName: institutionName.slice(0, 160),
          url: item.link,
          rawText: item.title,
        });
        if (isNew) created += 1;
        else updated += 1;
        await new Promise((r) => setTimeout(r, 60));
      }

      const upserted = created + updated;
      if (upserted === 0) {
        return {
          source: 'YEREL_YONETIMLER',
          upserted: 0,
          created: 0,
          updated: 0,
          duplicatesSkipped,
          uniqueCount: seen.size,
          rawCount: items.length,
          error:
            items.length === 0
              ? 'Personel duyurusu linki bulunamadı'
              : undefined,
          hint: 'Site yapısı değişmiş olabilir; yapıştır ile ekleyin.',
        };
      }

      return {
        source: 'YEREL_YONETIMLER',
        upserted,
        created,
        updated,
        duplicatesSkipped,
        uniqueCount: seen.size,
        rawCount: items.length,
        hint:
          updated > 0 || duplicatesSkipped > 0
            ? `${created} yeni · ${updated} güncellendi · ${duplicatesSkipped} tekrar link atlandı (çift kayıt yok)`
            : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`yerelyonetimler scrape failed: ${message}`);
      return {
        source: 'YEREL_YONETIMLER',
        upserted: 0,
        rawCount: 0,
        error: message,
        hint: 'Ağ / site erişimi başarısız.',
      };
    }
  }
}

function normalizeUrl(link: string) {
  try {
    const u = new URL(link);
    u.hash = '';
    // trailing slash normalize
    if (u.pathname.endsWith('/') && u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return link;
  }
}
