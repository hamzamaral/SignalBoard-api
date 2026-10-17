import { buildFingerprint, normalizeText } from './normalize';

describe('normalizeText', () => {
  it('normalizes Turkish casing and spaces', () => {
    expect(normalizeText('  Türk Standartları  Enstitüsü ')).toContain('turk');
    expect(normalizeText('TSE')).toBe('tse');
  });
});

describe('buildFingerprint', () => {
  it('joins normalized parts', () => {
    const fp = buildFingerprint(['TSE', 'Bilişim Personeli', null, 'MANUAL']);
    expect(fp).toContain('tse');
    expect(fp).toContain('bilisim');
  });
});
