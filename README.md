# SignalBoard API

Multi-source **public & private listing aggregator** with deadline tracking, profile-based matching, email alerts, and calendar reminders (ICS).

Companion UI: [SignalBoard-web](https://github.com/hamzamaral/SignalBoard-web)

## What it does

```
Kaynaklar / yapıştırılan metin
        ↓
  Parse (kurallar + opsiyonel LLM)
        ↓
  Listing + ListingPosition (çoklu kadro)
        ↓
  Kullanıcı profili → öneri skoru
        ↓
  Başvuru pipeline + hatırlatıcı / ICS + e-posta
```

- **Kamu + özel** ilanlar (ayrı `kind`)
- Paste-parse: tam memur ilanı metninden kurum, tarihler, KPSS, kadro satırları
- Scrape (özet): ilan.gov.tr, kamuilan.sbb.gov.tr, yerelyonetimler.csb.gov.tr — resmi open API yok
- Admin SMTP / LLM ayarları DB’de **şifreli**; `.env` ve API key’ler GitHub’a gitmez

## Stack

NestJS 10 · Prisma 5 · PostgreSQL 16 · JWT + refresh rotation · Swagger `/api/docs`

## Quick start

```bash
cp .env.example .env
# Port 5432 doluysa: POSTGRES_PORT=5433 docker compose up -d postgres
docker compose up -d postgres
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

- API: http://localhost:3000/api/v1  
- Swagger: http://localhost:3000/api/docs  

### Demo

| Email | Password | Role |
|-------|----------|------|
| admin@signalboard.local | Admin123! | ADMIN |
| user@signalboard.local | User123! | USER |

## Main endpoints

- Auth: `POST /auth/login|refresh|logout`, `GET /auth/me`
- Listings: `GET/POST /listings`, `POST /listings/parse` (admin; `kind` PUBLIC|PRIVATE)
- Recommendations, profile, pipeline (başvurular), reminders + `GET /reminders/export.ics`
- Admin settings SMTP/LLM, `POST /ingest/run?source=…`

## Screens (web)

See [SignalBoard-web README](https://github.com/hamzamaral/SignalBoard-web#screenshots--flow) for UI flow: Özet, Kamu/Özel, Başvurularım (Türkçe durumlar), Takvim, Admin.
