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
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
