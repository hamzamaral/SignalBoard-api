/**
 * Case/diacritic fold for TR search & fingerprints.
 * ARALı / ARALI / aralik → same token (ı/I/i → i).
 */
export function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFingerprint(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ? normalizeText(p) : ''))
    .filter(Boolean)
    .join('|');
}
