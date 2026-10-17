import { ParsedListingFields, ParsedPosition } from './parsed-types';

export function ruleParse(text: string): ParsedListingFields {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = text.replace(/\s+/g, ' ');

  const institutionName =
    matchGroup(
      joined,
      /([A-ZÇĞİÖŞÜa-zçğıöşü0-9 .\-]+(?:ÜNİVERSİTESİ|BAŞKANLIĞI|ENSTİTÜSÜ|MÜDÜRLÜĞÜ|BAKANLIĞI|BELEDİYESİ|BELEDİYE BAŞKANLIĞI))/i,
    ) || lines[0];

  const title =
    matchGroup(
      joined,
      /((?:İLK DEFA ATANMAK ÜZERE\s+)?(?:SÖZLEŞMELİ\s+)?(?:MEMUR|ÖĞRETİM|BİLİŞİM|UZMAN|PERSONEL)[^.!\n]{0,80}İLANI)/i,
    ) ||
    lines.find((l) => /İLANI|ALACAK|PERSONEL/i.test(l)) ||
    lines[1];

  const city =
    matchGroup(
      joined,
      /\b(İstanbul|Ankara|İzmir|Bursa|Antalya|Konya|Adana|Gaziantep|Kayseri|Mersin|Düzce|Sakarya|Kocaeli|Muş|MUŞ)\b/i,
    ) || undefined;

  const url = matchGroup(joined, /(https?:\/\/[^\s)]+)/i) || undefined;

  const dates = [...text.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/g)].map((m) =>
    toIso(Number(m[1]), Number(m[2]), Number(m[3])),
  );

  const applyRange = matchGroup(
    joined,
    /(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*[-–]\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*tarihleri\s*arasında/i,
  );
  let applyStartAt = dates[0];
  let applyEndAt = dates[1] || dates[0];
  if (applyRange) {
    const parts = [...applyRange.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/g)];
    if (parts[0]) applyStartAt = toIso(+parts[0][1], +parts[0][2], +parts[0][3]);
    if (parts[1]) applyEndAt = toIso(+parts[1][1], +parts[1][2], +parts[1][3]);
  }

  const examMatch = joined.match(
    /(\d{1,2})[./](\d{1,2})[./](\d{2,4})\s*tarihinde[^.]*sözlü\s*sınav/i,
  );
  const examAt = examMatch
    ? toIso(+examMatch[1], +examMatch[2], +examMatch[3])
    : dates.find((_, i) => i >= 2);

  const announceMatch = joined.match(
    /(\d{1,2})[./](\d{1,2})[./](\d{2,4})\s*tarihinde[^.]*web\s*sayfas/i,
  );
  const resultAnnounceAt = announceMatch
    ? toIso(+announceMatch[1], +announceMatch[2], +announceMatch[3])
    : undefined;

  const methods: string[] = [];
  if (/elektronik\s*ortamda/i.test(joined)) methods.push('elektronik');
  if (/şahsen|yazı\s*işleri/i.test(joined)) methods.push('sahsen');
  if (/posta/i.test(joined)) methods.push('posta');

  const docs: string[] = [];
  const docPatterns: Array<[RegExp, string]> = [
    [/nüfus|kimlik/i, 'Kimlik fotokopisi'],
    [/diploma|mezuniyet/i, 'Diploma / mezuniyet belgesi'],
    [/denklik/i, 'Denklik belgesi'],
    [/KPSS\s*sonuç/i, 'KPSS sonuç belgesi'],
    [/vesikalık|fotoğraf/i, 'Vesikalık fotoğraf'],
    [/dilekçe/i, 'Kadro dilekçesi'],
  ];
  for (const [re, label] of docPatterns) {
    if (re.test(joined)) docs.push(label);
  }

  const positions = extractPositions(text);
  const first = positions[0];

  const educationLevel = /lisans/i.test(joined)
    ? 'Lisans'
    : /ön\s*lisans/i.test(joined)
      ? 'Önlisans'
      : undefined;

  return {
    institutionName,
    title,
    position: first?.title || title,
    city: city ? titleCaseCity(city) : undefined,
    educationLevel,
    kpssScoreType: first?.kpssScoreType,
    kpssMinScore: first?.kpssMinScore,
    quota: positions.reduce((s, p) => s + (p.quota ?? 0), 0) || undefined,
    applyStartAt,
    applyEndAt,
    examAt,
    resultAnnounceAt,
    url,
    applicationMethods: methods,
    requiredDocuments: docs,
    applicationPlace: matchGroup(joined, /(Mengüçgazi[^.]{10,120}|Yazı İşleri[^.]{5,80})/i),
    generalRequirements: sliceSection(text, /BAŞVURU GENEL ŞARTLARI/i, /BAŞVURU ÖZEL ŞARTLARI/i),
    specialRequirements: sliceSection(
      text,
      /BAŞVURU ÖZEL ŞARTLARI/i,
      /BAŞVURU ESNASINDA|İSTENİLEN BELGELER/i,
    ),
    examTopics: sliceSection(text, /Sınav Konuları/i, /SINAVIN DEĞERLENDİRİLMESİ/i),
    evaluationNotes: sliceSection(
      text,
      /SINAVIN DEĞERLENDİRİLMESİ/i,
      /İlan olunur/i,
    ),
    positions,
  };
}

export function extractPositions(text: string): ParsedPosition[] {
  const positions: ParsedPosition[] = [];
  const titles = [
    'Mühendis',
    'Mimar',
    'Muhasebeci',
    'Memur',
    'Uzman',
    'Tekniker',
    'Teknisyen',
    'Hemşire',
    'Öğretmen',
    'Avukat',
    'Şef',
  ];

  // Pattern: "1 Mühendis T.H 8 1" then education block then "P3" "60"
  const numbered = [
    ...text.matchAll(
      /(\d+)\s+(Mühendis|Mimar|Muhasebeci|Memur|Uzman|Tekniker|Teknisyen|Hemşire|Öğretmen|Avukat|Şef)[^\n]*?(T\.H|G\.İ\.H|G\.I\.H|TH|GIH)?[^\n]*?(\d+)?[^\n]*?(\d+)?/gi,
    ),
  ];

  if (numbered.length) {
    for (const m of numbered) {
      const seq = Number(m[1]);
      const title = m[2];
      const serviceClass = m[3]?.replace(/G\.I\.H/i, 'G.İ.H') || undefined;
      const grade = m[4] ? Number(m[4]) : undefined;
      const quota = m[5] ? Number(m[5]) : 1;

      const after = text.slice(m.index ?? 0, (m.index ?? 0) + 800);
      const edu = matchGroup(
        after,
        /((?:Lisans|Ön\s*lisans|Yüksek\s*lisans)[^.]*?(?:mezun olmak|programından)[^.]*\.)/i,
      );
      const kpssType = matchGroup(after, /\b(P\d{1,3})\b/i)?.toUpperCase();
      const kpssMin =
        Number(matchGroup(after, /En\s*az\s*(\d{2,3})\s*Puan/i)) ||
        Number(matchGroup(after, /taban[^\d]*(\d{2,3})/i)) ||
        undefined;
      const gender = /Erkek\s*\/\s*Kadın|Kadın\s*\/\s*Erkek/i.test(after)
        ? 'Erkek/Kadın'
        : undefined;

      positions.push({
        sequenceNo: seq,
        title,
        serviceClass,
        grade,
        quota,
        educationRequirement: edu,
        gender,
        kpssScoreType: kpssType,
        kpssMinScore: kpssMin,
      });
    }
  }

  // Fallback: find known titles with nearby KPSS
  if (!positions.length) {
    for (const t of titles) {
      const re = new RegExp(`${t}[\\s\\S]{0,400}?\\b(P\\d{1,3})\\b[\\s\\S]{0,80}?(\\d{2,3})`, 'i');
      const m = text.match(re);
      if (m) {
        positions.push({
          sequenceNo: positions.length + 1,
          title: t,
          kpssScoreType: m[1].toUpperCase(),
          kpssMinScore: Number(m[2]),
          quota: 1,
        });
      }
    }
  }

  return positions;
}

export function mergeParsed(
  rules: ParsedListingFields,
  llm: ParsedListingFields | null,
): ParsedListingFields {
  if (!llm) return rules;
  const positions =
    llm.positions?.length && llm.positions.length >= (rules.positions?.length ?? 0)
      ? llm.positions
      : rules.positions?.length
        ? rules.positions
        : llm.positions;

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
    examAt: llm.examAt || rules.examAt,
    resultAnnounceAt: llm.resultAnnounceAt || rules.resultAnnounceAt,
    url: llm.url || rules.url,
    applicationPlace: llm.applicationPlace || rules.applicationPlace,
    applicationMethods: llm.applicationMethods?.length
      ? llm.applicationMethods
      : rules.applicationMethods,
    requiredDocuments: llm.requiredDocuments?.length
      ? llm.requiredDocuments
      : rules.requiredDocuments,
    generalRequirements: llm.generalRequirements || rules.generalRequirements,
    specialRequirements: llm.specialRequirements || rules.specialRequirements,
    examTopics: llm.examTopics || rules.examTopics,
    evaluationNotes: llm.evaluationNotes || rules.evaluationNotes,
    requiredSkills: llm.requiredSkills?.length ? llm.requiredSkills : rules.requiredSkills,
    positions,
  };
}

function matchGroup(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

function toIso(d: number, mo: number, y: number): string {
  if (y < 100) y += 2000;
  return new Date(Date.UTC(y, mo - 1, d)).toISOString();
}

function titleCaseCity(c: string): string {
  if (c.toUpperCase() === 'MUŞ' || c.toLowerCase() === 'muş') return 'Muş';
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

function sliceSection(text: string, start: RegExp, end: RegExp): string | undefined {
  const s = text.search(start);
  if (s < 0) return undefined;
  const rest = text.slice(s);
  const e = rest.search(end);
  const chunk = (e > 0 ? rest.slice(0, e) : rest.slice(0, 1500)).trim();
  return chunk.length > 40 ? chunk.slice(0, 4000) : undefined;
}
