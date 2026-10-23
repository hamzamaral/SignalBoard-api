import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EnvConfig } from '../../config/env.validation';
import { SettingsService } from '../settings/settings.service';
import { ParsedListingFields } from './parsed-types';

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

    const prompt = `Aşağıdaki ilan metninden SADECE JSON çıkar. Kamu ilanı da olabilir, Kariyer.net gibi özel sektör sayfası da.
Firma, ilan başlığının hemen altındaki şirket adıdır (A.Ş., Ltd.). Pozisyon o başlıktır; ayrı bir meslek satırı varsa (ör. Yapay Zeka Programcısı) position odur.
Menü satırlarını (İş İlanları, Hesabım, Ana Sayfa) başlık veya pozisyon sanma.
Sayfa sonundaki İşkur / Özel İstihdam Bürosu cümlesi firma değildir. "faaliyette bulunmak üzere" tarih aralığı başvuru tarihi değildir.
Şehir, İstanbul(Asya) gibi konum satırıdır; İl Müdürlüğü satırından şehir uydurma.
Anahtarlar:
institutionName, title, position, city, url,
applyStartAt, applyEndAt, examAt, resultAnnounceAt (ISO tarih; yoksa null),
applicationPlace, applicationMethods (string[]: elektronik|sahsen|posta),
requiredDocuments (string[]), generalRequirements, specialRequirements,
examTopics, evaluationNotes,
positions: [{ sequenceNo, title, serviceClass, grade, quota, educationRequirement, gender, kpssScoreType, kpssMinScore }]

Metin:
"""
${text.slice(0, 12000)}
"""`;

    try {
      if (llm.provider === 'OLLAMA') {
        const base = this.config.get('OLLAMA_BASE_URL', { infer: true });
        const res = await axios.post(
          `${base}/api/generate`,
          { model: llm.model || 'llama3.2', prompt, stream: false, format: 'json' },
          { timeout: 90_000 },
        );
        return JSON.parse(res.data.response) as ParsedListingFields;
      }

      if (llm.provider === 'GEMINI' && llm.apiKey) {
        const model = llm.model || 'gemini-1.5-flash';
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llm.apiKey}`,
          { contents: [{ parts: [{ text: prompt }] }] },
          { timeout: 90_000 },
        );
        const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
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
            timeout: 90_000,
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
