import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.validation';
import { seedDatabase } from './seed-data';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('SEED_ON_EMPTY', { infer: true })) {
      return;
    }
    const count = await this.prisma.user.count();
    if (count > 0) {
      this.logger.log('Database already has users; skipping seed');
      return;
    }
    this.logger.log('Empty database detected; seeding demo data...');
    await seedDatabase(this.prisma);
    this.logger.log('Seed completed');
  }
}
