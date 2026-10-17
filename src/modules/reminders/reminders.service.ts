import { Injectable, NotFoundException } from '@nestjs/common';
import ical, { ICalCalendarMethod } from 'ical-generator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.reminder.findMany({
      where: { userId, completedAt: null },
      include: { listing: { include: { institution: true } } },
      orderBy: { remindAt: 'asc' },
    });
  }

  create(
    userId: string,
    data: { title: string; remindAt: Date; note?: string; listingId?: string },
  ) {
    return this.prisma.reminder.create({
      data: {
        userId,
        title: data.title,
        remindAt: data.remindAt,
        note: data.note,
        listingId: data.listingId,
      },
    });
  }

  async complete(userId: string, id: string) {
    const row = await this.prisma.reminder.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Hatırlatıcı bulunamadı');
    return this.prisma.reminder.update({
      where: { id },
      data: { completedAt: new Date() },
    });
  }

  /** İleri tarihli başvuru bitişleri için otomatik hatırlatıcılar (14/7/3/1 gün). */
  async ensureDeadlineReminders(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing?.applyEndAt) return [];

    const offsets = [14, 7, 3, 1];
    const created = [];
    for (const days of offsets) {
      const remindAt = new Date(listing.applyEndAt.getTime() - days * 24 * 60 * 60 * 1000);
      if (remindAt <= new Date()) continue;
      const title = `Son ${days} gün: ${listing.title}`;
      const existing = await this.prisma.reminder.findFirst({
        where: { userId, listingId, title },
      });
      if (existing) continue;
      created.push(
        await this.create(userId, {
          title,
          remindAt,
          listingId,
          note: `Başvuru bitiş: ${listing.applyEndAt.toISOString()}`,
        }),
      );
    }
    return created;
  }

  async exportIcs(userId: string): Promise<string> {
    const reminders = await this.list(userId);
    const calendar = ical({ name: 'SignalBoard Reminders', method: ICalCalendarMethod.PUBLISH });
    for (const r of reminders) {
      calendar.createEvent({
        start: r.remindAt,
        end: new Date(r.remindAt.getTime() + 60 * 60 * 1000),
        summary: r.title,
        description: r.note ?? undefined,
        url: r.listing?.url ?? undefined,
      });
    }
    return calendar.toString();
  }
}
