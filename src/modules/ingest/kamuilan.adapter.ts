import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import { scrapeHttpsAgent } from './http-agent';
import { stableKamuilanKey } from './ingest-write-logic';

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
  created?: number;
  updated?: number;
  duplicatesSkipped?: number;
  uniqueCount?: number;
  rawCount: number;
  error?: string;
  hint?: string;
};

@Injectable()
export class KamuilanAdapter {
  private readonly logger = new Logger(KamuilanAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchActiveAds(max = 200): Promise<IngestSourceResult> {
    const url = 'https://kamuilan.sbb.gov.tr/';
    try {
      const { data: html } = await axios.get(url, {
        timeout: 30_000,
        headers: {
          'User-Agent': 'SignalBoardBot/1.0 (+https://github.com/hamzamaral/SignalBoard-api)',
          Accept: 'text/html',
        },
        httpsAgent: scrapeHttpsAgent,
      });
      const items = parseKamuilanListings(html, max);

      const seen = new Set<string>();
      let created = 0;
      let updated = 0;
      let duplicatesSkipped = 0;
      for (const item of items) {
        // Same carousel ad often has many ?kod= URLs — dedupe by org+title
        const stableKey = stableKamuilanKey(item.org, item.title);
        if (seen.has(stableKey)) {
          duplicatesSkipped += 1;
          continue;
        }
        seen.add(stableKey);
        const { start, end, label } = parseDateRange(item.dates);
        const { created: isNew } = await this.listings.upsertFromSourceMeta({
          source: ListingSource.KAMUILAN,
          externalKey: stableKey,
          title: item.title,
          institutionName: item.org,
          url: item.link || url,
          applyStartAt: start,
          applyEndAt: end,
          publishedAt: start,
          rawText: `${item.org} — ${item.title} — ${label || item.dates}`,
        });
        if (isNew) created += 1;
        else updated += 1;
        await sleep(80);
      }

      const upserted = created + updated;
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
      return {
        source: 'KAMUILAN',
        upserted,
        created,
        updated,
        duplicatesSkipped,
        uniqueCount: seen.size,
        rawCount: items.length,
        hint: `${created} yeni · ${updated} güncellendi · ${duplicatesSkipped} tekrar atlandı`,
      };
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

export type KamuilanCard = {
  title: string;
  org: string;
  dates: string;
  link: string;
};

const KAMUILAN_ORIGIN = 'https://kamuilan.sbb.gov.tr/';

/**
 * Prefer the full “Tüm ilanlar” list (`#nav2`). The homepage manşet carousel
 * is only a subset and can omit listings published the same day.
 */
export function parseKamuilanListings(html: string, max = 200): KamuilanCard[] {
  const $ = cheerio.load(html);
  const fromList = parseNavList($, max);
  if (fromList.length) return fromList;
  return parseCarousel($, max);
}

function parseNavList($: cheerio.CheerioAPI, max: number): KamuilanCard[] {
  const items: KamuilanCard[] = [];
  $('#nav2 a.xx').each((_, el) => {
    if (items.length >= max) return;
    const card = $(el);
    const org = collapse(card.find('p.alt_p1').first().text());
    const dateText = collapse(card.find('p.alt_p2 em').first().text()).replace(/[()]/g, '').trim();
    let title = collapse(
      card.find('p.alt_p2').first().clone().children().remove().end().text(),
    );
    title = title.replace(/\(\s*\d{1,2}\s+\S+\s*[-–]\s*\d{1,2}\s+\S+.*?\)/g, '').trim();
    if (org && title.toLocaleLowerCase('tr-TR').startsWith(org.toLocaleLowerCase('tr-TR'))) {
      title = title.slice(org.length).trim();
    }
    if (!org && !title) return;
    items.push({
      title: (title || org || 'Kamu ilanı').slice(0, 240),
      org: (org || 'Bilinmeyen kurum').slice(0, 160),
      dates: dateText,
      link: absoluteLink(card.attr('href') || ''),
    });
  });
  return items;
}

function parseCarousel($: cheerio.CheerioAPI, max: number): KamuilanCard[] {
  const items: KamuilanCard[] = [];
  const selectors = ['ul.slides li', '.slides li', '.flexslider li'];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      if (items.length >= max) return;
      const org =
        collapse($(el).find('h5 span.black, .black, h5 span').eq(0).text()) ||
        collapse($(el).find('h5').clone().children().remove().end().text());
      const title =
        collapse($(el).find('h5 span.patrol, .patrol').first().text()) ||
        collapse($(el).find('h5').text())
          .replace(org, '')
          .replace(/\d{1,2}\s*[-–]\s*\d{1,2}.*/i, '')
          .trim();
      const dates =
        collapse($(el).find('h5 span.h5date, .h5date').first().text()) ||
        ($(el).text().match(/(\d{1,2}\s*[-–]\s*\d{1,2}\s*\w+)/i)?.[1] ?? '');
      if (!org && !title) return;
      items.push({
        title: (title || org || 'Kamu ilanı').slice(0, 240),
        org: (org || 'Bilinmeyen kurum').slice(0, 160),
        dates,
        link: absoluteLink($(el).find('a').first().attr('href') || ''),
      });
    });
    if (items.length > 0) break;
  }
  return items;
}

function absoluteLink(href: string) {
  if (!href) return KAMUILAN_ORIGIN;
  if (href.startsWith('http')) return href;
  return new URL(href, KAMUILAN_ORIGIN).toString();
}

function collapse(value: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function monthIndex(name: string): number | undefined {
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return MONTHS[key];
}

/** Parse "14-28 Ekim", "18 Ekim - 1 Kasım", "2-13", "12-19 Ekim 2026". */
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

  const acrossMonths = raw.match(
    /(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s*[-–]\s*(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?/i,
  );
  if (acrossMonths) {
    const dayStart = Number(acrossMonths[1]);
    const startMonth = monthIndex(acrossMonths[2]);
    const dayEnd = Number(acrossMonths[3]);
    const endMonth = monthIndex(acrossMonths[4]);
    if (startMonth === undefined || endMonth === undefined) {
      return { start: null, end: null, label: raw };
    }
    let year = acrossMonths[5] ? Number(acrossMonths[5]) : now.getFullYear();
    const start = new Date(year, startMonth, dayStart, 0, 0, 0, 0);
    let endYear = year;
    if (endMonth < startMonth || (endMonth === startMonth && dayEnd < dayStart)) endYear += 1;
    const end = new Date(endYear, endMonth, dayEnd, 23, 59, 59, 999);
    return { start, end, label: raw };
  }

  const withMonth = raw.match(
    /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?/i,
  );
  if (withMonth) {
    const dayStart = Number(withMonth[1]);
    const dayEnd = Number(withMonth[2]);
    const month = monthIndex(withMonth[3]);
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
