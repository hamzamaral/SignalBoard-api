import { Injectable } from '@nestjs/common';
import { Listing, ListingPosition, UserProfile } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeText } from '../../common/utils/normalize';

type ListingWithPositions = Listing & { positions?: ListingPosition[] };

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  scorePosition(
    profile: UserProfile,
    listing: Listing,
    position?: ListingPosition | null,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const kpss = (profile.kpssScores ?? {}) as Record<string, number>;

    const kpssType = position?.kpssScoreType || listing.kpssScoreType;
    const kpssMin = position?.kpssMinScore ?? listing.kpssMinScore;

    if (kpssType && kpss[kpssType] != null) {
      const userScore = Number(kpss[kpssType]);
      const min = kpssMin != null ? Number(kpssMin) : null;
      if (min == null || userScore >= min) {
        score += 40;
        reasons.push(`KPSS ${kpssType}=${userScore} uygun`);
      } else {
        reasons.push(`KPSS ${kpssType} yetersiz (${userScore}<${min})`);
      }
    } else if (!kpssType) {
      score += 10;
    }

    if (profile.preferredCity && listing.city) {
      if (normalizeText(profile.preferredCity) === normalizeText(listing.city)) {
        score += 20;
        reasons.push(`Şehir eşleşmesi: ${listing.city}`);
      }
    }

    const eduReq = position?.educationRequirement || listing.educationLevel;
    if (profile.education && eduReq) {
      if (
        normalizeText(eduReq).includes(normalizeText(profile.education)) ||
        normalizeText(profile.education).includes('lisans')
      ) {
        score += 15;
        reasons.push('Öğrenim uyumu');
      }
    }

    const hay = normalizeText(
      `${listing.title} ${position?.title ?? listing.position ?? ''} ${position?.educationRequirement ?? ''} ${listing.description ?? ''}`,
    );
    let skillHits = 0;
    for (const skill of [...profile.skills, ...(position?.skillsTags ?? [])]) {
      if (hay.includes(normalizeText(skill)) && profile.skills.some((s) => normalizeText(s) === normalizeText(skill))) {
        skillHits += 1;
      }
    }
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

    const titleHay = normalizeText(position?.title ?? listing.position ?? listing.title);
    for (const t of profile.targetTitles) {
      if (titleHay.includes(normalizeText(t)) || hay.includes(normalizeText(t))) {
        score += 10;
        reasons.push(`Hedef unvan: ${t}`);
        break;
      }
    }

    return { score: Math.min(100, score), reasons };
  }

  /** Listing-level score = best position (or listing fields). */
  score(profile: UserProfile, listing: ListingWithPositions): { score: number; reasons: string[]; bestPositionId?: string } {
    const positions = listing.positions ?? [];
    if (!positions.length) {
      const r = this.scorePosition(profile, listing, null);
      return r;
    }
    let best = { score: -1, reasons: [] as string[], bestPositionId: undefined as string | undefined };
    for (const p of positions) {
      const r = this.scorePosition(profile, listing, p);
      if (r.score > best.score) {
        best = { ...r, bestPositionId: p.id };
      }
    }
    return best;
  }

  async recommendationsForUser(userId: string, limit = 20) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return { items: [], profileMissing: true };

    const listings = await this.prisma.listing.findMany({
      where: { status: 'OPEN', kind: 'PUBLIC' },
      include: { institution: true, positions: { orderBy: { sequenceNo: 'asc' } } },
      take: 200,
      orderBy: { applyEndAt: 'asc' },
    });

    const ranked = listings
      .map((listing) => {
        const { score, reasons, bestPositionId } = this.score(profile, listing);
        const bestPosition = listing.positions.find((p) => p.id === bestPositionId) ?? null;
        return { listing, score, reasons, bestPosition };
      })
      .filter((x) => x.score >= 25)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { items: ranked, profileMissing: false };
  }

  async notifyMatchesForListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { positions: true },
    });
    if (!listing || listing.status !== 'OPEN') return { notified: 0 };

    const profiles = await this.prisma.userProfile.findMany({
      where: { emailAlerts: true },
      include: { user: true },
    });

    let notified = 0;
    for (const profile of profiles) {
      const { score, reasons, bestPositionId } = this.score(profile, listing);
      if (score < 40) continue;
      const pos = listing.positions.find((p) => p.id === bestPositionId);
      await this.notifications.enqueueEmail(
        profile.userId,
        `Profiline uygun ilan: ${listing.title}`,
        `Merhaba ${profile.user.fullName},\n\nSkor: ${score}${pos ? `\nKadro: ${pos.title}` : ''}\n${reasons.join('\n')}\n\n${listing.url ?? ''}`,
        { listingId, score, positionId: bestPositionId },
      );
      notified += 1;
    }
    return { notified };
  }
}
