# SignalBoard API

![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)

Multi-source **kamu ve özel ilan** toplayıcı: son tarih takibi, profil skoru, e-posta bildirimi, takvim (ICS).

Companion UI: [SignalBoard-web](https://github.com/hamzamaral/SignalBoard-web)

## Ne yapar

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
- Paste-parse: tam ilan metninden kurum, tarihler, KPSS, kadro satırları
- Scrape (özet): ilan.gov.tr, kamuilan.sbb.gov.tr, yerelyonetimler.csb.gov.tr
- Admin SMTP / LLM ayarları veritabanında **şifreli** saklanır; yerel `.env` ile çalıştırılır

## Stack

NestJS 10 · Prisma 5 · PostgreSQL 16 · JWT + refresh rotation · Swagger `/api/docs`

## Hızlı başlangıç

```bash
cp .env.example .env
# Port 5432 doluysa: POSTGRES_PORT=5433 docker compose up -d postgres
docker compose up -d postgres
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

- API: http://localhost:3000/api/v1  
- Swagger: http://localhost:3000/api/docs  

### Demo

| Email | Password | Role |
|-------|----------|------|
| admin@signalboard.local | Admin123! | ADMIN |
| user@signalboard.local | User123! | USER |

## Ana uç noktalar

- Auth: `POST /auth/login|refresh|logout`, `GET /auth/me`
- Listings: `GET/POST /listings`, `POST /listings/parse` (admin; `kind` PUBLIC|PRIVATE)
- Recommendations, profile, pipeline (başvurular), reminders + `GET /reminders/export.ics`
- Admin settings SMTP/LLM, `POST /ingest/run?source=…`

## Pipeline durumları

`NEW` · `REVIEW` · `TO_APPLY` · `APPLIED` · `WAITING_RESULT` · `CLOSED` · `CANNOT_APPLY` · `CANCELLED`

Web arayüzünde Türkçe etiketler: Yeni, İnceleme, Başvurulacak, Başvuruldu, Sonuç bekleniyor, Kapandı, Başvurulamaz, **İptal edildi**.

## Ekranlar

Görseller ve akış: [SignalBoard-web README](https://github.com/hamzamaral/SignalBoard-web).
