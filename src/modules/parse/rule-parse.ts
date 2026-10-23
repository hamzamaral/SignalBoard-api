import { ParsedListingFields, ParsedPosition } from './parsed-types';

export function ruleParse(text: string): ParsedListingFields {
  const labeled = parseLabeledListing(text);
  if (labeled) return labeled;

  const board = parseJobBoard(text);
  if (board) return board;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = text.replace(/\s+/g, ' ');

  const institutionName = extractInstitution(text) || lines[0];

  const title =
    matchGroup(
      joined,
      /((?:İLK DEFA ATANMAK ÜZERE\s+)?(?:SÖZLEŞMELİ\s+)?(?:MEMUR|ÖĞRETİM|BİLİŞİM|UZMAN|PERSONEL)[^.!\n]{0,80}İLANI)/i,
    ) ||
    lines.find((l) => looksLikeListingTitle(l)) ||
    lines[1];

  const city = extractCity(text);
  const url = extractUrl(text);

  const dated = text.replace(/özel istihdam bürosu[\s\S]{0,900}/i, ' ');
  const dates = [...dated.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/g)].map((m) =>
    toIso(Number(m[1]), Number(m[2]), Number(m[3])),
  );

  const applyRange = matchGroup(
    joined,
    /(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*[-–]\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*tarihleri\s*arasında(?!\s*faaliyette)/i,
  );
  let applyStartAt = dates[0];
  let applyEndAt = dates[1] || dates[0];
  if (applyRange) {
    const parts = [...applyRange.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/g)];
    if (parts[0]) applyStartAt = toIso(+parts[0][1], +parts[0][2], +parts[0][3]);
    if (parts[1]) applyEndAt = toIso(+parts[1][1], +parts[1][2], +parts[1][3]);
  }

  const examAt = extractExamDate(joined);

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
    [/sürücü\s*belge/i, 'Sürücü belgesi'],
    [/programlama|kurs\s*sertifika/i, 'Programlama / kurs belgesi'],
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
    applicationPlace: extractPlace(joined),
    generalRequirements: sliceSection(text, /BAŞVURU GENEL ŞARTLARI/i, /BAŞVURU ÖZEL ŞARTLARI/i),
    specialRequirements: sliceSection(
      text,
      /BAŞVURU ÖZEL ŞARTLARI/i,
      /BAŞVURU ESNASINDA|İSTENİLEN BELGELER/i,
    ),
    examTopics: cleanExamTopics(
      sliceSection(
        text,
        /Sınav\s*Konuları/i,
        /SINAVIN\s*DEĞERLENDİRİLMESİ|İstenen\s*Belgeler|Başvuru\s*(Yeri|Şekli)|Açıklama|İletişim|İlan\s*olunur/i,
      ),
    ),
    evaluationNotes: sliceSection(
      text,
      /SINAVIN DEĞERLENDİRİLMESİ/i,
      /İlan olunur/i,
    ),
    positions,
  };
}

const SERVICE_CLASS =
  '(?:T\\.?\\s*H|G\\.?\\s*İ\\.?\\s*H|G\\.?\\s*I\\.?\\s*H|S\\.?\\s*H|Y\\.?\\s*H|A\\.?\\s*H|D\\.?\\s*H|TH|GIH)';

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
    'Çözümleyici',
    'Programcı',
  ];

  const table = [
    ...text.matchAll(
      new RegExp(
        `(?:^|[\\r\\n])\\s*(\\d{1,2})\\s+([A-ZÇĞİÖŞÜa-zçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü ]{1,40}?)\\s+(${SERVICE_CLASS})\\s+(\\d{1,2})(?:[ \\t]+(\\d{1,3}))?[ \\t]*(?:\\r?\\n[ \\t]*(\\d{1,3}))?`,
        'gi',
      ),
    ),
  ];

  if (table.length) {
    for (const m of table) {
      const seq = Number(m[1]);
      const title = m[2].replace(/\s+/g, ' ').trim();
      if (title.length < 2 || /başvuru|şart|belge/i.test(title)) continue;
      const serviceClass = m[3].replace(/\s+/g, '').replace(/G\.I\.H/i, 'G.İ.H');
      const grade = Number(m[4]);
      const quota = Number(m[5] || m[6] || 1);
      positions.push(positionFromSlice(text, m.index ?? 0, { seq, title, serviceClass, grade, quota }));
    }
  }

  if (!positions.length) {
    const numbered = [
      ...text.matchAll(
        /(\d+)\s+(Mühendis|Mimar|Muhasebeci|Memur|Uzman|Tekniker|Teknisyen|Hemşire|Öğretmen|Avukat|Şef|Çözümleyici|Programcı)[^\n]*?(T\.H|G\.İ\.H|G\.I\.H|TH|GIH)?[^\n]*?(\d+)?[^\n]*?(\d+)?/gi,
      ),
    ];
    for (const m of numbered) {
      positions.push(
        positionFromSlice(text, m.index ?? 0, {
          seq: Number(m[1]),
          title: m[2],
          serviceClass: m[3]?.replace(/G\.I\.H/i, 'G.İ.H'),
          grade: m[4] ? Number(m[4]) : undefined,
          quota: m[5] ? Number(m[5]) : 1,
        }),
      );
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
  if (rules.shape === 'job-board') {
    return {
      ...rules,
      educationLevel: rules.educationLevel || llm.educationLevel,
      url: rules.url || llm.url,
      generalRequirements: rules.generalRequirements || llm.generalRequirements,
      specialRequirements: rules.specialRequirements || llm.specialRequirements,
      description: rules.description || llm.description,
      positions: rules.positions !== undefined ? rules.positions : llm.positions,
    };
  }
  const positions =
    llm.positions?.length && llm.positions.length >= (rules.positions?.length ?? 0)
      ? llm.positions
      : rules.positions?.length
        ? rules.positions
        : llm.positions;

  return {
    institutionName: usableName(llm.institutionName) || rules.institutionName,
    title: usableName(llm.title) || rules.title,
    position: usableName(llm.position) || rules.position,
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
    examTopics: preferExamTopics(rules.examTopics, llm.examTopics),
    evaluationNotes: llm.evaluationNotes || rules.evaluationNotes,
    requiredSkills: llm.requiredSkills?.length ? llm.requiredSkills : rules.requiredSkills,
    positions,
  };
}

const LABEL_LINE =
  /^(başlık|baslik|firma|pozisyon|şehir|sehir|tür|tur|kaynak adresi|ilan tarihi|başvuru başlangıcı|basvuru baslangici|başvuru bitişi|basvuru bitisi|sınav|sinav|sonuç açıklama|sonuc aciklama|çalışma şekli|calisma sekli|eğitim|egitim|açıklama|aciklama)\s*:\s*(.*)$/i;

const KADRO_HEAD = /^KADRO\s+(\d+)\s*:?\s*$/i;
const KADRO_LABEL =
  /^(unvan|sınıf|sinif|derece|adet|eğitim|egitim|cinsiyet|kpss türü|kpss turu|taban puan)\s*:\s*(.*)$/i;

/** Gemini'nin "Başlık: / Firma: / Pozisyon:" bloğu. Etiketler alan adıdır, değer değildir. */
function parseLabeledListing(text: string): ParsedListingFields | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const kadroAt = lines.findIndex((line) => KADRO_HEAD.test(line));
  const headerLines = kadroAt >= 0 ? lines.slice(0, kadroAt) : lines;
  const fields = new Map<string, string>();
  let current: string | null = null;

  for (const line of headerLines) {
    if (!line || /^\d\)\s*ILAN VERISI/i.test(line) || /^kadro sayısı\s*:/i.test(line)) continue;
    const match = line.match(LABEL_LINE);
    if (match) {
      current = normalizeLabel(match[1]);
      fields.set(current, match[2].trim());
      continue;
    }
    if (current === 'açıklama' && !/^\d\)\s/.test(line) && !KADRO_HEAD.test(line)) {
      fields.set(current, `${fields.get(current) ?? ''} ${line}`.trim());
    }
  }

  if (!fields.has('başlık') || !fields.has('firma')) return null;

  const title = blank(fields.get('başlık'));
  const institutionName = blank(fields.get('firma'));
  const hasKadroSection = kadroAt >= 0 || lines.some((line) => /^kadro sayısı\s*:/i.test(line));
  const kadrolar = kadroAt >= 0 ? parseKadroBlocks(lines.slice(kadroAt)) : [];
  const position = kadrolar[0]?.title || blank(fields.get('pozisyon')) || title;
  const city = blank(fields.get('şehir'));
  const description = blank(fields.get('açıklama'));
  const workMode = blank(fields.get('çalışma şekli'));
  const url = blank(fields.get('kaynak adresi'));
  const kind = kindFromLabel(fields.get('tür'));

  if (!title || !institutionName) return null;

  const positions = hasKadroSection
    ? kadrolar
    : position
      ? [{ sequenceNo: 1, title: position, quota: 1 }]
      : [];

  return {
    shape: 'job-board',
    kind,
    title,
    institutionName,
    position: positions.length ? position : blank(fields.get('pozisyon')),
    city,
    url: url && /^https?:\/\//i.test(url) ? url : undefined,
    publishedAt: parseLooseDate(fields.get('ilan tarihi')),
    applyStartAt: parseLooseDate(fields.get('başvuru başlangıcı')),
    applyEndAt: parseLooseDate(fields.get('başvuru bitişi')),
    examAt: parseLooseDate(fields.get('sınav')),
    resultAnnounceAt: parseLooseDate(fields.get('sonuç açıklama')),
    educationLevel: blank(fields.get('eğitim')),
    description: [workMode, description].filter(Boolean).join('\n\n') || undefined,
    positions,
  };
}

function parseKadroBlocks(lines: string[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];
  let current: Record<string, string> | null = null;
  let sequence = 0;

  const flush = () => {
    if (!current) return;
    const title = blank(current.unvan);
    if (!title) {
      current = null;
      return;
    }
    const grade = numberOrUndefined(current.derece);
    const quota = numberOrUndefined(current.adet);
    const minScore = numberOrUndefined(current['taban puan']);
    positions.push({
      sequenceNo: sequence,
      title,
      serviceClass: blank(current.sınıf),
      grade,
      quota,
      educationRequirement: blank(current.eğitim),
      gender: blank(current.cinsiyet),
      kpssScoreType: blank(current['kpss türü'])?.toUpperCase(),
      kpssMinScore: minScore,
    });
    current = null;
  };

  for (const line of lines) {
    const head = line.match(KADRO_HEAD);
    if (head) {
      flush();
      sequence = Number(head[1]);
      current = {};
      continue;
    }
    if (!current) continue;
    const match = line.match(KADRO_LABEL);
    if (!match) continue;
    current[normalizeKadroLabel(match[1])] = match[2].trim();
  }
  flush();
  return positions;
}

function normalizeKadroLabel(label: string): string {
  const key = label.toLocaleLowerCase('tr-TR');
  if (key === 'sinif') return 'sınıf';
  if (key === 'egitim') return 'eğitim';
  if (key === 'kpss turu') return 'kpss türü';
  return key;
}

function numberOrUndefined(value?: string): number | undefined {
  const text = blank(value);
  if (!text) return undefined;
  const match = text.match(/\d{1,3}/);
  return match ? Number(match[0]) : undefined;
}

function normalizeLabel(label: string): string {
  const key = label.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
  if (key === 'baslik') return 'başlık';
  if (key === 'sehir') return 'şehir';
  if (key === 'tur') return 'tür';
  if (key === 'basvuru baslangici') return 'başvuru başlangıcı';
  if (key === 'basvuru bitisi') return 'başvuru bitişi';
  if (key === 'calisma sekli') return 'çalışma şekli';
  if (key === 'egitim') return 'eğitim';
  if (key === 'sinav') return 'sınav';
  if (key === 'sonuc aciklama') return 'sonuç açıklama';
  if (key === 'aciklama') return 'açıklama';
  return key;
}

function blank(value?: string): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || text === '-' || text === '—' || text === '–' || /^yok$/i.test(text)) return undefined;
  return text;
}

function kindFromLabel(value?: string): 'PUBLIC' | 'PRIVATE' | undefined {
  const text = blank(value);
  if (!text) return undefined;
  if (/özel|private/i.test(text)) return 'PRIVATE';
  if (/kamu|public/i.test(text)) return 'PUBLIC';
  return undefined;
}

function parseLooseDate(value?: string): string | undefined {
  const text = blank(value);
  if (!text) return undefined;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return toIso(+iso[3], +iso[2], +iso[1]);
  const tr = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (tr) return toIso(+tr[1], +tr[2], +tr[3]);
  return undefined;
}

function looksLikeListingTitle(line: string): boolean {
  if (isChromeLine(line) || LABEL_LINE.test(line)) return false;
  if (line.length > 180) return false;
  return /İLANI\b/i.test(line) || /PERSONEL/i.test(line) || /ALACAK\s*$/i.test(line);
}

const COMPANY_LINE =
  /^(.{2,140}?)\s+(A\.Ş\.|A\.S\.|Ltd\. Şti\.|Ltd\.|Şti\.|Limited Şirketi)\s*$/i;

function parseJobBoard(text: string): ParsedListingFields | null {
  if (!/kariyer\.net|iş ilanı hakkında|aday kriterleri/i.test(text)) return null;
  if (!/A\.Ş\.|A\.S\.|Ltd\.|Şti\./i.test(text)) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const footerAt = lines.findIndex((l) =>
    /özel istihdam bürosu|elektronik yayıncılık|copyright ©/i.test(l),
  );
  const body = footerAt > 0 ? lines.slice(0, footerAt) : lines;
  const aboutAt = body.findIndex((l) => /iş ilanı hakkında/i.test(l));
  const head = aboutAt > 0 ? body.slice(0, aboutAt) : body;

  const companyIdx = head.findIndex(
    (l) => COMPANY_LINE.test(l) && !/kariyer\.net|elektronik yayıncılık|iş kurumu/i.test(l),
  );
  if (companyIdx < 0) return null;

  const institutionName = head[companyIdx].replace(/\s+/g, ' ').trim();
  let title = '';
  for (let i = companyIdx - 1; i >= 0; i--) {
    if (isChromeLine(head[i])) continue;
    title = head[i];
    break;
  }

  const glued = head.map(splitGluedRole).find(Boolean);
  const fromCrumb = head.map(breadcrumbRole).find(Boolean);
  const position = glued?.role || fromCrumb || title;
  const city =
    head.map(chipCity).find(Boolean) ||
    glued?.city ||
    extractCity(head.join('\n'));

  const nitelik = sliceSection(text, /GENEL NİTELİKLER/i, /İŞ TANIMI/i);
  const tanim = sliceSection(text, /İŞ TANIMI/i, /Aday Kriterleri|Şirket Hakkında/i);
  const educationLevel = matchGroup(
    text.replace(/\s+/g, ' '),
    /Eğitim Seviyesi\s+([^•]{3,120})/i,
  );

  const chips = head.filter((l) => /^(Hibrit|Uzaktan|Tam Zamanlı|Yarı Zamanlı|Staj|Uzman)$/i.test(l));
  const lead = [city, ...chips].filter(Boolean).join(' · ');
  const description = [lead, nitelik, tanim].filter(Boolean).join('\n\n').slice(0, 4000);

  return {
    shape: 'job-board',
    kind: 'PRIVATE',
    institutionName,
    title: title || position,
    position: position || title,
    city: city ? titleCaseCity(city) : undefined,
    educationLevel: educationLevel?.replace(/\s+/g, ' ').trim(),
    description: description || undefined,
    generalRequirements: nitelik,
    specialRequirements: tanim,
    url: extractUrl(text),
    positions: position ? [{ sequenceNo: 1, title: position, quota: 1 }] : [],
  };
}

function isChromeLine(line: string): boolean {
  if (/^(iş ilanları|ana sayfa|hesabım|kariyer\.net)$/i.test(line)) return true;
  if (/iş ilanları$/i.test(line)) return true;
  if (/iş ilanı hakkında/i.test(line)) return true;
  return /^(işlerim|kariyer tavsiyesi|yeni|etkinlikler|maaşlar|mesajlar|profil fotoğrafı|ios_share|kaydet|başvur|takip et|ilanları gör|daha az göster)$/i.test(
    line,
  );
}

function breadcrumbRole(line: string): string | undefined {
  const m = line.match(/^(.+?)\s+İş İlanları$/i);
  if (!m) return undefined;
  const rest = m[1]
    .replace(
      /^(İstanbul|Ankara|İzmir|Bursa|Antalya|Konya|Adana)(\s+Anadolu Yakası|\s+Avrupa Yakası|\s*\(Asya\)|\s*\(Avr\.?\))?\s*/i,
      '',
    )
    .trim();
  if (rest.length < 3) return undefined;
  return rest;
}

function splitGluedRole(line: string): { role: string; city: string } | undefined {
  const m = line.match(/^(.{3,80}?)(İstanbul|Ankara|İzmir|Bursa)\s*(\((?:Asya|Avrupa|Avr\.?)\))?$/i);
  if (!m) return undefined;
  const role = m[1].trim();
  if (role.length < 3 || /ilanı|kariyer/i.test(role)) return undefined;
  return { role, city: m[2] };
}

function chipCity(line: string): string | undefined {
  const m = line.match(/^(İstanbul|Ankara|İzmir|Bursa|Antalya|Konya|Adana)\s*(\((?:Asya|Avrupa|Avr\.?)\))?$/i);
  return m ? m[1] : undefined;
}

function usableName(value?: string): string | undefined {
  if (!value) return undefined;
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name || isChromeLine(name)) return undefined;
  if (/iş\s*kurumu|tıklayın/i.test(name)) return undefined;
  return name;
}

function matchGroup(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

function extractInstitution(text: string): string | undefined {
  const matches = [
    ...text.matchAll(
      /([A-ZÇĞİÖŞÜa-zçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü.'’\-]*(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü.'’\-]*){0,8}\s+(?:Belediye\s+Başkanlığı|Üniversitesi|Bakanlığı|Müdürlüğü|Enstitüsü))/gi,
    ),
  ].map((m) => trimInstitution(m[1]));
  const usable = matches.filter((name) => !/iş\s*kurumu|tıklayın/i.test(name));
  return usable.find((name) => /[a-zçğıöşü]/.test(name)) || usable[0];
}

function trimInstitution(name: string): string {
  const afterProvince = name.match(/\bili\s+(.+)$/i);
  return (afterProvince?.[1] || name).replace(/\s+/g, ' ').trim();
}

function extractCity(text: string): string | undefined {
  const ili = text.match(/\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\s+ili\b/);
  if (ili) return ili[1];
  const known = text.match(
    /\b(İstanbul|Ankara|İzmir|Bursa|Antalya|Konya|Adana|Gaziantep|Kayseri|Mersin|Düzce|Sakarya|Kocaeli|Muş|MUŞ)\b/i,
  );
  return known ? titleCaseCity(known[1]) : undefined;
}

function extractUrl(text: string): string | undefined {
  const https = text.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;]+$/, '');
  if (https) return https;
  const www = text.match(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.replace(/[.,;]+$/, '');
  return www ? `https://${www}` : undefined;
}

function extractExamDate(joined: string): string | undefined {
  const afterLabel = joined.match(
    /sözlü\s*sınav\s*;?\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i,
  );
  if (afterLabel) return toIso(+afterLabel[1], +afterLabel[2], +afterLabel[3]);
  const beforeLabel = joined.match(
    /(\d{1,2})[./](\d{1,2})[./](\d{2,4})\s*tarihinde[^.]*sözlü\s*sınav/i,
  );
  if (beforeLabel) return toIso(+beforeLabel[1], +beforeLabel[2], +beforeLabel[3]);
  return undefined;
}

function extractPlace(joined: string): string | undefined {
  return (
    matchGroup(
      joined,
      /((?:[A-ZÇĞİÖŞÜa-zçğıöşü]+\s+){0,4}Mah(?:allesi|\.)\s+.{5,140}?No:\s*\d+)/i,
    ) || matchGroup(joined, /(Mengüçgazi[^.]{10,140}|Yazı İşleri[^.]{5,80})/i)
  );
}

function positionFromSlice(
  text: string,
  index: number,
  row: {
    seq: number;
    title: string;
    serviceClass?: string;
    grade?: number;
    quota: number;
  },
): ParsedPosition {
  const after = text.slice(index, index + 900);
  const edu = matchGroup(
    after,
    /((?:Lisans|Ön\s*lisans|Yüksek\s*lisans)[\s\S]{0,500}?mezun\s+olmak)/i,
  );
  const kpssMin = Number(matchGroup(after, /En\s*az\s*(\d{2,3})\s*Puan/i));
  return {
    sequenceNo: row.seq,
    title: row.title,
    serviceClass: row.serviceClass,
    grade: row.grade,
    quota: row.quota,
    educationRequirement: edu?.replace(/\s+/g, ' ').trim(),
    gender: /Erkek\s*\/\s*Kadın|Kadın\s*\/\s*Erkek/i.test(after) ? 'Erkek/Kadın' : undefined,
    kpssScoreType: matchGroup(after, /\b(P\d{1,3})\b/i)?.toUpperCase(),
    kpssMinScore: kpssMin || undefined,
  };
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

/** Drop heading echo, trailing truncated junk (e.g. `7."F`). */
export function cleanExamTopics(raw?: string): string | undefined {
  if (!raw) return undefined;
  let t = raw.trim();
  t = t.replace(/^Sınav\s*Konuları\s*[;:.\-–]?\s*/i, '');
  // Drop last line if it looks truncated / broken quote
  const lines = t.split(/\r?\n/).map((l) => l.trimEnd());
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (
      !last ||
      /["'“”]\s*[A-Za-zÇĞİÖŞÜçğıöşü]?\s*$/.test(last) ||
      /^\d+\s*[.)"']?\s*[A-Za-zÇĞİÖŞÜçğıöşü]?\s*$/.test(last) ||
      /["'][A-Za-z]?$/.test(last)
    ) {
      lines.pop();
      continue;
    }
    break;
  }
  t = lines.join('\n').trim();
  if (t.length < 20) return undefined;
  return t.slice(0, 4000);
}

function looksBadExamTopics(t?: string): boolean {
  if (!t) return true;
  if (t.length < 40) return true;
  if (/["'][A-Za-zÇĞİÖŞÜçğıöşü]?$/.test(t.trim())) return true;
  if (/\d+\s*[.)]?\s*["']?[A-Za-z]?\s*$/.test(t.trim())) return true;
  return false;
}

function preferExamTopics(rules?: string, llm?: string): string | undefined {
  const r = cleanExamTopics(rules);
  const l = cleanExamTopics(llm);
  if (l && !looksBadExamTopics(l)) {
    // Prefer longer/cleaner rules if LLM is short garbage
    if (r && r.length > l.length * 1.2) return r;
    return l;
  }
  return r || l;
}
