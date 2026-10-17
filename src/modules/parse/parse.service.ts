import { Injectable } from '@nestjs/common';
import { ListingKind, ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import { LlmService, ParsedListingFields } from './llm.service';

@Injectable()
export class ParseService {
  constructor(
    private readonly llm: LlmService,
    private readonly listings: ListingsService,
  ) {}

  async parseAndMaybeSave(opts: {
    text: string;
    kind?: ListingKind;
    source?: ListingSource;
    save?: boolean;
  }) {
    const ruleBased = ruleParse(opts.text);
    const llmBased = await this.llm.parseListingText(opts.text);
    const merged = mergeParsed(ruleBased, llmBased);

    if (!opts.save) {
      return { parsed: merged, listing: null, engine: llmBased ? 'rules+llm' : 'rules' };
    }

    const listing = await this.listings.upsertFromSource({
      source: opts.source ?? ListingSource.MANUAL,
      kind: opts.kind ?? ListingKind.PUBLIC,
      title: merged.title || 'Başlıksız ilan',
      institutionName: merged.institutionName,
      position: merged.position,
      description: opts.text.slice(0, 4000),
      rawText: opts.text,
      url: merged.url,
      city: merged.city,
      educationLevel: merged.educationLevel,
      kpssScoreType: merged.kpssScoreType,
      kpssMinScore: merged.kpssMinScore,
      quota: merged.quota,
      applyStartAt: parseDate(merged.applyStartAt),
      applyEndAt: parseDate(merged.applyEndAt),
      resultAt: parseDate(merged.resultAt),
      requiredSkills: merged.requiredSkills,
    });

    return { parsed: merged, listing, engine: llmBased ? 'rules+llm' : 'rules' };
  }
}

function ruleParse(text: string): ParsedListingFields {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const joined = text.replace(/\s+/g, ' ');
  const institutionName =
    matchGroup(joined, /([A-ZÇĞİÖŞÜa-zçğıöşü0-9 .\-]+(?:ÜNİVERSİTESİ|BAŞKANLIĞI|ENSTİTÜSÜ|MÜDÜRLÜĞÜ|BAKANLIĞI|BELEDİYESİ))/i) ||
    lines[0];

  const title =
    matchGroup(joined, /((?:SÖZLEŞMELİ|MEMUR|ÖĞRETİM|BİLİŞİM|UZMAN)[^.!\n]{5,80})/i) ||
    lines.find((l) => /ALACAK|İLANI|PERSONEL/i.test(l)) ||
    lines[1];

  const kpssScoreType = matchGroup(joined, /\b(P\d{1,3}|KPSSP\d{1,3})\b/i) || undefined;
  const kpssMinScoreRaw = matchGroup(joined, /(?:taban|en az|minimum)\s*(?:puan)?\s*[:=]?\s*(\d{2,3}(?:[.,]\d{1,3})?)/i);
  const quotaRaw = matchGroup(joined, /(\d+)\s*(?:kişi|adet|kadrosu|pozisyon)/i);
  const city = matchGroup(joined, /\b(İstanbul|Ankara|İzmir|Bursa|Antalya|Konya|Adana|Gaziantep|Kayseri|Mersin|Düzce|Sakarya|Kocaeli)\b/i);

  const dateRange = [...text.matchAll(/(\d{1,2})[./.](\d{1,2})[./.](\d{2,4})/g)].map((m) => {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, mo - 1, d)).toISOString();
  });

  const educationLevel = /lisans/i.test(joined)
    ? 'Lisans'
    : /ön\s*lisans/i.test(joined)
      ? 'Önlisans'
      : /yüksek\s*lisans/i.test(joined)
        ? 'Yüksek Lisans'
        : undefined;

  const skills: string[] = [];
  for (const s of ['Java', 'Node', 'React', 'SQL', 'Python', 'Network', 'Cisco', 'AWS', 'Docker']) {
    if (new RegExp(s, 'i').test(joined)) skills.push(s);
  }

  return {
    institutionName,
    title,
    position: title,
    city: city || undefined,
    educationLevel,
    kpssScoreType: kpssScoreType?.toUpperCase(),
    kpssMinScore: kpssMinScoreRaw ? Number(kpssMinScoreRaw.replace(',', '.')) : undefined,
    quota: quotaRaw ? Number(quotaRaw) : undefined,
    applyStartAt: dateRange[0],
    applyEndAt: dateRange[1] || dateRange[0],
    requiredSkills: skills,
  };
}

function mergeParsed(
  rules: ParsedListingFields,
  llm: ParsedListingFields | null,
): ParsedListingFields {
  if (!llm) return rules;
  return {
    institutionName: llm.institutionName || rules.institutionName,
    title: llm.title || rules.title,
    position: llm.position || rules.position,
    city: llm.city || rules.city,
    educationLevel: llm.educationLevel || rules.educationLevel,
    kpssScoreType: llm.kpssScoreType || rules.kpssScoreType,
    kpssMinScore: llm.kpssMinScore ?? rules.kpssMinScore,
    quota: llm.quota ?? rules.quota,
    applyStartAt: llm.applyStartAt || rules.applyStartAt,
    applyEndAt: llm.applyEndAt || rules.applyEndAt,
    resultAt: llm.resultAt || rules.resultAt,
    url: llm.url || rules.url,
    requiredSkills:
      llm.requiredSkills?.length ? llm.requiredSkills : rules.requiredSkills,
  };
}

function matchGroup(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
