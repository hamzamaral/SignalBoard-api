import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async update(
    userId: string,
    data: {
      education?: string;
      preferredCity?: string;
      kpssScores?: Record<string, number>;
      certificates?: string[];
      skills?: string[];
      targetTitles?: string[];
      emailAlerts?: boolean;
    },
  ) {
    await this.get(userId);
    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        education: data.education,
        preferredCity: data.preferredCity,
        kpssScores: data.kpssScores as Prisma.InputJsonValue | undefined,
        certificates: data.certificates,
        skills: data.skills,
        targetTitles: data.targetTitles,
        emailAlerts: data.emailAlerts,
      },
    });
  }
}
