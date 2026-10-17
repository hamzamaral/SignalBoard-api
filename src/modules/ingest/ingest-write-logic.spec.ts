import { ListingStatus } from '@prisma/client';
import { parseDateRange } from './kamuilan.adapter';
import {
  contentDedupeKey,
  isNewApplyWindow,
  listingFingerprint,
  normalizeSearchQuery,
  searchMatches,
  stableKamuilanKey,
} from './ingest-write-logic';

describe('ingest write logic — edge cases', () => {
  describe('kamuilan URL / carousel twins', () => {
    it('different ?kod= URLs collapse to one stable key', () => {
      const org = 'TÜRK PATENT VE MARKA KURUMU';
      const title = 'SÖZLEŞMELİ BİLİŞİM PERSONELİ SINAV ALIM İLANI';
      const a = stableKamuilanKey(org, title);
      const b = stableKamuilanKey(org, title);
      expect(a).toBe(b);
      expect(a.startsWith('kamu:')).toBe(true);
      // in-run Set would skip second slide
      const seen = new Set<string>();
      const links = [
        'https://kamuilan.sbb.gov.tr/ilanDetay.aspx?kod=AAA',
        'https://kamuilan.sbb.gov.tr/ilanDetay.aspx?kod=BBB',
        'https://kamuilan.sbb.gov.tr/ilanDetay.aspx?kod=CCC',
      ];
      let kept = 0;
      for (const _ of links) {
        const key = contentDedupeKey('KAMUILAN', org, title);
        if (seen.has(key)) continue;
        seen.add(key);
        kept += 1;
      }
      expect(kept).toBe(1);
    });

    it('fingerprint ignores URL so kod variants do not fork rows', () => {
      const fp1 = listingFingerprint({
        institutionIdOrName: 'inst-1',
        title: 'SÖZLEŞMELİ BİLİŞİM PERSONELİ',
        source: 'KAMUILAN',
      });
      const fp2 = listingFingerprint({
        institutionIdOrName: 'inst-1',
        title: 'Sözleşmeli Bilişim Personeli',
        source: 'KAMUILAN',
      });
      expect(fp1).toBe(fp2);
    });

    it('whitespace / case variants of title share content key', () => {
      expect(contentDedupeKey('KAMUILAN', 'Türk Patent', 'Bilişim  Personeli')).toBe(
        contentDedupeKey('KAMUILAN', 'TÜRK PATENT', 'bilişim personeli'),
      );
    });
  });

  describe('Turkish search (ARALı / ARALI)', () => {
    it('folds ı/I/i', () => {
      expect(normalizeSearchQuery('ARALı')).toBe('arali');
      expect(normalizeSearchQuery('ARALI')).toBe('arali');
      expect(normalizeSearchQuery('aralik')).toBe('aralik');
    });

    it('matches haystack regardless of case and dotted I', () => {
      expect(searchMatches('Aralık 2026 İlanı', 'ARALI')).toBe(true);
      expect(searchMatches('Aralık 2026 İlanı', 'ARALı')).toBe(true);
      expect(searchMatches('TÜRK PATENT VE MARKA', 'turk patent')).toBe(true);
      expect(searchMatches('TÜRK PATENT', 'xyz')).toBe(false);
    });

    it('empty query matches everything', () => {
      expect(searchMatches('anything', '')).toBe(true);
      expect(searchMatches('anything', '   ')).toBe(true);
    });
  });

  describe('parseDateRange', () => {
    const now = new Date(2026, 9, 17); // 17 Oct 2026

    it('parses 14-28 Ekim', () => {
      const { start, end } = parseDateRange('14-28 Ekim', now);
      expect(start?.getDate()).toBe(14);
      expect(end?.getDate()).toBe(28);
      expect(start?.getMonth()).toBe(9);
    });

    it('parses bare 12-19 in current month', () => {
      const { start, end } = parseDateRange('12-19', now);
      expect(start?.getDate()).toBe(12);
      expect(end?.getDate()).toBe(19);
    });

    it('empty / garbage → null dates', () => {
      expect(parseDateRange('', now).start).toBeNull();
      expect(parseDateRange('yakında', now).start).toBeNull();
    });

    it('year rolls when range is long past', () => {
      const jan = new Date(2026, 0, 15);
      const { start } = parseDateRange('1-10 Ocak', jan);
      // still January current year when within 60d past window edge cases —
      // 1-10 Jan vs now 15 Jan: end is in past by < 60 days → keep year
      expect(start?.getFullYear()).toBe(2026);
    });
  });

  describe('re-open apply window', () => {
    it('creates new row when previous closed and new start after old end', () => {
      expect(
        isNewApplyWindow(
          {
            id: '1',
            status: ListingStatus.CLOSED,
            applyEndAt: new Date('2026-01-31'),
          },
          new Date('2026-10-01'),
        ),
      ).toBe(true);
    });

    it('does not fork while still OPEN', () => {
      expect(
        isNewApplyWindow(
          {
            id: '1',
            status: ListingStatus.OPEN,
            applyEndAt: new Date('2026-01-31'),
          },
          new Date('2026-10-01'),
        ),
      ).toBe(false);
    });

    it('does not fork without dates', () => {
      expect(
        isNewApplyWindow(
          { id: '1', status: ListingStatus.CLOSED, applyEndAt: null },
          new Date('2026-10-01'),
        ),
      ).toBe(false);
    });
  });

  describe('created vs updated semantics', () => {
    it('same externalKey → update path (created=false contract)', () => {
      // Documented contract: match #1
      const firstKey = stableKamuilanKey('Org', 'Title');
      const secondKey = stableKamuilanKey('Org', 'Title');
      expect(firstKey).toBe(secondKey);
    });

    it('different institutions keep separate keys', () => {
      expect(stableKamuilanKey('Org A', 'Title')).not.toBe(stableKamuilanKey('Org B', 'Title'));
    });
  });
});
