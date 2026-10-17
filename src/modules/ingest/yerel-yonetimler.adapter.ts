import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import type { IngestSourceResult } from './kamuilan.adapter';

@Injectable()
export class YerelYonetimlerAdapter {
  private readonly logger = new Logger(YerelYonetimlerAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchAnnouncements(max = 80): Promise<IngestSourceResult> {
    const url = 'https://yerelyonetimler.csb.gov.tr/duyurular';
    try {
      const { data: html } = await axios.get(url, {
        timeout: 30_000,
        headers: {
          'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
          Accept: 'text/html',
        },
      });
      const $ = cheerio.load(html);
      const items: Array<{ title: string; link: string }> = [];

      $('a').each((_, el) => {
        if (items.length >= max) return;
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        let link = $(el).attr('href') || '';
        if (!/personel|memur|sözleşmeli|alım|ilan|işçi|kadrol/i.test(title)) return;
        if (!link) return;
        if (!link.startsWith('http')) link = new URL(link, url).toString();
        items.push({ title, link });
      });

      const seen = new Set<string>();
      let upserted = 0;
      for (const item of items) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);
        const institutionName =
          item.title.split(/\s+(SÖZLEŞMELİ|MEMUR|PERSONEL)/i)[0]?.trim() ||
          'Yerel yönetim';
        await this.listings.upsertFromSource({
          source: ListingSource.YEREL_YONETIMLER,
          externalKey: item.link,
          title: item.title.slice(0, 240),
          institutionName: institutionName.slice(0, 160),
          url: item.link,
          rawText: item.title,
        });
        upserted += 1;
        await new Promise((r) => setTimeout(r, 80));
      }

      if (upserted === 0) {
        return {
          source: 'YEREL_YONETIMLER',
          upserted: 0,
          rawCount: items.length,
          error:
            items.length === 0
              ? 'Personel duyurusu linki bulunamadı'
              : undefined,
          hint: 'Site yapısı değişmiş olabilir; yapıştır ile ekleyin.',
        };
      }
      return { source: 'YEREL_YONETIMLER', upserted, rawCount: items.length };
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
