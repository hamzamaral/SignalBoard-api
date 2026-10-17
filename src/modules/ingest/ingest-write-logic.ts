import { ListingStatus } from '@prisma/client';
import { buildFingerprint, normalizeText } from '../../common/utils/normalize';

/**
 * Scrape → DB write contract (edge-case reference).
 *
 * Match order in ListingsService.upsertFromSourceMeta:
 * 1) source + externalKey  → UPDATE
 * 2) source + titleNorm + institutionId (OPEN) → UPDATE (content twin)
 * 3) fingerprint(institution|title|position|source) → UPDATE (or NEW if re-open window)
 * 4) else CREATE (possibleDup if same title at institution from another source)
 *
 * Fingerprint intentionally EXCLUDES volatile URLs (?kod=).
 */

export function stableKamuilanKey(org: string, title: string): string {
  return `kamu:${normalizeText(org)}|${normalizeText(title)}`;
}

/** Same carousel ad, different ?kod= → same dedupe key for in-run Set. */
export function contentDedupeKey(source: string, org: string, title: string): string {
  return `${source}|${normalizeText(org)}|${normalizeText(title)}`;
}

export function listingFingerprint(parts: {
  institutionIdOrName?: string | null;
  title: string;
  position?: string | null;
  source: string;
  applyStartIso?: string;
}): string {
  return buildFingerprint([
    parts.institutionIdOrName,
    parts.title,
    parts.position,
    parts.source,
    parts.applyStartIso,
  ]);
}

export type ExistingListingLite = {
  id: string;
  status: ListingStatus;
  applyEndAt: Date | null;
};

/** True when closed listing should spawn a new OPEN row for a later apply window. */
export function isNewApplyWindow(
  existing: ExistingListingLite,
  applyStartAt: Date | null | undefined,
): boolean {
  return Boolean(
    existing.applyEndAt &&
      applyStartAt &&
      existing.applyEndAt < applyStartAt &&
      existing.status !== ListingStatus.OPEN,
  );
}

export function normalizeSearchQuery(q: string): string {
  return normalizeText(q);
}

/** Search haystack match: query folded, target folded. */
export function searchMatches(haystack: string, query: string): boolean {
  const h = normalizeText(haystack);
  const q = normalizeText(query);
  if (!q) return true;
  return h.includes(q);
}
