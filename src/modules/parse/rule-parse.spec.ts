import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanExamTopics, extractPositions, mergeParsed, ruleParse } from './rule-parse';

const fixture = readFileSync(join(__dirname, 'fixtures', 'malazgirt.txt'), 'utf8');
const doganyol = readFileSync(join(__dirname, 'fixtures', 'doganyol.txt'), 'utf8');
const kariyer = readFileSync(join(__dirname, 'fixtures', 'kariyer-konecta.txt'), 'utf8');

describe('ruleParse Malazgirt fixture', () => {
  it('extracts at least 4 positions with KPSS P3 >= 60', () => {
    const parsed = ruleParse(fixture);
    expect(parsed.positions?.length).toBeGreaterThanOrEqual(4);
    const titles = parsed.positions!.map((p) => p.title);
    expect(titles).toEqual(expect.arrayContaining(['Mühendis', 'Mimar', 'Muhasebeci']));
    for (const p of parsed.positions!) {
      expect(p.kpssScoreType).toBe('P3');
      expect(p.kpssMinScore).toBe(60);
    }
  });

  it('extracts apply window, exam date and url', () => {
    const parsed = ruleParse(fixture);
    expect(parsed.applyStartAt).toContain('2026-11-02');
    expect(parsed.applyEndAt).toContain('2026-11-04');
    expect(parsed.examAt).toContain('2026-11-12');
    expect(parsed.url).toContain('malazgirt.bel.tr');
    expect(parsed.applicationMethods).toEqual(
      expect.arrayContaining(['elektronik', 'sahsen', 'posta']),
    );
    expect(parsed.requiredDocuments?.length).toBeGreaterThanOrEqual(3);
  });

  it('extractPositions works standalone', () => {
    expect(extractPositions(fixture).length).toBeGreaterThanOrEqual(4);
  });

  it('merge prefers richer LLM positions when longer', () => {
    const rules = ruleParse(fixture);
    const merged = mergeParsed(rules, {
      title: 'LLM Title',
      positions: [
        ...rules.positions!,
        { title: 'Extra', kpssScoreType: 'P3', kpssMinScore: 70, sequenceNo: 5 },
      ],
    });
    expect(merged.title).toBe('LLM Title');
    expect(merged.positions!.length).toBe(rules.positions!.length + 1);
  });

  it('cleanExamTopics strips heading and truncated junk', () => {
    const raw = `Sınav Konuları; 

Sözlü sınav; 

a) Türkiye Cumhuriyeti Anayasası, 

b) Atatürk İlkeleri ve İnkılâp Tarihi, 

c) 657 sayılı Devlet Memurları Kanunu, 

d) Mahalli idarelerle ilgili temel mevzuat

7."F`;
    const cleaned = cleanExamTopics(raw)!;
    expect(cleaned).not.toMatch(/^Sınav/i);
    expect(cleaned).not.toMatch(/7\."F/);
    expect(cleaned).toContain('Anayasası');
  });

  it('parses a Doğanyol-style sözleşmeli ilan into fields', () => {
    const parsed = ruleParse(doganyol);
    expect(parsed.institutionName).toBe('Doğanyol Belediye Başkanlığı');
    expect(parsed.title).toMatch(/SÖZLEŞMELİ PERSONEL ALIM İLANI/i);
    expect(parsed.city).toBe('Malatya');
    expect(parsed.positions).toEqual([
      expect.objectContaining({
        title: 'Çözümleyici',
        quota: 2,
        grade: 7,
        kpssScoreType: 'P3',
        kpssMinScore: 55,
        gender: 'Erkek/Kadın',
      }),
    ]);
    expect(parsed.applyStartAt).toContain('2026-12-02');
    expect(parsed.applyEndAt).toContain('2026-12-04');
    expect(parsed.examAt).toContain('2026-12-16');
    expect(parsed.resultAnnounceAt).toContain('2026-12-11');
    expect(parsed.url).toBe('https://www.doganyol.bel.tr');
    expect(parsed.applicationPlace).toMatch(/İshak Mahallesi/);
    expect(parsed.applicationPlace).toMatch(/No:\s*12/);
    expect(parsed.requiredDocuments).toEqual(
      expect.arrayContaining(['Kimlik fotokopisi', 'Sürücü belgesi', 'KPSS sonuç belgesi']),
    );
    expect(parsed.examTopics).toMatch(/Anayasası/);
    expect(parsed.examTopics).not.toMatch(/13\/10\/1983/);
  });

  it('splits a Kariyer.net page into position and company, ignoring the İşkur footer', () => {
    const parsed = ruleParse(kariyer);
    expect(parsed.institutionName).toBe('Konecta Teknoloji ve Müşteri Hizmetleri A.Ş.');
    expect(parsed.title).toBe('Conversational AI Designer');
    expect(parsed.position).toBe('Yapay Zeka Programcısı');
    expect(parsed.city).toBe('İstanbul');
    expect(parsed.kind).toBe('PRIVATE');
    expect(parsed.applyStartAt).toBeUndefined();
    expect(parsed.applyEndAt).toBeUndefined();
    expect(parsed.generalRequirements).toMatch(/Büyük Dil Modelleri/);
    expect(parsed.institutionName).not.toMatch(/İş Kurumu|tıklayın/);

    const merged = mergeParsed(parsed, {
      institutionName: 'Diğer iller için tıklayın. Türkiye İş Kurumu İstanbul İl Müdürlüğü',
      title: 'İş İlanları',
      position: 'İş İlanları',
      applyStartAt: '2024-08-31T00:00:00.000Z',
      applyEndAt: '2027-08-30T00:00:00.000Z',
    });
    expect(merged.institutionName).toBe('Konecta Teknoloji ve Müşteri Hizmetleri A.Ş.');
    expect(merged.title).toBe('Conversational AI Designer');
    expect(merged.position).toBe('Yapay Zeka Programcısı');
    expect(merged.applyStartAt).toBeUndefined();
  });

  it('reads a Gemini labeled block into form fields and ignores dashes', () => {
    const text = `Başlık: Senior Full-Stack Developer
Firma: POLOGRON YAPI SANAYİ ANONİM ŞİRKETİ
Pozisyon: Kıdemli Full-Stack Geliştirici
Şehir: İstanbul(Avr.) (Ataşehir)
Tür: Özel
Kaynak adresi: -
İlan tarihi: -
Başvuru başlangıcı: -
Başvuru bitişi: -
Çalışma şekli: İş Yerinde / Tam Zamanlı
Eğitim: Üniversite(Mezun)
Açıklama: Yeni kurulacak yazılım ve teknoloji firmasında görev alacak Senior Full-Stack Developer aranmaktadır. Frontend ve backend geliştirme yürütülecektir.`;
    const parsed = ruleParse(text);
    expect(parsed.title).toBe('Senior Full-Stack Developer');
    expect(parsed.institutionName).toBe('POLOGRON YAPI SANAYİ ANONİM ŞİRKETİ');
    expect(parsed.position).toBe('Kıdemli Full-Stack Geliştirici');
    expect(parsed.city).toBe('İstanbul(Avr.) (Ataşehir)');
    expect(parsed.kind).toBe('PRIVATE');
    expect(parsed.educationLevel).toBe('Üniversite(Mezun)');
    expect(parsed.applyStartAt).toBeUndefined();
    expect(parsed.applyEndAt).toBeUndefined();
    expect(parsed.url).toBeUndefined();
    expect(parsed.description).toContain('görev alacak');
    expect(parsed.description).toContain('İş Yerinde / Tam Zamanlı');
    expect(parsed.title).not.toMatch(/Açıklama|alacak/);
    expect(parsed.institutionName).not.toMatch(/^Başlık/);
  });

  it('reads one kamu ilan with several kadro blocks and keeps an empty list', () => {
    const eligible = `4) ILAN VERISI:
Başlık: Sözleşmeli Personel Alım İlanı
Firma: Doğanyol Belediye Başkanlığı
Pozisyon: Çözümleyici
Şehir: Malatya
Tür: Kamu
Kaynak adresi: https://www.doganyol.bel.tr
İlan tarihi: -
Başvuru başlangıcı: 2026-12-02
Başvuru bitişi: 2026-12-04
Sınav: 2026-12-16
Sonuç açıklama: 2026-12-11
Eğitim: Lisans
Açıklama: Sözleşmeli personel alımı.
Kadro sayısı: 2

KADRO 1:
Unvan: Çözümleyici
Sınıf: TH
Derece: 7
Adet: 2
Eğitim: Lisans
Cinsiyet: Erkek/Kadın
KPSS türü: P3
Taban puan: 55

KADRO 2:
Unvan: Mühendis
Sınıf: TH
Derece: 8
Adet: 1
Eğitim: Lisans
Cinsiyet: -
KPSS türü: P3
Taban puan: 70`;
    const parsed = ruleParse(eligible);
    expect(parsed.institutionName).toBe('Doğanyol Belediye Başkanlığı');
    expect(parsed.kind).toBe('PUBLIC');
    expect(parsed.applyStartAt).toContain('2026-12-02');
    expect(parsed.examAt).toContain('2026-12-16');
    expect(parsed.resultAnnounceAt).toContain('2026-12-11');
    expect(parsed.positions).toEqual([
      expect.objectContaining({
        sequenceNo: 1,
        title: 'Çözümleyici',
        serviceClass: 'TH',
        grade: 7,
        quota: 2,
        kpssScoreType: 'P3',
        kpssMinScore: 55,
      }),
      expect.objectContaining({ title: 'Mühendis', quota: 1, kpssMinScore: 70 }),
    ]);

    const none = ruleParse(`Başlık: Sözleşmeli Personel Alım İlanı
Firma: Marmara Üniversitesi Rektörlüğü
Pozisyon: -
Şehir: İstanbul
Tür: Kamu
Başvuru başlangıcı: 2026-10-23
Başvuru bitişi: 2026-11-06
Sınav: 2026-11-25
Kadro sayısı: 0`);
    expect(none.positions).toEqual([]);
    expect(none.position).toBeUndefined();
    expect(none.examAt).toContain('2026-11-25');
  });

  it('merge drops bad LLM examTopics in favor of rules', () => {
    const rules = { examTopics: 'a) Anayasa\nb) 657\nc) Mesleki bilgi ve yetenek' };
    const merged = mergeParsed(rules, { examTopics: '7."F' });
    expect(merged.examTopics).toContain('Anayasa');
  });
});
