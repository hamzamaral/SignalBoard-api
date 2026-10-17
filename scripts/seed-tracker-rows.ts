/**
 * Upserts demo kamu + özel tracker rows for existing DB (admin@signalboard.local).
 * Run: npx ts-node --transpile-only scripts/seed-tracker-rows.ts
 */
import {
  ListingKind,
  ListingSource,
  ListingStatus,
  PipelineStatus,
  PrismaClient,
} from '@prisma/client';
import { buildFingerprint, normalizeText } from '../src/common/utils/normalize';

const prisma = new PrismaClient();

const KAMU_ROWS: Array<{
  title: string;
  position?: string;
  applyStart: string;
  applyEnd: string;
  url: string;
  status?: PipelineStatus;
  checkedAt?: string;
}> = [
  {
    title: 'Düzce Üni 153 SÖZLEŞMELİ İLANI',
    applyStart: '2026-10-14',
    applyEnd: '2026-10-28',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'Sağlık Bilimleri Üniversitesi ÖĞRETİM ÜYESİ',
    applyStart: '2026-10-14',
    applyEnd: '2026-10-28',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'TÜRK STAND ENST SÖZLEŞMELİ BİLİŞİM PERS',
    applyStart: '2026-10-15',
    applyEnd: '2026-10-28',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'Necmettin Erbakan Üni ÖĞRETİM ÜYESİ',
    applyStart: '2026-10-13',
    applyEnd: '2026-10-28',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'İstanbul Teknik Üni 25 SÖZLEŞMELİ İLANI',
    applyStart: '2026-10-13',
    applyEnd: '2026-10-27',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'MEVLANA KALKINMA AJANSI 1 Uzman',
    applyStart: '2026-10-02',
    applyEnd: '2026-10-13',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'ŞIRNAK ÜNİ 14 SÖZLEŞMELİ İLANI',
    applyStart: '2026-10-02',
    applyEnd: '2026-10-26',
    url: 'https://kamuilan.sbb.gov.tr/',
    status: PipelineStatus.CANNOT_APPLY,
    checkedAt: '2026-10-14',
  },
  {
    title: 'TAPU VE KADASTRO - BİLİŞİM PER İLANI (2026)',
    applyStart: '2026-10-12',
    applyEnd: '2026-10-19',
    url: 'https://www.kariyerkapisi.cbiko.gov.tr/',
    status: PipelineStatus.APPLIED,
    checkedAt: '2026-10-16',
  },
];

const PRIVATE_ROWS: Array<{
  firm: string;
  channel?: string;
  mailOk?: boolean;
  formOk?: boolean;
  position?: string;
}> = [
  { firm: 'LOGVANCE LOJİSTİK', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Sarsılmaz Silah Sanayi A.Ş', channel: 'kariyer.net', mailOk: true, formOk: true, position: 'erp uzmanı' },
  { firm: 'İdeateks Moda', channel: 'kariyer.net', mailOk: true },
  { firm: 'BEYKÖYÜ', channel: 'kariyer.net', mailOk: true },
  { firm: 'Asimetrik Ses Işık ve Görüntü', channel: 'kariyer.net', mailOk: true, formOk: true, position: 'AND DEV' },
  { firm: 'Zülal Uçar Reklam Ajansı', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'UZM Group', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'BAŞAK YAZILIM A.Ş.', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Tez Medikal Sağlık Turizm', channel: 'kariyer.net', mailOk: true },
  { firm: 'BARKIN AKYÜZ', channel: 'kariyer.net', mailOk: true },
  { firm: 'Enka Motorlu Araçlar', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'EFOR MOTORLU ARAÇLAR VE OTOMOTİV TİCARET', channel: 'kariyer.net', mailOk: true },
  { firm: 'Ark He Yazılım Teknolojileri ve Turizm', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Promedart Biyoteknoloji ve Özel Sağ', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'YAPI MERKEZİ HOLDİNG', channel: 'kariyer.net', mailOk: true },
  { firm: 'ARF TEKNOLOJİ ANONİM ŞİRKE', channel: 'kariyer.net', mailOk: true },
  { firm: 'daikin', channel: 'kariyer.net', mailOk: true },
  { firm: 'Sistaş Sayısal İletişim San. ve Tic. A', channel: 'kariyer.net', mailOk: true },
  { firm: 'POLOGRON YAPI SANAYİ ANONİM ŞİRKET', channel: 'kariyer.net', mailOk: true },
  { firm: 'LYRA GROUP DIŞ TİCARET LİMİTED ŞİRKETİ', channel: 'kariyer.net', mailOk: true },
  { firm: 'Gelecek Varlık Yönetimi A.Ş.' },
  { firm: 'Open Yazılım', mailOk: true },
  { firm: 'KAT MEKATRONİK ÜRÜNLERİ A.Ş.', channel: 'kariyer.net', mailOk: true },
  { firm: 'KurumSoft Kurumsal Bilişim Tekn.ve Danş.Hizm.A.Ş.', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Ricoh Turkey', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'İdea Teknoloji Çözümleri Bilgisayar Sanayi Tic.a.ş.', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Ekaf Teknoloji', channel: 'kariyer.net' },
  { firm: 'TUNNELSC MEDYA YAZILIM LİMİTED ŞİRK', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Industrial Application Softwar', channel: 'kariyer.net', mailOk: true },
  { firm: 'Asis Otomasyon Ar-Ge Merkez', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Asis Elektronik ve Bilişim Sistemleri', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Horoz Lojistik Kargo Hizmetleri ve Tic. A.Ş', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Samet Kalıp ve Madeni Eşya San', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'PERKOTEK TEKNOLOJİ DIŞ TİCARET ANONİM ŞİRKETİ', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Altan Hidrolik Müh. San. Tic. A.', channel: 'kariyer.net', mailOk: true },
  { firm: 'CS Eğitim Ve Danışmanlık Ltd.Şti. - Orbis Rehberli', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'SEDEF TOPTAN ALTIN TİCARET LİMİTED ŞİRKETİ', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'TEKSİM GİYİM SAN. VE TİC. A.Ş', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'CONSERA YAPI ENDÜSTRİ VE TAAHHÜT LİMİTED ŞİRKETİ', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'TUNCA GROUP DANIŞMANLIK LİMİTED', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Dal Engineering Group', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Özler Plastik San. ve Tic. A.Ş.', channel: 'kariyer.net', mailOk: true, formOk: true },
  { firm: 'Turkuvaz Medya Grubu', channel: 'kariyer.net', mailOk: true, formOk: true },
];

async function upsertListing(opts: {
  kind: ListingKind;
  source: ListingSource;
  title: string;
  position?: string;
  url?: string;
  applyStartAt?: Date;
  applyEndAt?: Date;
  institutionName?: string;
}) {
  const externalKey = `seed:${normalizeText(opts.title).slice(0, 80)}`;
  const fingerprint = buildFingerprint([
    opts.institutionName ?? opts.title,
    opts.title,
    opts.position,
    opts.source,
    externalKey,
  ]);

  let institutionId: string | undefined;
  if (opts.institutionName) {
    const nameNorm = normalizeText(opts.institutionName);
    const existing = await prisma.institution.findFirst({ where: { nameNorm } });
    if (existing) institutionId = existing.id;
    else {
      const created = await prisma.institution.create({
        data: { name: opts.institutionName, nameNorm, kind: 'company' },
      });
      institutionId = created.id;
    }
  }

  const byExt = await prisma.listing.findUnique({
    where: { source_externalKey: { source: opts.source, externalKey } },
  });
  if (byExt) {
    return prisma.listing.update({
      where: { id: byExt.id },
      data: {
        title: opts.title,
        titleNorm: normalizeText(opts.title),
        position: opts.position,
        positionNorm: opts.position ? normalizeText(opts.position) : null,
        url: opts.url,
        applyStartAt: opts.applyStartAt,
        applyEndAt: opts.applyEndAt,
        institutionId,
        status: ListingStatus.OPEN,
      },
    });
  }

  const byFp = await prisma.listing.findUnique({ where: { fingerprint } });
  if (byFp) {
    return prisma.listing.update({
      where: { id: byFp.id },
      data: {
        title: opts.title,
        position: opts.position,
        url: opts.url,
        applyStartAt: opts.applyStartAt,
        applyEndAt: opts.applyEndAt,
        institutionId,
        externalKey,
      },
    });
  }

  return prisma.listing.create({
    data: {
      kind: opts.kind,
      source: opts.source,
      status: ListingStatus.OPEN,
      title: opts.title,
      titleNorm: normalizeText(opts.title),
      position: opts.position,
      positionNorm: opts.position ? normalizeText(opts.position) : null,
      url: opts.url,
      applyStartAt: opts.applyStartAt,
      applyEndAt: opts.applyEndAt,
      publishedAt: opts.applyStartAt,
      externalKey,
      fingerprint,
      institutionId,
    },
  });
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@signalboard.local' } });
  if (!admin) {
    throw new Error('admin@signalboard.local yok — önce prisma db seed çalıştırın');
  }

  let kamu = 0;
  for (const row of KAMU_ROWS) {
    const listing = await upsertListing({
      kind: ListingKind.PUBLIC,
      source: ListingSource.KAMUILAN,
      title: row.title,
      position: row.position,
      url: row.url,
      applyStartAt: new Date(row.applyStart),
      applyEndAt: new Date(`${row.applyEnd}T23:59:59`),
      institutionName: row.title.split(/\s+(SÖZLEŞMELİ|ÖĞRETİM|1 |14 |25 |153 )/i)[0]?.trim() || row.title,
    });
    if (row.status) {
      await prisma.userListing.upsert({
        where: { userId_listingId: { userId: admin.id, listingId: listing.id } },
        create: {
          userId: admin.id,
          listingId: listing.id,
          status: row.status,
          notes: row.checkedAt ? `Kontrol: ${row.checkedAt}` : undefined,
        },
        update: { status: row.status },
      });
    }
    kamu += 1;
  }

  let priv = 0;
  for (const row of PRIVATE_ROWS) {
    const listing = await upsertListing({
      kind: ListingKind.PRIVATE,
      source: ListingSource.PRIVATE,
      title: row.firm,
      position: row.position,
      institutionName: row.firm,
      url: row.channel === 'kariyer.net' ? 'https://www.kariyer.net/' : undefined,
    });
    await prisma.userListing.upsert({
      where: { userId_listingId: { userId: admin.id, listingId: listing.id } },
      create: {
        userId: admin.id,
        listingId: listing.id,
        status: PipelineStatus.TO_APPLY,
        applyChannel: row.channel ?? null,
        mailOk: row.mailOk ?? false,
        formOk: row.formOk ?? false,
      },
      update: {
        applyChannel: row.channel ?? null,
        mailOk: row.mailOk ?? false,
        formOk: row.formOk ?? false,
      },
    });
    priv += 1;
  }

  console.log(`Seed tracker OK: ${kamu} kamu, ${priv} özel`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
