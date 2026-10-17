export function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFingerprint(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ? normalizeText(p) : ''))
    .filter(Boolean)
    .join('|');
}
