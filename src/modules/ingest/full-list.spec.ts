import { mapIlanGovAd } from './ilan-gov.adapter';
import { parseYerelAnnouncements, parseTurkishDate, yerelPageNumbers } from './yerel-yonetimler.adapter';

describe('ilan.gov full personnel list', () => {
  it('maps urlStr, city and publish date from the live payload shape', () => {
    const card = mapIlanGovAd({
      id: '2259316',
      title: 'İstanbul Gedik Üniversitesi Öğretim Elemanı Alım İlanı',
      advertiserName: 'İSTANBUL GEDİK ÜNİVERSİTESİ REKTÖRLÜĞÜ',
      addressCityName: 'İSTANBUL',
      publishStartDate: '2026-10-15T21:00:01Z',
      urlStr: '/ilan/2259316/gedik',
    });
    expect(card.id).toBe('2259316');
    expect(card.link).toBe('https://www.ilan.gov.tr/ilan/2259316/gedik');
    expect(card.city).toBe('İSTANBUL');
    expect(card.publishedAt?.toISOString()).toBe('2026-10-15T21:00:01.000Z');
  });
});

describe('yerel yönetimler full announcement pages', () => {
  const html = `
    <a class="nav" href="https://yerelyonetimler.csb.gov.tr/rehber">Rehber personel kılavuzu</a>
    <a class="duyurular-wrapper" href="https://yerelyonetimler.csb.gov.tr/izmir-sozlesmeli-personel-duyuru-1">
      <div class="date"><span><i>16</i> Ekim 2026</span><p>Cuma</p></div>
      <div class="info"><p>İZMİR KARABAĞLAR SÖZLEŞMELİ PERSONEL ALIM İLANI</p></div>
    </a>
    <a class="duyurular-category-card-wrapper" href="https://yerelyonetimler.csb.gov.tr/zonguldak-zabita-duyuru-2">
      <div class="duyurular-category-card-body-wrapper">
        <span>29 Eylül 2026</span>
        <p>ZONGULDAK BELEDİYESİ ZABITA MEMUR ALIMI İPTAL İLANI</p>
      </div>
    </a>
    <a class="pagination-link" href="https://yerelyonetimler.csb.gov.tr/duyurular/1">1</a>
    <a class="pagination-link" href="https://yerelyonetimler.csb.gov.tr/duyurular/3">3</a>
  `;

  it('reads announcement cards and ignores other links', () => {
    const items = parseYerelAnnouncements(html);
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain('KARABAĞLAR');
    expect(items[0].publishedAt?.getDate()).toBe(16);
    expect(items[1].title).toContain('ZONGULDAK');
    expect(items[1].publishedAt?.getMonth()).toBe(8);
    expect(items[1].publishedAt?.getDate()).toBe(29);
  });

  it('discovers every duyurular page number', () => {
    expect(yerelPageNumbers(html)).toEqual([1, 3]);
  });

  it('parses a Turkish calendar date', () => {
    expect(parseTurkishDate('09 Ekim 2026 Cuma')?.getDate()).toBe(9);
    expect(parseTurkishDate('yok')).toBeNull();
  });
});
