import { Injectable } from '@nestjs/common';
import { Listing, UserProfile } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeText } from '../../common/utils/normalize';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  score(profile: UserProfile, listing: Listing): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const kpss = (profile.kpssScores ?? {}) as Record<string, number>;

    if (listing.kpssScoreType && kpss[listing.kpssScoreType] != null) {
      const userScore = Number(kpss[listing.kpssScoreType]);
      const min = listing.kpssMinScore ? Number(listing.kpssMinScore) : null;
      if (min == null || userScore >= min) {
        score += 40;
        reasons.push(`KPSS ${listing.kpssScoreType}=${userScore} uygun`);
      } else {
        reasons.push(`KPSS ${listing.kpssScoreType} yetersiz (${userScore}<${min})`);
      }
    } else if (!listing.kpssScoreType) {
      score += 10;
    }

    if (profile.preferredCity && listing.city) {
      if (normalizeText(profile.preferredCity) === normalizeText(listing.city)) {
        score += 20;
        reasons.push(`Şehir eşleşmesi: ${listing.city}`);
      }
    }

    if (profile.education && listing.educationLevel) {
      if (
        normalizeText(profile.education).includes(normalizeText(listing.educationLevel)) ||
        normalizeText(listing.educationLevel).includes(normalizeText(profile.education))
      ) {
        score += 15;
        reasons.push('Öğrenim uyumu');
      }
    }

    const hay = normalizeText(
      `${listing.title} ${listing.position ?? ''} ${listing.description ?? ''}`,
    );
    let skillHits = 0;
    for (const skill of profile.skills) {
      if (hay.includes(normalizeText(skill))) skillHits += 1;
    }
    for (const cert of profile.certificates) {
      if (hay.includes(normalizeText(cert))) {
        skillHits += 1;
        reasons.push(`Sertifika geçiyor: ${cert}`);
      }
    }
    if (skillHits) {
      score += Math.min(25, skillHits * 8);
      reasons.push(`${skillHits} yetkinlik/sertifika eşleşmesi`);
    }

    for (const t of profile.targetTitles) {
      if (hay.includes(normalizeText(t))) {
        score += 10;
        reasons.push(`Hedef unvan: ${t}`);
        break;
      }
    }

    return { score: Math.min(100, score), reasons };
  }

  async recommendationsForUser(userId: string, limit = 20) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return { items: [], profileMissing: true };

    const listings = await this.prisma.listing.findMany({
      where: { status: 'OPEN', kind: 'PUBLIC' },
      include: { institution: true },
      take: 200,
      orderBy: { applyEndAt: 'asc' },
    });

    const ranked = listings
      .map((listing) => {
        const { score, reasons } = this.score(profile, listing);
        return { listing, score, reasons };
      })
      .filter((x) => x.score >= 25)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { items: ranked, profileMissing: false };
  }

  async notifyMatchesForListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'OPEN') return { notified: 0 };

    const profiles = await this.prisma.userProfile.findMany({
      where: { emailAlerts: true },
      include: { user: true },
    });

    let notified = 0;
    for (const profile of profiles) {
      const { score, reasons } = this.score(profile, listing);
      if (score < 40) continue;
      await this.notifications.enqueueEmail(
        profile.userId,
        `Profiline uygun ilan: ${listing.title}`,
        `Merhaba ${profile.user.fullName},\n\nSkor: ${score}\n${reasons.join('\n')}\n\n${listing.url ?? ''}`,
        { listingId, score },
      );
      notified += 1;
    }
    return { notified };
  }
}
