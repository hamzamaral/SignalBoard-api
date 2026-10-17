/**
 * Collapse duplicate OPEN listings (same source + titleNorm + institution).
 * Keeps oldest; moves user_listings/reminders; refreshes titleNorm.
 * Run: npx ts-node --transpile-only scripts/dedupe-listings.ts
 */
import { PrismaClient } from '@prisma/client';
import { normalizeText } from '../src/common/utils/normalize';

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.listing.findMany({
    where: { status: 'OPEN' },
    select: {
      id: true,
      source: true,
      title: true,
      titleNorm: true,
      institutionId: true,
      createdAt: true,
      externalKey: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Refresh norms
  let norms = 0;
  for (const row of all) {
    const tn = normalizeText(row.title);
    if (tn !== row.titleNorm) {
      await prisma.listing.update({ where: { id: row.id }, data: { titleNorm: tn } });
      norms += 1;
    }
  }

  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const key = `${row.source}|${normalizeText(row.title)}|${row.institutionId ?? ''}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let removed = 0;
  for (const [, rows] of groups) {
    if (rows.length < 2) continue;
    const keep = rows[0];
    const drop = rows.slice(1);
    for (const d of drop) {
      // Move pipeline rows to keep (skip if already tracking keep)
      const uls = await prisma.userListing.findMany({ where: { listingId: d.id } });
      for (const ul of uls) {
        const exists = await prisma.userListing.findUnique({
          where: { userId_listingId: { userId: ul.userId, listingId: keep.id } },
        });
        if (exists) {
          await prisma.userListing.delete({ where: { id: ul.id } });
        } else {
          await prisma.userListing.update({
            where: { id: ul.id },
            data: { listingId: keep.id },
          });
        }
      }
      await prisma.reminder.updateMany({
        where: { listingId: d.id },
        data: { listingId: keep.id },
      });
      await prisma.listing.delete({ where: { id: d.id } });
      removed += 1;
    }
    // Prefer stable kamu: external key if keep still has URL-keyed id
    if (keep.source === 'KAMUILAN' && !keep.externalKey?.startsWith('kamu:')) {
      const stable = `kamu:${normalizeText(keep.title)}`;
      // better: will be fixed on next scrape with org|title
    }
  }

  // Institution nameNorm refresh
  const insts = await prisma.institution.findMany();
  for (const i of insts) {
    const nn = normalizeText(i.name);
    if (nn !== i.nameNorm) {
      await prisma.institution.update({ where: { id: i.id }, data: { nameNorm: nn } });
    }
  }

  console.log(`Deduped: removed ${removed} duplicates, refreshed ${norms} titleNorms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
