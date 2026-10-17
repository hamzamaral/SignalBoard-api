import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EnvConfig } from '../../config/env.validation';
import { SettingsService } from '../settings/settings.service';

export type ParsedListingFields = {
  institutionName?: string;
  title?: string;
  position?: string;
  city?: string;
  educationLevel?: string;
  kpssScoreType?: string;
  kpssMinScore?: number;
  quota?: number;
  applyStartAt?: string;
  applyEndAt?: string;
  resultAt?: string;
  url?: string;
  requiredSkills?: string[];
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async parseListingText(text: string): Promise<ParsedListingFields | null> {
    const llm = await this.settings.getLlmConfig();
    if (llm.provider === 'NONE') return null;

    const prompt = `Aşağıdaki Türkçe kamu personel ilan metninden JSON çıkar.
Sadece JSON döndür. Anahtarlar: institutionName, title, position, city, educationLevel, kpssScoreType, kpssMinScore, quota, applyStartAt (ISO), applyEndAt (ISO), resultAt (ISO), url, requiredSkills (string[]).

Metin:
"""
${text.slice(0, 8000)}
"""`;

    try {
      if (llm.provider === 'OLLAMA') {
        const base = this.config.get('OLLAMA_BASE_URL', { infer: true });
        const res = await axios.post(
          `${base}/api/generate`,
          {
            model: llm.model || 'llama3.2',
            prompt,
            stream: false,
            format: 'json',
          },
          { timeout: 60_000 },
        );
        return JSON.parse(res.data.response) as ParsedListingFields;
      }

      if (llm.provider === 'GEMINI' && llm.apiKey) {
        const model = llm.model || 'gemini-1.5-flash';
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llm.apiKey}`,
          { contents: [{ parts: [{ text: prompt }] }] },
          { timeout: 60_000 },
        );
        const raw =
          res.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
          '{}';
        return JSON.parse(stripFences(raw)) as ParsedListingFields;
      }

      if (llm.provider === 'GROQ' && llm.apiKey) {
        const res = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: llm.model || 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          },
          {
            headers: { Authorization: `Bearer ${llm.apiKey}` },
            timeout: 60_000,
          },
        );
        return JSON.parse(res.data.choices[0].message.content) as ParsedListingFields;
      }
    } catch (err) {
      this.logger.warn(`LLM parse failed: ${err instanceof Error ? err.message : err}`);
    }
    return null;
  }
}

function stripFences(s: string): string {
  return s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}
