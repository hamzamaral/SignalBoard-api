import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import { scrapeHttpsAgent } from './http-agent';
import { monthIndex, type IngestSourceResult } from './kamuilan.adapter';

@Injectable()
export class YerelYonetimlerAdapter {
  private readonly logger = new Logger(YerelYonetimlerAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchAnnouncements(max = 500): Promise<IngestSourceResult> {
    const base = 'https://yerelyonetimler.csb.gov.tr/duyurular';
    try {
      const items: YerelCard[] = [];
      const seenLinks = new Set<string>();
      const seenPages = new Set<number>();
      const queue = [1];

      while (queue.length && seenPages.size < 40 && items.length < max) {
        const page = queue.shift();
        if (page == null || seenPages.has(page)) continue;
        seenPages.add(page);
        let html: string;
        try {
          const res = await axios.get(`${base}/${page}`, {
            timeout: 30_000,
            headers: {
              'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
              Accept: 'text/html',
            },
            httpsAgent: scrapeHttpsAgent,
          });
          html = res.data;
        } catch (err) {
          this.logger.warn(`yerelyonetimler page ${page} failed: ${err instanceof Error ? err.message : err}`);
          continue;
        }
        const cards = parseYerelAnnouncements(html);
        if (!cards.length) continue;
        for (const card of cards) {
          if (seenLinks.has(card.link) || items.length >= max) continue;
          seenLinks.add(card.link);
          items.push(card);
        }
        for (const next of yerelPageNumbers(html)) {
          if (!seenPages.has(next)) queue.push(next);
        }
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
          publishedAt: item.publishedAt,
        });
        if (isNew) created += 1;
        else updated += 1;
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
        hint: `${created} yeni · ${updated} güncellendi · ${seenPages.size} sayfa`,
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

export type YerelCard = {
  title: string;
  link: string;
  publishedAt: Date | null;
};

export function parseYerelAnnouncements(html: string): YerelCard[] {
  const $ = cheerio.load(html);
  const items: YerelCard[] = [];
  $('a.duyurular-wrapper, a.duyurular-category-card-wrapper').each((_, el) => {
    const card = $(el);
    const title = collapse(
      card.find('.info, .duyurular-category-card-body-wrapper p').first().text() || card.text(),
    );
    const href = card.attr('href') || '';
    if (!title || !href) return;
    const link = normalizeUrl(
      href.startsWith('http') ? href : new URL(href, 'https://yerelyonetimler.csb.gov.tr/').toString(),
    );
    const dateText = collapse(card.find('.date, .duyurular-category-card-body-wrapper span').first().text());
    items.push({ title: title.slice(0, 240), link, publishedAt: parseTurkishDate(dateText) });
  });
  return items;
}

export function yerelPageNumbers(html: string): number[] {
  const pages = new Set<number>();
  const $ = cheerio.load(html);
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/duyurular\/(\d+)/);
    if (match) pages.add(Number(match[1]));
  });
  return [...pages].filter((n) => n > 0).sort((a, b) => a - b);
}

export function parseTurkishDate(text: string): Date | null {
  const match = text.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!match) return null;
  const month = monthIndex(match[2]);
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1]), 12, 0, 0, 0);
}

function collapse(value: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
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
