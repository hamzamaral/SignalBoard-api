import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';

@Injectable()
export class KamuilanAdapter {
  private readonly logger = new Logger(KamuilanAdapter.name);

  constructor(private readonly listings: ListingsService) {}

  async fetchActiveAds(max = 40) {
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

      $('ul.slides li, .slides li, li').each((_, el) => {
        if (items.length >= max) return;
        const org = $(el).find('h5 span.black, .black').first().text().trim();
        const title = $(el).find('h5 span.patrol, .patrol').first().text().trim();
        const dates = $(el).find('h5 span.h5date, .h5date').first().text().trim();
        let link = $(el).find('a').first().attr('href') || '';
        if (!org && !title) return;
        if (link && !link.startsWith('http')) {
          link = new URL(link, url).toString();
        }
        items.push({
          title: title || org || 'Kamu ilanı',
          org: org || 'Bilinmeyen kurum',
          dates,
          link,
        });
      });

      // Deduplicate by link/title
      const seen = new Set<string>();
      let upserted = 0;
      for (const item of items) {
        const key = item.link || `${item.org}|${item.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { start, end } = parseDateRange(item.dates);
        await this.listings.upsertFromSource({
          source: ListingSource.KAMUILAN,
          externalKey: item.link || undefined,
          title: item.title,
          institutionName: item.org,
          url: item.link || url,
          applyStartAt: start,
          applyEndAt: end,
          rawText: `${item.org} — ${item.title} — ${item.dates}`,
        });
        upserted += 1;
        await sleep(150);
      }
      return { upserted, rawCount: items.length };
    } catch (err) {
      this.logger.warn(`kamuilan scrape failed: ${err instanceof Error ? err.message : err}`);
      return { upserted: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

function parseDateRange(text: string): { start: Date | null; end: Date | null } {
  const m = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(\w+)/i);
  // Fallback: leave null; list pages often show "14-28 Ekim"
  if (!m) return { start: null, end: null };
  return { start: null, end: null };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
