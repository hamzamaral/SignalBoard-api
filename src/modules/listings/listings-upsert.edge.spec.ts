import { ListingSource, ListingStatus } from '@prisma/client';
import { ListingsService } from './listings.service';

/**
 * Mocked Prisma edge cases for upsertFromSourceMeta match order.
 */
describe('ListingsService.upsertFromSourceMeta (mocked)', () => {
  const institutionId = 'inst-1';

  function makeService(prisma: Record<string, unknown>) {
    const institutions = {
      resolveByName: jest.fn().mockResolvedValue({ id: institutionId, name: 'Org' }),
      create: jest.fn(),
    };
    const svc = new ListingsService(prisma as never, institutions as never);
    jest.spyOn(svc, 'update').mockResolvedValue({ id: 'updated' } as never);
    // private createNew
    (svc as unknown as { createNew: jest.Mock }).createNew = jest
      .fn()
      .mockResolvedValue({ id: 'new-1' });
    jest.spyOn(svc, 'get').mockResolvedValue({ id: 'x' } as never);
    return svc;
  }

  it('UPDATE by externalKey when present', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'existing-ext' });
    const prisma = {
      listing: {
        findUnique,
        findFirst: jest.fn(),
      },
    };
    const svc = makeService(prisma);
    const res = await svc.upsertFromSourceMeta({
      source: ListingSource.KAMUILAN,
      externalKey: 'kamu:org|title',
      title: 'Title',
      institutionName: 'Org',
    });
    expect(res.created).toBe(false);
    expect(findUnique).toHaveBeenCalled();
    expect(svc.update).toHaveBeenCalledWith('existing-ext', expect.any(Object));
  });

  it('UPDATE content twin when externalKey misses but same title+org+source OPEN', async () => {
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          id: 'twin-1',
          externalKey: 'old-url-kod',
          status: ListingStatus.OPEN,
        }),
      },
    };
    const svc = makeService(prisma);
    const res = await svc.upsertFromSourceMeta({
      source: ListingSource.KAMUILAN,
      externalKey: 'kamu:org|title',
      title: 'SÖZLEŞMELİ BİLİŞİM',
      institutionName: 'TÜRK PATENT',
      url: 'https://kamuilan.sbb.gov.tr/ilanDetay.aspx?kod=OTHER',
    });
    expect(res.created).toBe(false);
    expect(svc.update).toHaveBeenCalledWith('twin-1', expect.any(Object));
  });

  it('CREATE when no external and no content twin', async () => {
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null) // byContent
          .mockResolvedValueOnce(null), // similar other source
      },
    };
    const svc = makeService(prisma);
    const res = await svc.upsertFromSourceMeta({
      source: ListingSource.ILAN_GOV,
      externalKey: 'ad-123',
      title: 'Brand new ad',
      institutionName: 'Org',
    });
    expect(res.created).toBe(true);
  });
});
