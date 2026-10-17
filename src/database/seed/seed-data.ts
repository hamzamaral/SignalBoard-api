import { ListingKind, ListingSource, ListingStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { buildFingerprint, normalizeText } from '../../common/utils/normalize';
import { PrismaService } from '../prisma.service';

const INSTITUTIONS = [
  { name: 'Türk Standartları Enstitüsü', aliases: ['TSE'], kind: 'institute', city: 'Ankara' },
  { name: 'Düzce Üniversitesi', aliases: ['DÜZCE ÜNİ'], kind: 'university', city: 'Düzce' },
  { name: 'Sayıştay Başkanlığı', aliases: ['SAYIŞTAY'], kind: 'agency', city: 'Ankara' },
  { name: 'Türkiye Belediyeler Birliği', aliases: ['TBB'], kind: 'association', city: 'Ankara' },
  { name: 'Bursa Uludağ Üniversitesi', aliases: ['ULUDAĞ'], kind: 'university', city: 'Bursa' },
];

export async function seedDatabase(prisma: PrismaService) {
  const adminHash = await bcrypt.hash('Admin123!', 10);
  const userHash = await bcrypt.hash('User123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@signalboard.local',
      fullName: 'SignalBoard Admin',
      role: Role.ADMIN,
      passwordHash: adminHash,
      profile: {
        create: {
          education: 'Lisans',
          preferredCity: 'Ankara',
          kpssScores: { P3: 85, P93: 80 },
          skills: ['Node', 'SQL', 'React'],
          certificates: ['AWS Cloud Practitioner'],
          targetTitles: ['Bilişim Personeli', 'Yazılım'],
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'user@signalboard.local',
      fullName: 'Demo Kullanıcı',
      role: Role.USER,
      passwordHash: userHash,
      profile: {
        create: {
          education: 'Lisans',
          preferredCity: 'İstanbul',
          kpssScores: { P3: 75 },
          skills: ['Java', 'SQL'],
          certificates: [],
          targetTitles: ['Memur', 'Uzman'],
        },
      },
    },
  });

  for (const inst of INSTITUTIONS) {
    await prisma.institution.create({
      data: {
        name: inst.name,
        nameNorm: normalizeText(inst.name),
        kind: inst.kind,
        city: inst.city,
        aliases: {
          create: inst.aliases.map((alias) => ({
            alias,
            aliasNorm: normalizeText(alias),
          })),
        },
      },
    });
  }

  const tse = await prisma.institution.findFirstOrThrow({
    where: { nameNorm: normalizeText('Türk Standartları Enstitüsü') },
  });

  const applyEnd = new Date();
  applyEnd.setDate(applyEnd.getDate() + 45);

  const title = 'Sözleşmeli Bilişim Personeli Alım İlanı';
  await prisma.listing.create({
    data: {
      institutionId: tse.id,
      kind: ListingKind.PUBLIC,
      source: ListingSource.MANUAL,
      status: ListingStatus.OPEN,
      title,
      titleNorm: normalizeText(title),
      position: 'Bilişim Personeli',
      positionNorm: normalizeText('Bilişim Personeli'),
      city: 'Ankara',
      educationLevel: 'Lisans',
      kpssScoreType: 'P3',
      kpssMinScore: 70,
      quota: 17,
      applyStartAt: new Date(),
      applyEndAt: applyEnd,
      url: 'https://kamuilan.sbb.gov.tr/',
      description: 'Demo kamu ilanı — Node, SQL tercih edilir.',
      requiredSkills: ['Node', 'SQL'],
      fingerprint: buildFingerprint([tse.id, title, 'Bilişim Personeli', 'MANUAL']),
      version: 1,
    },
  });

  await prisma.listing.create({
    data: {
      kind: ListingKind.PRIVATE,
      source: ListingSource.PRIVATE,
      status: ListingStatus.OPEN,
      title: 'Full Stack Developer (Özel)',
      titleNorm: normalizeText('Full Stack Developer (Özel)'),
      position: 'Full Stack Developer',
      positionNorm: normalizeText('Full Stack Developer'),
      city: 'İstanbul',
      description: 'Demo özel sektör ilanı',
      requiredSkills: ['React', 'Node'],
      applyEndAt: applyEnd,
      fingerprint: buildFingerprint(['private', 'Full Stack Developer', 'PRIVATE']),
    },
  });

  await prisma.systemSetting.create({
    data: {
      key: 'llm',
      value: { provider: 'OLLAMA', model: 'llama3.2' },
    },
  });

  return { adminEmail: admin.email };
}
