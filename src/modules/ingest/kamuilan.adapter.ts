import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';

const MONTHS: Record<string, number> = {
  ocak: 0,
  subat: 1,
  şubat: 1,
  mart: 2,
  nisan: 3,
  mayis: 4,
  mayıs: 4,
  haziran: 5,
  temmuz: 6,
  agustos: 7,
  ağustos: 7,
  eylul: 8,
  eylül: 8,
  ekim: 9,
  kasim: 10,
  kasım: 10,
  aralik: 11,
  aralık: 11,
};

export type IngestSourceResult = {
  source: string;
  upserted: number;
  rawCount: number;
  error?: string;
  hint?: string;
};

@Injectable()
export class KamuilanAdapter {
  private readonly logger = new Logger(KamuilanAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchActiveAds(max = 100): Promise<IngestSourceResult> {
    const url = 'https://kamuilan.sbb.gov.tr/';
    try {
      const { data: html } = await axios.get(url, {
        timeout: 30_000,
        headers: {
          'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
          Accept: 'text/html',
        },
      });
      const $ = cheerio.load(html);
      const items: Array<{ title: string; org: string; dates: string; link: string }> = [];

      const selectors = ['ul.slides li', '.slides li', '.flexslider li', 'li'];
      for (const sel of selectors) {
        $(sel).each((_, el) => {
          if (items.length >= max) return;
          const org = $(el).find('h5 span.black, .black, h5 span').eq(0).text().trim()
            || $(el).find('h5').clone().children().remove().end().text().trim();
          const title =
            $(el).find('h5 span.patrol, .patrol').first().text().trim() ||
            $(el).find('h5').text().replace(org, '').replace(/\d{1,2}\s*[-–]\s*\d{1,2}.*/i, '').trim();
          const dates =
            $(el).find('h5 span.h5date, .h5date').first().text().trim() ||
            ($(el).text().match(/(\d{1,2}\s*[-–]\s*\d{1,2}\s*\w+)/i)?.[1] ?? '');
          let link = $(el).find('a').first().attr('href') || '';
          if (!org && !title) return;
          if (link && !link.startsWith('http')) {
            link = new URL(link, url).toString();
          }
          items.push({
            title: (title || org || 'Kamu ilanı').slice(0, 240),
            org: (org || 'Bilinmeyen kurum').slice(0, 160),
            dates,
            link: link || url,
          });
        });
        if (items.length > 0) break;
      }

      const seen = new Set<string>();
      let upserted = 0;
      for (const item of items) {
        const key = item.link || `${item.org}|${item.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { start, end, label } = parseDateRange(item.dates);
        await this.listings.upsertFromSource({
          source: ListingSource.KAMUILAN,
          externalKey: item.link || undefined,
          title: item.title,
          institutionName: item.org,
          url: item.link || url,
          applyStartAt: start,
          applyEndAt: end,
          publishedAt: start,
          rawText: `${item.org} — ${item.title} — ${label || item.dates}`,
        });
        upserted += 1;
        await sleep(80);
      }

      if (upserted === 0) {
        return {
          source: 'KAMUILAN',
          upserted: 0,
          rawCount: items.length,
          error: items.length === 0 ? 'Sayfada ilan satırı bulunamadı (HTML değişmiş olabilir)' : undefined,
          hint: items.length === 0
            ? 'Admin’de ilan metnini yapıştırın veya daha sonra tekrar deneyin.'
            : undefined,
        };
      }
      return { source: 'KAMUILAN', upserted, rawCount: items.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`kamuilan scrape failed: ${message}`);
      return {
        source: 'KAMUILAN',
        upserted: 0,
        rawCount: 0,
        error: message,
        hint: 'Ağ / site erişimi başarısız. Yapıştır ile ekleyebilirsiniz.',
      };
    }
  }
}

/** Parse "14-28 Ekim", "2-13", "12-19 Ekim 2026" style ranges. */
export function parseDateRange(
  text: string,
  now = new Date(),
): { start: Date | null; end: Date | null; label: string } {
  const raw = (text || '').trim();
  if (!raw) return { start: null, end: null, label: '' };

  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const withMonth = raw.match(
    /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?/i,
  );
  if (withMonth) {
    const dayStart = Number(withMonth[1]);
    const dayEnd = Number(withMonth[2]);
    const monthKey = withMonth[3]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const month = MONTHS[monthKey];
    if (month === undefined) return { start: null, end: null, label: raw };
    let year = withMonth[4] ? Number(withMonth[4]) : now.getFullYear();
    let start = new Date(year, month, dayStart, 0, 0, 0, 0);
    let end = new Date(year, month, dayEnd, 23, 59, 59, 999);
    if (end < start) {
      end = new Date(year, month + 1, dayEnd, 23, 59, 59, 999);
    }
    // If range already fully in the past by > 60 days, assume next year
    if (!withMonth[4] && end.getTime() < now.getTime() - 60 * 86400000) {
      year += 1;
      start = new Date(year, month, dayStart, 0, 0, 0, 0);
      end = new Date(year, month, dayEnd, 23, 59, 59, 999);
    }
    return { start, end, label: raw };
  }

  // Bare "2-13" or "12-19" — assume current month, or previous if days don't make sense
  const bare = norm.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
  if (bare) {
    const dayStart = Number(bare[1]);
    const dayEnd = Number(bare[2]);
    let year = now.getFullYear();
    let month = now.getMonth();
    let start = new Date(year, month, dayStart, 0, 0, 0, 0);
    let end = new Date(year, month, dayEnd, 23, 59, 59, 999);
    if (end < start) {
      end = new Date(year, month + 1, dayEnd, 23, 59, 59, 999);
    }
    if (end.getTime() < now.getTime() - 60 * 86400000) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      start = new Date(year, month, dayStart, 0, 0, 0, 0);
      end = new Date(year, month, dayEnd, 23, 59, 59, 999);
    }
    return { start, end, label: raw };
  }

  return { start: null, end: null, label: raw };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
