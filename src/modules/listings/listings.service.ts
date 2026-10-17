import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ListingKind,
  ListingSource,
  ListingStatus,
  Prisma,
} from '@prisma/client';
import { buildFingerprint, normalizeText } from '../../common/utils/normalize';
import { PrismaService } from '../../database/prisma.service';
import { InstitutionsService } from '../institutions/institutions.service';

export type UpsertListingInput = {
  institutionName?: string;
  institutionId?: string;
  kind?: ListingKind;
  source: ListingSource;
  status?: ListingStatus;
  title: string;
  position?: string;
  description?: string;
  rawText?: string;
  url?: string;
  city?: string;
  educationLevel?: string;
  kpssScoreType?: string;
  kpssMinScore?: number;
  quota?: number;
  publishedAt?: Date | null;
  applyStartAt?: Date | null;
  applyEndAt?: Date | null;
  resultAt?: Date | null;
  externalKey?: string;
  requiredSkills?: string[];
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly institutions: InstitutionsService,
  ) {}

  async list(params: {
    page?: number;
    limit?: number;
    q?: string;
    kind?: ListingKind;
    status?: ListingStatus;
    source?: ListingSource;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const where: Prisma.ListingWhereInput = {
      kind: params.kind,
      status: params.status,
      source: params.source,
      OR: params.q
        ? [
            { title: { contains: params.q, mode: 'insensitive' } },
            { position: { contains: params.q, mode: 'insensitive' } },
            { institution: { name: { contains: params.q, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        include: { institution: true },
        orderBy: [{ applyEndAt: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { institution: true, revisions: { orderBy: { version: 'desc' }, take: 10 } },
    });
    if (!listing) throw new NotFoundException('İlan bulunamadı');
    return listing;
  }

  async createManual(input: UpsertListingInput) {
    return this.upsertFromSource(input);
  }

  async update(id: string, input: Partial<UpsertListingInput>) {
    const existing = await this.get(id);
    const title = input.title ?? existing.title;
    const position = input.position ?? existing.position ?? undefined;
    let institutionId = input.institutionId ?? existing.institutionId ?? undefined;
    if (input.institutionName) {
      const inst = await this.institutions.resolveByName(input.institutionName);
      if (inst) institutionId = inst.id;
    }

    const fingerprint = buildFingerprint([
      institutionId ?? input.institutionName,
      title,
      position,
      existing.source,
      existing.externalKey ?? undefined,
    ]);

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        institutionId,
        title,
        titleNorm: normalizeText(title),
        position,
        positionNorm: position ? normalizeText(position) : null,
        description: input.description ?? existing.description,
        rawText: input.rawText ?? existing.rawText,
        url: input.url ?? existing.url,
        city: input.city ?? existing.city,
        educationLevel: input.educationLevel ?? existing.educationLevel,
        kpssScoreType: input.kpssScoreType ?? existing.kpssScoreType,
        kpssMinScore:
          input.kpssMinScore !== undefined
            ? input.kpssMinScore
            : existing.kpssMinScore ?? undefined,
        quota: input.quota ?? existing.quota,
        publishedAt: input.publishedAt === undefined ? existing.publishedAt : input.publishedAt,
        applyStartAt:
          input.applyStartAt === undefined ? existing.applyStartAt : input.applyStartAt,
        applyEndAt: input.applyEndAt === undefined ? existing.applyEndAt : input.applyEndAt,
        resultAt: input.resultAt === undefined ? existing.resultAt : input.resultAt,
        requiredSkills: input.requiredSkills ?? existing.requiredSkills,
        status: input.status ?? existing.status,
        fingerprint,
        version: { increment: 1 },
      },
      include: { institution: true },
    });

    await this.prisma.listingRevision.create({
      data: {
        listingId: id,
        version: updated.version,
        snapshot: existing as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.userListing.updateMany({
      where: { listingId: id },
      data: { updatedFlag: true },
    });

    return updated;
  }

  /**
   * Dedup: aynı fingerprint → update+revision.
   * Aynı kurum/unvan ama yeni başvuru penceresi → yeni listing (eski CLOSED).
   */
  async upsertFromSource(input: UpsertListingInput) {
    let institutionId = input.institutionId;
    if (!institutionId && input.institutionName) {
      const found = await this.institutions.resolveByName(input.institutionName);
      if (found) {
        institutionId = found.id;
      } else {
        const created = await this.institutions.create({
          name: input.institutionName,
          city: input.city,
        });
        institutionId = created.id;
      }
    }

    if (input.externalKey) {
      const byExternal = await this.prisma.listing.findUnique({
        where: {
          source_externalKey: { source: input.source, externalKey: input.externalKey },
        },
      });
      if (byExternal) {
        return this.update(byExternal.id, { ...input, institutionId });
      }
    }

    const fingerprint = buildFingerprint([
      institutionId ?? input.institutionName,
      input.title,
      input.position,
      input.source,
      input.externalKey,
    ]);

    const existing = await this.prisma.listing.findUnique({ where: { fingerprint } });
    if (existing) {
      const isNewWindow =
        existing.applyEndAt &&
        input.applyStartAt &&
        existing.applyEndAt < input.applyStartAt &&
        existing.status !== ListingStatus.OPEN;

      if (isNewWindow) {
        await this.prisma.listing.update({
          where: { id: existing.id },
          data: { status: ListingStatus.CLOSED },
        });
        return this.createNew({
          ...input,
          institutionId,
          fingerprint: buildFingerprint([
            institutionId ?? input.institutionName,
            input.title,
            input.position,
            input.source,
            input.externalKey,
            input.applyStartAt?.toISOString(),
          ]),
          listingGroupId: existing.listingGroupId ?? existing.id,
        });
      }

      return this.update(existing.id, { ...input, institutionId });
    }

    // Soft duplicate check
    const similar = await this.prisma.listing.findFirst({
      where: {
        institutionId: institutionId ?? undefined,
        titleNorm: normalizeText(input.title),
        status: ListingStatus.OPEN,
        ...(input.externalKey
          ? {
              NOT: {
                AND: [{ source: input.source }, { externalKey: input.externalKey }],
              },
            }
          : {}),
      },
    });

    return this.createNew({
      ...input,
      institutionId,
      fingerprint,
      possibleDup: Boolean(similar),
      listingGroupId: similar?.listingGroupId ?? similar?.id,
    });
  }

  private async createNew(
    input: UpsertListingInput & {
      institutionId?: string;
      fingerprint: string;
      possibleDup?: boolean;
      listingGroupId?: string;
    },
  ) {
    try {
      const created = await this.prisma.listing.create({
        data: {
          institutionId: input.institutionId,
          kind: input.kind ?? ListingKind.PUBLIC,
          source: input.source,
          status: input.status ?? ListingStatus.OPEN,
          title: input.title,
          titleNorm: normalizeText(input.title),
          position: input.position,
          positionNorm: input.position ? normalizeText(input.position) : null,
          description: input.description,
          rawText: input.rawText,
          url: input.url,
          city: input.city,
          educationLevel: input.educationLevel,
          kpssScoreType: input.kpssScoreType,
          kpssMinScore: input.kpssMinScore,
          quota: input.quota,
          publishedAt: input.publishedAt ?? undefined,
          applyStartAt: input.applyStartAt ?? undefined,
          applyEndAt: input.applyEndAt ?? undefined,
          resultAt: input.resultAt ?? undefined,
          externalKey: input.externalKey,
          fingerprint: input.fingerprint,
          possibleDup: input.possibleDup ?? false,
          listingGroupId: input.listingGroupId,
          requiredSkills: input.requiredSkills ?? [],
        },
        include: { institution: true },
      });

      await this.prisma.listingRevision.create({
        data: {
          listingId: created.id,
          version: 1,
          snapshot: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Aynı fingerprint veya external key ile ilan zaten var');
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.listing.delete({ where: { id } });
    return { ok: true };
  }
}
