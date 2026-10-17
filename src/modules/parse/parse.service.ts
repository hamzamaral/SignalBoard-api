import { Injectable } from '@nestjs/common';
import { ListingKind, ListingSource } from '@prisma/client';
import { ListingsService } from '../listings/listings.service';
import { LlmService } from './llm.service';
import { mergeParsed, ruleParse } from './rule-parse';

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
      examAt: parseDate(merged.examAt),
      resultAnnounceAt: parseDate(merged.resultAnnounceAt),
      applicationPlace: merged.applicationPlace,
      applicationMethods: merged.applicationMethods,
      requiredDocuments: merged.requiredDocuments,
      generalRequirements: merged.generalRequirements,
      specialRequirements: merged.specialRequirements,
      examTopics: merged.examTopics,
      evaluationNotes: merged.evaluationNotes,
      requiredSkills: merged.requiredSkills,
      positions: merged.positions,
    });

    return { parsed: merged, listing, engine: llmBased ? 'rules+llm' : 'rules' };
  }

  /** Mevcut ilanı metin / AI ile zenginleştir (eksik alanları doldur). */
  async enrichListing(listingId: string, text?: string) {
    const existing = await this.listings.get(listingId);
    const sourceText =
      (text && text.trim()) ||
      existing.rawText ||
      existing.description ||
      [existing.title, existing.institution?.name, existing.position, existing.url]
        .filter(Boolean)
        .join('\n');

    const ruleBased = ruleParse(sourceText);
    const llmBased = await this.llm.parseListingText(sourceText);
    const merged = mergeParsed(ruleBased, llmBased);

    const listing = await this.listings.update(listingId, {
      source: existing.source,
      title: merged.title || existing.title,
      institutionName: merged.institutionName,
      position: merged.position ?? existing.position ?? undefined,
      description: text?.trim() ? text.slice(0, 4000) : existing.description ?? undefined,
      rawText: text?.trim() || existing.rawText || sourceText,
      url: merged.url ?? existing.url ?? undefined,
      city: merged.city ?? existing.city ?? undefined,
      educationLevel: merged.educationLevel ?? existing.educationLevel ?? undefined,
      kpssScoreType: merged.kpssScoreType ?? existing.kpssScoreType ?? undefined,
      kpssMinScore: merged.kpssMinScore ?? undefined,
      quota: merged.quota ?? existing.quota ?? undefined,
      applyStartAt: parseDate(merged.applyStartAt) ?? existing.applyStartAt,
      applyEndAt: parseDate(merged.applyEndAt) ?? existing.applyEndAt,
      resultAt: parseDate(merged.resultAt) ?? existing.resultAt,
      examAt: parseDate(merged.examAt) ?? existing.examAt,
      resultAnnounceAt: parseDate(merged.resultAnnounceAt) ?? existing.resultAnnounceAt,
      applicationPlace: merged.applicationPlace ?? existing.applicationPlace ?? undefined,
      applicationMethods: merged.applicationMethods?.length
        ? merged.applicationMethods
        : existing.applicationMethods,
      requiredDocuments: merged.requiredDocuments?.length
        ? merged.requiredDocuments
        : existing.requiredDocuments,
      generalRequirements:
        merged.generalRequirements ?? existing.generalRequirements ?? undefined,
      specialRequirements:
        merged.specialRequirements ?? existing.specialRequirements ?? undefined,
      examTopics: merged.examTopics ?? existing.examTopics ?? undefined,
      evaluationNotes: merged.evaluationNotes ?? existing.evaluationNotes ?? undefined,
      requiredSkills: merged.requiredSkills?.length
        ? merged.requiredSkills
        : existing.requiredSkills,
      positions: merged.positions?.length ? merged.positions : undefined,
    });

    return {
      listing,
      parsed: merged,
      engine: llmBased ? 'rules+llm' : 'rules',
    };
  }
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
