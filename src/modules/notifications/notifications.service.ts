import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  enqueueEmail(userId: string, subject: string, body: string, meta?: Record<string, unknown>) {
    return this.prisma.notificationOutbox.create({
      data: {
        userId,
        subject,
        body,
        meta: (meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async processPending(limit = 20) {
    const pending = await this.prisma.notificationOutbox.findMany({
      where: { status: NotificationStatus.PENDING },
      include: { user: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const smtp = await this.settings.getSmtpConfig();
    if (!smtp?.host) {
      this.logger.warn('SMTP not configured; leaving notifications pending');
      return {
        processed: 0,
        skipped: pending.length,
        pending: pending.length,
        ok: false,
        message:
          pending.length === 0
            ? 'Kuyruk boş. SMTP ayarlanmamış; bildirim yok.'
            : `${pending.length} mail bekliyor ama SMTP yapılandırılmamış. Admin → SMTP kaydedin.`,
      };
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });

    let processed = 0;
    for (const item of pending) {
      try {
        await transporter.sendMail({
          from: smtp.from,
          to: item.user.email,
          subject: item.subject,
          text: item.body,
        });
        await this.prisma.notificationOutbox.update({
          where: { id: item.id },
          data: { status: NotificationStatus.SENT, sentAt: new Date(), error: null },
        });
        processed += 1;
      } catch (err) {
        await this.prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: NotificationStatus.FAILED,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
    return {
      processed,
      skipped: 0,
      pending: pending.length,
      ok: processed > 0,
      message:
        processed > 0
          ? `${processed} mail gönderildi`
          : pending.length === 0
            ? 'Kuyruk boş — gönderilecek mail yok.'
            : 'Gönderim başarısız; SMTP / alıcıyı kontrol edin.',
    };
  }
}
