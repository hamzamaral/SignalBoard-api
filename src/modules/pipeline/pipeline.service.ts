import { Injectable, NotFoundException } from '@nestjs/common';
import { PipelineStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { RemindersService } from '../reminders/reminders.service';

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

  async track(
    userId: string,
    listingId: string,
    status?: PipelineStatus,
    positionId?: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { positions: true },
    });
    if (!listing) throw new NotFoundException('İlan bulunamadı');

    if (positionId) {
      const ok = listing.positions.some((p) => p.id === positionId);
      if (!ok) throw new NotFoundException('Kadro bulunamadı');
    }

    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const position = positionId
      ? listing.positions.find((p) => p.id === positionId) ?? null
      : null;
    const matchScore = profile
      ? this.matching.scorePosition(profile, listing, position).score
      : null;

    const row = await this.prisma.userListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: {
        userId,
        listingId,
        positionId: positionId ?? null,
        status: status ?? PipelineStatus.REVIEW,
        matchScore,
      },
      update: {
        status: status ?? undefined,
        positionId: positionId ?? undefined,
        matchScore: matchScore ?? undefined,
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

  async updateStatus(
    userId: string,
    id: string,
    status: PipelineStatus,
    notes?: string,
    positionId?: string,
  ) {
    const row = await this.prisma.userListing.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Kayıt bulunamadı');
    return this.prisma.userListing.update({
      where: { id },
      data: {
        status,
        notes,
        positionId: positionId ?? undefined,
        updatedFlag: false,
      },
      include: {
        listing: { include: { institution: true, positions: true } },
        position: true,
      },
    });
  }
}
