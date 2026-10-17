import { buildFingerprint, normalizeText } from './normalize';

describe('normalizeText', () => {
  it('normalizes Turkish casing and spaces', () => {
    expect(normalizeText('  Türk Standartları  Enstitüsü ')).toContain('turk');
    expect(normalizeText('TSE')).toBe('tse');
  });

  it('treats ARALı and ARALI as the same (case + ı/i)', () => {
    expect(normalizeText('ARALı')).toBe(normalizeText('ARALI'));
    expect(normalizeText('ARALı')).toBe('arali');
    expect(normalizeText('aralik')).toBe('aralik');
  });
});

describe('buildFingerprint', () => {
  it('joins normalized parts', () => {
    const fp = buildFingerprint(['TSE', 'Bilişim Personeli', null, 'MANUAL']);
    expect(fp).toContain('tse');
    expect(fp).toContain('bilisim');
  });
});
