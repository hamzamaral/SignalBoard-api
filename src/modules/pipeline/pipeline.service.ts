import { Injectable, NotFoundException } from '@nestjs/common';
import { PipelineStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { RemindersService } from '../reminders/reminders.service';

type TrackFields = {
  status?: PipelineStatus;
  positionId?: string;
  applyChannel?: string;
  mailOk?: boolean;
  formOk?: boolean;
  notes?: string;
};

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly reminders: RemindersService,
  ) {}

  list(userId: string, status?: PipelineStatus) {
    return this.prisma.userListing.findMany({
      where: { userId, status: status || undefined },
      include: {
        listing: {
          include: {
            institution: true,
            positions: { orderBy: { sequenceNo: 'asc' } },
          },
        },
        position: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async track(userId: string, listingId: string, fields: TrackFields = {}) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { positions: true },
    });
    if (!listing) throw new NotFoundException('İlan bulunamadı');

    if (fields.positionId) {
      const ok = listing.positions.some((p) => p.id === fields.positionId);
      if (!ok) throw new NotFoundException('Kadro bulunamadı');
    }

    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const position = fields.positionId
      ? listing.positions.find((p) => p.id === fields.positionId) ?? null
      : null;
    const matchScore = profile
      ? this.matching.scorePosition(profile, listing, position).score
      : null;

    const row = await this.prisma.userListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: {
        userId,
        listingId,
        positionId: fields.positionId ?? null,
        status: fields.status ?? PipelineStatus.REVIEW,
        matchScore,
        applyChannel: fields.applyChannel ?? null,
        mailOk: fields.mailOk ?? false,
        formOk: fields.formOk ?? false,
      },
      update: {
        status: fields.status ?? undefined,
        positionId: fields.positionId ?? undefined,
        matchScore: matchScore ?? undefined,
        applyChannel: fields.applyChannel ?? undefined,
        mailOk: fields.mailOk ?? undefined,
        formOk: fields.formOk ?? undefined,
        updatedFlag: false,
      },
      include: {
        listing: { include: { institution: true, positions: true } },
        position: true,
      },
    });

    await this.reminders.ensureDeadlineReminders(userId, listingId);
    return row;
  }

  async updateStatus(userId: string, id: string, fields: TrackFields) {
    const row = await this.prisma.userListing.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Kayıt bulunamadı');
    return this.prisma.userListing.update({
      where: { id },
      data: {
        status: fields.status ?? undefined,
        notes: fields.notes,
        positionId: fields.positionId ?? undefined,
        applyChannel: fields.applyChannel ?? undefined,
        mailOk: fields.mailOk ?? undefined,
        formOk: fields.formOk ?? undefined,
        updatedFlag: false,
      },
      include: {
        listing: { include: { institution: true, positions: true } },
        position: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.userListing.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Kayıt bulunamadı');
    await this.prisma.userListing.delete({ where: { id } });
    return { ok: true };
  }
}
