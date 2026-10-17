import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeText } from '../../common/utils/normalize';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(q?: string, page = 1, limit = 20) {
    const where: Prisma.InstitutionWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { nameNorm: { contains: normalizeText(q) } },
            { aliases: { some: { alias: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {};
    return this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        include: { aliases: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.institution.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  }

  async create(data: { name: string; city?: string; kind?: string; aliases?: string[] }) {
    const nameNorm = normalizeText(data.name);
    return this.prisma.institution.create({
      data: {
        name: data.name.trim(),
        nameNorm,
        city: data.city,
        kind: data.kind,
        aliases: data.aliases?.length
          ? {
              create: data.aliases.map((alias) => ({
                alias,
                aliasNorm: normalizeText(alias),
              })),
            }
          : undefined,
      },
      include: { aliases: true },
    });
  }

  async update(
    id: string,
    data: { name?: string; city?: string; kind?: string; isActive?: boolean },
  ) {
    await this.ensure(id);
    return this.prisma.institution.update({
      where: { id },
      data: {
        ...data,
        name: data.name?.trim(),
        nameNorm: data.name ? normalizeText(data.name) : undefined,
      },
      include: { aliases: true },
    });
  }

  async resolveByName(rawName: string) {
    const norm = normalizeText(rawName);
    const byName = await this.prisma.institution.findFirst({
      where: { OR: [{ nameNorm: norm }, { aliases: { some: { aliasNorm: norm } } }] },
    });
    if (byName) return byName;

    const candidates = await this.prisma.institution.findMany({ take: 500 });
    let best: { id: string; score: number } | null = null;
    for (const c of candidates) {
      const score = similarity(norm, c.nameNorm);
      if (!best || score > best.score) best = { id: c.id, score };
    }
    if (best && best.score >= 0.72) {
      return this.prisma.institution.findUniqueOrThrow({ where: { id: best.id } });
    }
    return null;
  }

  async ensure(id: string) {
    const row = await this.prisma.institution.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Kurum bulunamadı');
    return row;
  }
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}
