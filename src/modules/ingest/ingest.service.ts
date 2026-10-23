import { Injectable } from '@nestjs/common';
import { IlanGovAdapter } from './ilan-gov.adapter';
import { KamuilanAdapter, type IngestSourceResult } from './kamuilan.adapter';
import { YerelYonetimlerAdapter } from './yerel-yonetimler.adapter';

export type IngestReport = {
  sources: IngestSourceResult[];
  totalUpserted: number;
  totalCreated: number;
  totalUpdated: number;
  totalRaw: number;
  ok: boolean;
  summary: string;
};

export type IngestJob = {
  running: boolean;
  requested: string | null;
  current: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  completed: IngestSourceResult[];
  report: IngestReport | null;
  error: string | null;
};

const idleJob = (): IngestJob => ({
  running: false,
  requested: null,
  current: null,
  startedAt: null,
  finishedAt: null,
  completed: [],
  report: null,
  error: null,
});

@Injectable()
export class IngestService {
  private job: IngestJob = idleJob();

  constructor(
    private readonly ilanGov: IlanGovAdapter,
    private readonly kamuilan: KamuilanAdapter,
    private readonly yerel: YerelYonetimlerAdapter,
  ) {}

  status(): IngestJob {
    return this.job;
  }

  /** Returns immediately. A full scan can take several minutes and must not block other requests. */
  start(source?: string): { started: boolean; job: IngestJob } {
    if (this.job.running) {
      return { started: false, job: this.job };
    }
    this.job = {
      running: true,
      requested: source ?? 'ALL',
      current: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      completed: [],
      report: null,
      error: null,
    };
    void this.execute(source);
    return { started: true, job: this.job };
  }

  private async execute(source?: string) {
    try {
      const report = await this.run(source);
      this.job = {
        ...this.job,
        running: false,
        current: null,
        finishedAt: new Date().toISOString(),
        report,
        error: null,
      };
    } catch (err) {
      this.job = {
        ...this.job,
        running: false,
        current: null,
        finishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async run(source?: string) {
    const sources: IngestSourceResult[] = [];
    const all = !source;

    if (all || source === 'ILAN_GOV') {
      this.job = { ...this.job, current: 'ILAN_GOV' };
      sources.push(await this.ilanGov.fetchPersonnelAds());
      this.noteCompleted(sources[sources.length - 1]);
    }
    if (all || source === 'KAMUILAN') {
      this.job = { ...this.job, current: 'KAMUILAN' };
      sources.push(await this.kamuilan.fetchActiveAds());
      this.noteCompleted(sources[sources.length - 1]);
    }
    if (all || source === 'YEREL_YONETIMLER') {
      this.job = { ...this.job, current: 'YEREL_YONETIMLER' };
      sources.push(await this.yerel.fetchAnnouncements());
      this.noteCompleted(sources[sources.length - 1]);
    }
    if (
      source &&
      sources.length === 0 &&
      !['ILAN_GOV', 'KAMUILAN', 'YEREL_YONETIMLER'].includes(source)
    ) {
      sources.push({
        source,
        upserted: 0,
        rawCount: 0,
        error: 'Bu kaynak için otomatik adapter yok',
        hint: 'Paste-parse veya manuel kayıt kullanın',
      });
    }

    const totalUpserted = sources.reduce((n, s) => n + s.upserted, 0);
    const totalCreated = sources.reduce((n, s) => n + (s.created ?? 0), 0);
    const totalUpdated = sources.reduce((n, s) => n + (s.updated ?? 0), 0);
    const totalRaw = sources.reduce((n, s) => n + s.rawCount, 0);
    const failed = sources.filter((s) => s.upserted === 0 && (s.error || s.rawCount === 0));

    return {
      sources,
      totalUpserted,
      totalCreated,
      totalUpdated,
      totalRaw,
      ok: totalUpserted > 0,
      summary:
        totalUpserted > 0
          ? `${totalCreated} yeni · ${totalUpdated} güncellendi (ham ${totalRaw})`
          : failed.length
            ? `Çekilemedi: ${failed.map((f) => f.source).join(', ')}`
            : 'Kayıt yok',
    };
  }

  private noteCompleted(result: IngestSourceResult | undefined) {
    if (!result || !this.job.running) return;
    this.job = { ...this.job, completed: [...this.job.completed, result] };
  }
}
