import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ListingKind,
  ListingSource,
  ListingStatus,
  Prisma,
} from '@prisma/client';
import { buildFingerprint, normalizeText } from '../../common/utils/normalize';
import { PrismaService } from '../../database/prisma.service';
import { InstitutionsService } from '../institutions/institutions.service';
import { ParsedPosition } from '../parse/parsed-types';

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
  examAt?: Date | null;
  resultAnnounceAt?: Date | null;
  applicationPlace?: string;
  applicationMethods?: string[];
  requiredDocuments?: string[];
  generalRequirements?: string;
  specialRequirements?: string;
  examTopics?: string;
  evaluationNotes?: string;
  externalKey?: string;
  requiredSkills?: string[];
  positions?: ParsedPosition[];
};

const listingInclude = {
  institution: true,
  positions: { orderBy: { sequenceNo: 'asc' as const } },
};

function listingWhere(params: {
  q?: string;
  kind?: ListingKind;
  status?: ListingStatus;
  source?: ListingSource;
  createdFrom?: string;
  createdTo?: string;
}): Prisma.ListingWhereInput {
  const createdAt =
    params.createdFrom || params.createdTo
      ? {
          gte: params.createdFrom ? new Date(params.createdFrom) : undefined,
          lte: params.createdTo ? new Date(`${params.createdTo}T23:59:59.999`) : undefined,
        }
      : undefined;
  const qNorm = params.q?.trim() ? normalizeText(params.q) : '';
  return {
    kind: params.kind,
    status: params.status,
    source: params.source,
    createdAt,
    OR: qNorm
      ? [
          { titleNorm: { contains: qNorm } },
          { positionNorm: { contains: qNorm } },
          { institution: { nameNorm: { contains: qNorm } } },
          { positions: { some: { titleNorm: { contains: qNorm } } } },
          { title: { contains: params.q, mode: 'insensitive' } },
          { institution: { name: { contains: params.q, mode: 'insensitive' } } },
        ]
      : undefined,
  };
}

function listingOrder(
  sort?: string,
  order?: 'asc' | 'desc',
): Prisma.ListingOrderByWithRelationInput[] {
  const dir = order === 'asc' ? 'asc' : 'desc';
  const nullable = (
    field: 'applyEndAt' | 'applyStartAt' | 'resultAnnounceAt' | 'publishedAt' | 'position',
  ): Prisma.ListingOrderByWithRelationInput[] => [
    { [field]: { sort: dir, nulls: 'last' } },
    { id: 'asc' },
  ];
  switch (sort) {
    case 'createdAt':
      return [{ createdAt: dir }, { id: 'asc' }];
    case 'updatedAt':
      return [{ updatedAt: dir }, { id: 'asc' }];
    case 'title':
      return [{ title: dir }, { id: 'asc' }];
    case 'applyEndAt':
      return nullable('applyEndAt');
    case 'applyStartAt':
      return nullable('applyStartAt');
    case 'resultAnnounceAt':
      return nullable('resultAnnounceAt');
    case 'publishedAt':
      return nullable('publishedAt');
    case 'position':
      return nullable('position');
    case 'institution':
      return [{ institution: { name: dir } }, { id: 'asc' }];
    default:
      return [{ applyEndAt: 'asc' }, { updatedAt: 'desc' }];
  }
}

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
    userId?: string;
    createdFrom?: string;
    createdTo?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 200);
    const where = listingWhere(params);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        include: {
          ...listingInclude,
          ...(params.userId
            ? {
                userListings: {
                  where: { userId: params.userId },
                  take: 1,
                },
              }
            : {}),
        },
        orderBy: listingOrder(params.sort, params.order),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    const mapped = items.map((item) => {
      const { userListings, ...rest } = item as typeof item & {
        userListings?: Array<{
          id: string;
          status: string;
          applyChannel: string | null;
          mailOk: boolean;
          formOk: boolean;
          updatedFlag: boolean;
        }>;
      };
      const mine = userListings?.[0];
      return {
        ...rest,
        myTracking: mine
          ? {
              id: mine.id,
              status: mine.status,
              applyChannel: mine.applyChannel,
              mailOk: mine.mailOk,
              formOk: mine.formOk,
              updatedFlag: mine.updatedFlag,
            }
          : null,
      };
    });

    return { items: mapped, total, page, limit };
  }

  async get(id: string, userId?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        ...listingInclude,
        revisions: { orderBy: { version: 'desc' }, take: 10 },
        ...(userId
          ? { userListings: { where: { userId }, take: 1 } }
          : {}),
      },
    });
    if (!listing) throw new NotFoundException('İlan bulunamadı');
    const { userListings, ...rest } = listing as typeof listing & {
      userListings?: Array<{
        id: string;
        status: string;
        notes: string | null;
        applyChannel: string | null;
        mailOk: boolean;
        formOk: boolean;
        updatedFlag: boolean;
      }>;
    };
    const mine = userListings?.[0];
    return {
      ...rest,
      myTracking: mine
        ? {
            id: mine.id,
            status: mine.status,
            notes: mine.notes,
            applyChannel: mine.applyChannel,
            mailOk: mine.mailOk,
            formOk: mine.formOk,
            updatedFlag: mine.updatedFlag,
          }
        : null,
    };
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
    ]);

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        institutionId,
        title,
        titleNorm: normalizeText(title),
        position,
        positionNorm: position ? normalizeText(position) : null,
        externalKey: input.externalKey ?? existing.externalKey,
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
        examAt: input.examAt === undefined ? existing.examAt : input.examAt,
        resultAnnounceAt:
          input.resultAnnounceAt === undefined
            ? existing.resultAnnounceAt
            : input.resultAnnounceAt,
        applicationPlace: input.applicationPlace ?? existing.applicationPlace,
        applicationMethods: input.applicationMethods ?? existing.applicationMethods,
        requiredDocuments: input.requiredDocuments ?? existing.requiredDocuments,
        generalRequirements: input.generalRequirements ?? existing.generalRequirements,
        specialRequirements: input.specialRequirements ?? existing.specialRequirements,
        examTopics: input.examTopics ?? existing.examTopics,
        evaluationNotes: input.evaluationNotes ?? existing.evaluationNotes,
        requiredSkills: input.requiredSkills ?? existing.requiredSkills,
        kind: input.kind ?? existing.kind,
        status: input.status ?? existing.status,
        fingerprint,
        version: { increment: 1 },
      },
      include: listingInclude,
    });

    if (input.positions) {
      await this.replacePositions(id, input.positions);
    }

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

    return this.get(id);
  }

  async upsertFromSource(input: UpsertListingInput) {
    const { listing } = await this.upsertFromSourceMeta(input);
    return listing;
  }

  /** Same as upsertFromSource but reports whether a new row was created. */
  async upsertFromSourceMeta(input: UpsertListingInput) {
    let institutionId = input.institutionId;
    if (!institutionId && input.institutionName) {
      const found = await this.institutions.resolveByName(input.institutionName);
      if (found) {
        institutionId = found.id;
      } else {
        const createdInst = await this.institutions.create({
          name: input.institutionName,
          city: input.city,
        });
        institutionId = createdInst.id;
      }
    }

    if (input.externalKey) {
      const byExternal = await this.prisma.listing.findUnique({
        where: {
          source_externalKey: { source: input.source, externalKey: input.externalKey },
        },
      });
      if (byExternal) {
        const listing = await this.update(byExternal.id, { ...input, institutionId });
        return { listing, created: false };
      }
    }

    // Content twin (same org+title+source) — ignore volatile ?kod= URLs
    const titleNorm = normalizeText(input.title);
    const byContent = await this.prisma.listing.findFirst({
      where: {
        source: input.source,
        titleNorm,
        institutionId: institutionId ?? undefined,
        status: ListingStatus.OPEN,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (byContent) {
      const listing = await this.update(byContent.id, {
        ...input,
        institutionId,
        externalKey: input.externalKey ?? byContent.externalKey ?? undefined,
      });
      return { listing, created: false };
    }

    // Fingerprint without volatile externalKey so carousel URL variants collapse
    const fingerprint = buildFingerprint([
      institutionId ?? input.institutionName,
      input.title,
      input.position,
      input.source,
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
        const listing = await this.createNew({
          ...input,
          institutionId,
          fingerprint: buildFingerprint([
            institutionId ?? input.institutionName,
            input.title,
            input.position,
            input.source,
            input.applyStartAt?.toISOString(),
          ]),
          listingGroupId: existing.listingGroupId ?? existing.id,
        });
        return { listing, created: true };
      }

      const listing = await this.update(existing.id, { ...input, institutionId });
      return { listing, created: false };
    }

    const similar = await this.prisma.listing.findFirst({
      where: {
        institutionId: institutionId ?? undefined,
        titleNorm,
        status: ListingStatus.OPEN,
        NOT: { source: input.source },
      },
    });

    const listing = await this.createNew({
      ...input,
      institutionId,
      fingerprint,
      possibleDup: Boolean(similar),
      listingGroupId: similar?.listingGroupId ?? similar?.id,
    });
    return { listing, created: true };
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
          examAt: input.examAt ?? undefined,
          resultAnnounceAt: input.resultAnnounceAt ?? undefined,
          applicationPlace: input.applicationPlace,
          applicationMethods: input.applicationMethods ?? [],
          requiredDocuments: input.requiredDocuments ?? [],
          generalRequirements: input.generalRequirements,
          specialRequirements: input.specialRequirements,
          examTopics: input.examTopics,
          evaluationNotes: input.evaluationNotes,
          externalKey: input.externalKey,
          fingerprint: input.fingerprint,
          possibleDup: input.possibleDup ?? false,
          listingGroupId: input.listingGroupId,
          requiredSkills: input.requiredSkills ?? [],
        },
        include: listingInclude,
      });

      if (input.positions?.length) {
        await this.replacePositions(created.id, input.positions);
      }

      await this.prisma.listingRevision.create({
        data: {
          listingId: created.id,
          version: 1,
          snapshot: created as unknown as Prisma.InputJsonValue,
        },
      });

      return this.get(created.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Aynı fingerprint veya external key ile ilan zaten var');
      }
      throw err;
    }
  }

  private async replacePositions(listingId: string, positions: ParsedPosition[]) {
    await this.prisma.listingPosition.deleteMany({ where: { listingId } });
    if (!positions.length) return;
    await this.prisma.listingPosition.createMany({
      data: positions.map((p, i) => ({
        listingId,
        sequenceNo: p.sequenceNo ?? i + 1,
        title: p.title,
        titleNorm: normalizeText(p.title),
        serviceClass: p.serviceClass,
        grade: p.grade,
        quota: p.quota,
        educationRequirement: p.educationRequirement,
        gender: p.gender,
        kpssScoreType: p.kpssScoreType,
        kpssMinScore: p.kpssMinScore,
        skillsTags: p.skillsTags ?? [],
      })),
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.listing.delete({ where: { id } });
    return { ok: true };
  }

  async bulk(input: {
    action: 'delete' | 'close';
    ids?: string[];
    allMatching?: boolean;
    kind?: ListingKind;
    status?: ListingStatus;
    source?: ListingSource;
    q?: string;
    createdFrom?: string;
    createdTo?: string;
  }) {
    if (!input.allMatching && !input.ids?.length) {
      throw new BadRequestException('İlan seçin veya filtredeki tümünü kullanın');
    }
    const where: Prisma.ListingWhereInput = input.allMatching
      ? listingWhere(input)
      : { id: { in: input.ids ?? [] }, ...(input.kind ? { kind: input.kind } : {}) };

    if (input.action === 'close') {
      const result = await this.prisma.listing.updateMany({
        where,
        data: { status: ListingStatus.CLOSED },
      });
      return { ok: true, count: result.count };
    }

    const result = await this.prisma.listing.deleteMany({ where });
    return { ok: true, count: result.count };
  }
}
