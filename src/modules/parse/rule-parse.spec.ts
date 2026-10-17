import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanExamTopics, extractPositions, mergeParsed, ruleParse } from './rule-parse';

const fixture = readFileSync(join(__dirname, 'fixtures', 'malazgirt.txt'), 'utf8');

describe('ruleParse Malazgirt fixture', () => {
  it('extracts at least 4 positions with KPSS P3 >= 60', () => {
    const parsed = ruleParse(fixture);
    expect(parsed.positions?.length).toBeGreaterThanOrEqual(4);
    const titles = parsed.positions!.map((p) => p.title);
    expect(titles).toEqual(expect.arrayContaining(['Mühendis', 'Mimar', 'Muhasebeci']));
    for (const p of parsed.positions!) {
      expect(p.kpssScoreType).toBe('P3');
      expect(p.kpssMinScore).toBe(60);
    }
  });

  it('extracts apply window, exam date and url', () => {
    const parsed = ruleParse(fixture);
    expect(parsed.applyStartAt).toContain('2026-11-02');
    expect(parsed.applyEndAt).toContain('2026-11-04');
    expect(parsed.examAt).toContain('2026-11-12');
    expect(parsed.url).toContain('malazgirt.bel.tr');
    expect(parsed.applicationMethods).toEqual(
      expect.arrayContaining(['elektronik', 'sahsen', 'posta']),
    );
    expect(parsed.requiredDocuments?.length).toBeGreaterThanOrEqual(3);
  });

  it('extractPositions works standalone', () => {
    expect(extractPositions(fixture).length).toBeGreaterThanOrEqual(4);
  });

  it('merge prefers richer LLM positions when longer', () => {
    const rules = ruleParse(fixture);
    const merged = mergeParsed(rules, {
      title: 'LLM Title',
      positions: [
        ...rules.positions!,
        { title: 'Extra', kpssScoreType: 'P3', kpssMinScore: 70, sequenceNo: 5 },
      ],
    });
    expect(merged.title).toBe('LLM Title');
    expect(merged.positions!.length).toBe(rules.positions!.length + 1);
  });

  it('cleanExamTopics strips heading and truncated junk', () => {
    const raw = `Sınav Konuları; 

Sözlü sınav; 

a) Türkiye Cumhuriyeti Anayasası, 

b) Atatürk İlkeleri ve İnkılâp Tarihi, 

c) 657 sayılı Devlet Memurları Kanunu, 

d) Mahalli idarelerle ilgili temel mevzuat

7."F`;
    const cleaned = cleanExamTopics(raw)!;
    expect(cleaned).not.toMatch(/^Sınav/i);
    expect(cleaned).not.toMatch(/7\."F/);
    expect(cleaned).toContain('Anayasası');
  });

  it('merge drops bad LLM examTopics in favor of rules', () => {
    const rules = { examTopics: 'a) Anayasa\nb) 657\nc) Mesleki bilgi ve yetenek' };
    const merged = mergeParsed(rules, { examTopics: '7."F' });
    expect(merged.examTopics).toContain('Anayasa');
  });
});
