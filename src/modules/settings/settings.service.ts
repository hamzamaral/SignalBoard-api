import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';

const SMTP_KEY = 'smtp';
const LLM_KEY = 'llm';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type LlmConfig = {
  provider: 'NONE' | 'OLLAMA' | 'GEMINI' | 'GROQ';
  apiKey?: string;
  model?: string;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async getSmtpConfig(): Promise<SmtpConfig | null> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: SMTP_KEY } });
    if (!row) return null;
    const value = row.value as SmtpConfig & { passEnc?: string };
    if (value.passEnc) {
      return { ...value, pass: this.decrypt(value.passEnc) };
    }
    return value;
  }

  async setSmtpConfig(input: SmtpConfig) {
    const stored = {
      host: input.host,
      port: input.port,
      secure: input.secure,
      user: input.user,
      from: input.from,
      passEnc: this.encrypt(input.pass),
    };
    await this.prisma.systemSetting.upsert({
      where: { key: SMTP_KEY },
      create: { key: SMTP_KEY, value: stored as unknown as Prisma.InputJsonValue },
      update: { value: stored as unknown as Prisma.InputJsonValue },
    });
    return { ok: true, host: input.host, from: input.from };
  }

  async getLlmConfig(): Promise<LlmConfig> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: LLM_KEY } });
    if (!row) {
      return { provider: 'OLLAMA', model: 'llama3.2' };
    }
    const value = row.value as LlmConfig & { apiKeyEnc?: string };
    return {
      provider: value.provider || 'OLLAMA',
      model: value.model,
      apiKey: value.apiKeyEnc ? this.decrypt(value.apiKeyEnc) : value.apiKey,
    };
  }

  async setLlmConfig(input: LlmConfig) {
    const stored = {
      provider: input.provider,
      model: input.model,
      apiKeyEnc: input.apiKey ? this.encrypt(input.apiKey) : undefined,
    };
    await this.prisma.systemSetting.upsert({
      where: { key: LLM_KEY },
      create: { key: LLM_KEY, value: stored as unknown as Prisma.InputJsonValue },
      update: { value: stored as unknown as Prisma.InputJsonValue },
    });
    return { ok: true, provider: input.provider, model: input.model };
  }

  async getPublicSettings() {
    const smtp = await this.getSmtpConfig();
    const llm = await this.getLlmConfig();
    return {
      smtpConfigured: Boolean(smtp?.host),
      smtpFrom: smtp?.from ?? null,
      llm: { provider: llm.provider, model: llm.model, hasApiKey: Boolean(llm.apiKey) },
    };
  }

  private keyBytes() {
    return createHash('sha256')
      .update(this.config.get('SETTINGS_ENCRYPTION_KEY', { infer: true }))
      .digest();
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keyBytes(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  private decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.keyBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
