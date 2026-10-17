import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { toPublicUser } from '../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(toPublicUser);
  }

  async create(data: {
    email: string;
    password: string;
    fullName: string;
    role?: Role;
  }) {
    const exists = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('E-posta kullanımda');

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        fullName: data.fullName,
        role: data.role ?? Role.USER,
        passwordHash: await bcrypt.hash(data.password, 10),
        profile: { create: {} },
      },
    });
    return toPublicUser(user);
  }

  async setActive(id: string, isActive: boolean) {
    try {
      const user = await this.prisma.user.update({ where: { id }, data: { isActive } });
      return toPublicUser(user);
    } catch {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
  }
}
