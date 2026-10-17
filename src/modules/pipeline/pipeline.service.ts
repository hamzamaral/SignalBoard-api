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

  list(userId: string) {
    return this.prisma.userListing.findMany({
      where: { userId },
      include: { listing: { include: { institution: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async track(userId: string, listingId: string, status?: PipelineStatus) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('İlan bulunamadı');

    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const matchScore = profile ? this.matching.score(profile, listing).score : null;

    const row = await this.prisma.userListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: {
        userId,
        listingId,
        status: status ?? PipelineStatus.REVIEW,
        matchScore,
      },
      update: {
        status: status ?? undefined,
        matchScore: matchScore ?? undefined,
        updatedFlag: false,
      },
      include: { listing: true },
    });

    await this.reminders.ensureDeadlineReminders(userId, listingId);
    return row;
  }

  async updateStatus(userId: string, id: string, status: PipelineStatus, notes?: string) {
    const row = await this.prisma.userListing.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Kayıt bulunamadı');
    return this.prisma.userListing.update({
      where: { id },
      data: { status, notes, updatedFlag: false },
      include: { listing: true },
    });
  }
}
